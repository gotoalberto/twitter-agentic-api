/**
 * Twitter Tweet Publishing Endpoint
 *
 * POST: Publish a tweet on behalf of a connected bot
 *
 * This endpoint allows external applications to publish tweets
 * without managing Twitter credentials themselves.
 *
 * For images/videos: Use imageUrl or videoUrl parameters.
 * The URL will be appended to the tweet text and Twitter will show a preview.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getBotByUsername } from '@/lib/db/bots';
import { getProjectById } from '@/lib/db/projects';
import { getTwitterAppByProjectId } from '@/lib/db/twitter-apps';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface TweetRequest {
  username: string;
  text: string;
  replyToTweetId?: string;
  idempotencyKey?: string; // Optional idempotency key to prevent duplicate tweets
  imageUrl?: string; // URL of image to include in tweet (will be appended to text)
  videoUrl?: string; // URL of video to include in tweet (will be appended to text)
}

/**
 * POST: Publish a tweet
 *
 * Request body:
 * {
 *   "username": "bot_handle",
 *   "text": "Tweet text",
 *   "replyToTweetId": "1234567890", // optional
 *   "idempotencyKey": "unique-key-123", // optional - prevents duplicate tweets on retry
 *   "imageUrl": "https://example.com/image.jpg", // optional - URL of image
 *   "videoUrl": "https://example.com/video.mp4" // optional - URL of video
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "tweet": {
 *     "id": "1234567890",
 *     "text": "Tweet text https://example.com/image.jpg",
 *     "url": "https://twitter.com/bot_handle/status/1234567890"
 *   },
 *   "idempotent": true // optional - present if this was a cached idempotent response
 * }
 *
 * Idempotency:
 * - If idempotencyKey is provided and a tweet was already published with the same key,
 *   returns the existing tweet instead of publishing a duplicate
 * - Idempotency keys expire after 24 hours
 * - Use PendingReply.id or similar unique identifier as idempotency key
 *
 * Media Attachments:
 * - Use imageUrl or videoUrl to include media in your tweet
 * - The URL will be appended to your tweet text
 * - Twitter will automatically show a preview of the image/video
 * - URLs count as 23 characters in Twitter's character limit
 * - Upload your media to any public hosting service (Imgur, Cloudinary, S3, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('');
    console.log('================================================================================');
    console.log('🐦 TWEET PUBLISHING REQUEST');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Parse request body
    const body: TweetRequest = await request.json();

    console.log('📋 Request details:');
    console.log('   Username:', body.username);
    console.log('   Text length:', body.text?.length || 0);
    console.log('   Reply to:', body.replyToTweetId || 'N/A');
    console.log('   Idempotency key:', body.idempotencyKey || 'N/A');
    console.log('   Image URL:', body.imageUrl || 'N/A');
    console.log('   Video URL:', body.videoUrl || 'N/A');
    console.log('');

    // Validate request
    if (!body.username) {
      console.log('❌ Missing username');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'username is required' },
        { status: 400 }
      );
    }

    if (!body.text) {
      console.log('❌ Missing text');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 }
      );
    }

    if (body.text.length > 280) {
      console.log('❌ Text too long:', body.text.length, 'characters');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'text must be 280 characters or less' },
        { status: 400 }
      );
    }

    // Keep original text for tweet
    let tweetText = body.text;

    // Validate media URLs
    if (body.imageUrl && body.videoUrl) {
      console.log('❌ Cannot include both image and video URL');
      return NextResponse.json(
        { error: 'Cannot include both imageUrl and videoUrl - choose one' },
        { status: 400 }
      );
    }

    // For non-S3 URLs (like Twitter URLs), append to text for preview
    // For S3 URLs, we'll upload the media directly
    if ((body.imageUrl || body.videoUrl) &&
        !(body.imageUrl?.includes('s3') || body.videoUrl?.includes('s3'))) {
      const mediaUrl = body.imageUrl || body.videoUrl;
      console.log('🔗 Adding non-S3 URL to tweet text for auto-preview');
      console.log('   Media URL:', mediaUrl);

      // Check if we have space to add the URL (URLs take 23 characters in Twitter)
      const urlLength = 23; // Twitter counts all URLs as 23 characters
      const currentLength = tweetText.length;
      const spaceNeeded = 1; // Space before URL

      if (currentLength + spaceNeeded + urlLength > 280) {
        console.log('❌ Tweet text + URL exceeds 280 character limit');
        console.log('   Text length:', currentLength);
        console.log('   URL will add:', spaceNeeded + urlLength, 'characters');
        console.log('   Total would be:', currentLength + spaceNeeded + urlLength);
        return NextResponse.json(
          { error: 'Tweet text plus media URL exceeds 280 character limit. Please shorten the text.' },
          { status: 400 }
        );
      }

      // Append URL to tweet text (Twitter will show preview)
      tweetText = `${tweetText} ${mediaUrl}`;
      console.log('   Updated tweet text with URL');
      console.log('   Final character count:', tweetText.length, '(Twitter counts as:', currentLength + spaceNeeded + urlLength + ')');
    }

    // Get bot credentials from PostgreSQL
    console.log('📦 Fetching bot credentials from database...');
    const bot = await getBotByUsername(body.username);

    if (!bot) {
      console.log('❌ Bot not found for username:', body.username);
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: `No bot found with username: ${body.username}` },
        { status: 404 }
      );
    }

    console.log('✅ Bot found:', bot.username);
    console.log('   Project ID:', bot.projectId);
    console.log('');

    // Validate API key
    console.log('🔐 Validating API key...');
    const apiKey = request.headers.get('x-api-key');

    // Get project to check API key
    const project = await getProjectById(bot.projectId);

    if (!project) {
      console.log('❌ Project not found');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if API key is required and validate it
    if (project.apiKey) {
      if (!apiKey) {
        console.log('❌ Missing API key - X-API-Key header required');
        console.log('================================================================================');
        console.log('');
        return NextResponse.json(
          { error: 'API key required - include X-API-Key header' },
          { status: 401 }
        );
      }

      if (apiKey !== project.apiKey) {
        console.log('❌ Invalid API key');
        console.log('================================================================================');
        console.log('');
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }

      console.log('✅ API key validated');
    } else {
      console.log('ℹ️  No API key configured for this project');
    }
    console.log('');

    // Check if API is enabled for this project
    if (!project.apiEnabled) {
      console.log('❌ API disabled for this project');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'API access is disabled for this project. Please enable it in the project settings.' },
        { status: 403 }
      );
    }

    console.log('✅ API enabled for project');
    console.log('');

    // Check for existing tweet with this idempotency key
    if (body.idempotencyKey) {
      console.log('🔍 Checking idempotency key...');

      const existingTweet = await prisma.idempotentTweet.findUnique({
        where: {
          projectId_idempotencyKey: {
            projectId: bot.projectId,
            idempotencyKey: body.idempotencyKey,
          },
        },
      });

      if (existingTweet) {
        console.log('✅ IDEMPOTENCY HIT - Tweet already published');
        console.log('────────────────────────────────────────────────────────────────────────────────');
        console.log('   Tweet ID:', existingTweet.tweetId);
        console.log('   Published at:', existingTweet.publishedAt.toISOString());
        console.log('   Time since publish:', `${Date.now() - existingTweet.publishedAt.getTime()}ms`);
        console.log('   URL:', `https://twitter.com/${bot.username}/status/${existingTweet.tweetId}`);
        console.log('────────────────────────────────────────────────────────────────────────────────');
        console.log('   Returning cached result - NO duplicate tweet published');
        console.log('================================================================================');
        console.log('');

        // Return the existing tweet (idempotency success)
        return NextResponse.json({
          success: true,
          tweet: {
            id: existingTweet.tweetId,
            text: existingTweet.tweetText,
            url: `https://twitter.com/${bot.username}/status/${existingTweet.tweetId}`,
          },
          idempotent: true, // Flag indicating this was an idempotent response
        });
      }

      console.log('   No existing tweet found for this idempotency key');
      console.log('   Proceeding with tweet publishing...');
      console.log('');
    }

    // Get Twitter API credentials from the project's TwitterApp
    const twitterApp = await getTwitterAppByProjectId(bot.projectId);
    if (!twitterApp) {
      console.log('❌ Project has no TwitterApp configured');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Project TwitterApp not configured. Please assign a Twitter App to this project.' },
        { status: 500 }
      );
    }

    console.log('🔑 Using credentials from TwitterApp:', twitterApp.name);

    // Create Twitter client - prefer OAuth 2.0 if available
    let client: TwitterApi;

    if (bot.oauth2AccessToken) {
      // Use OAuth 2.0 if available
      console.log('🔐 Using OAuth 2.0 for tweet publishing');
      console.log('   Has access token:', !!bot.oauth2AccessToken);
      console.log('   Token expires at:', bot.expiresAt?.toISOString());

      // Check if token is expired
      if (bot.expiresAt && new Date() > new Date(bot.expiresAt)) {
        console.log('⏰ OAuth 2.0 token expired, needs refresh');

        // Try to refresh if we have refresh token and credentials
        if (bot.refreshToken && twitterApp.clientId && twitterApp.clientSecret) {
          console.log('🔄 Attempting to refresh OAuth 2.0 token...');

          const { refreshAccessToken, calculateExpirationDate } = await import('@/lib/twitter/oauth2');

          try {
            const refreshedTokens = await refreshAccessToken({
              refreshToken: bot.refreshToken,
              clientId: twitterApp.clientId,
              clientSecret: twitterApp.clientSecret,
            });

            // Update tokens in database
            const newExpiresAt = calculateExpirationDate(refreshedTokens.expiresIn);
            await prisma.bot.update({
              where: { id: bot.id },
              data: {
                oauth2AccessToken: refreshedTokens.accessToken,
                refreshToken: refreshedTokens.refreshToken || bot.refreshToken,
                expiresAt: newExpiresAt,
                scope: refreshedTokens.scope,
              },
            });

            // Use the new token
            bot.oauth2AccessToken = refreshedTokens.accessToken;
            bot.expiresAt = newExpiresAt;
            console.log('✅ Token refreshed successfully');
          } catch (error) {
            console.error('❌ Failed to refresh token:', error);
            return NextResponse.json({ error: 'Failed to refresh authentication token' }, { status: 401 });
          }
        } else {
          console.error('❌ Cannot refresh token - missing refresh token or OAuth 2.0 credentials');
          return NextResponse.json({ error: 'Authentication token expired' }, { status: 401 });
        }
      }

      client = new TwitterApi(bot.oauth2AccessToken);
    } else if (bot.accessToken && bot.accessTokenSecret) {
      // Fall back to OAuth 1.0a if no OAuth 2.0 token
      console.log('🔑 Using OAuth 1.0a for tweet publishing');

      const consumerKey = twitterApp.consumerKey;
      const consumerSecret = twitterApp.consumerSecret;

      if (!consumerKey || !consumerSecret) {
        console.log('❌ TwitterApp missing OAuth 1.0a credentials');
        return NextResponse.json(
          { error: 'TwitterApp not configured for OAuth 1.0a' },
          { status: 500 }
        );
      }

      client = new TwitterApi({
        appKey: consumerKey,
        appSecret: consumerSecret,
        accessToken: bot.accessToken,
        accessSecret: bot.accessTokenSecret,
      } as any);
    } else {
      console.log('❌ Bot has no valid authentication tokens');
      return NextResponse.json(
        { error: 'Bot not authenticated. Please reconnect the bot.' },
        { status: 401 }
      );
    }

    // Handle S3 image upload if provided
    let mediaId: string | undefined;

    if (body.imageUrl?.includes('s3')) {
      console.log('🖼️ Downloading image from S3 for upload to Twitter...');
      console.log('   S3 URL:', body.imageUrl);

      // Debug: Check OAuth 1.0a credentials
      console.log('🔍 Checking OAuth 1.0a credentials for media upload:');
      console.log('   bot.accessToken exists:', !!bot.accessToken);
      console.log('   bot.accessTokenSecret exists:', !!bot.accessTokenSecret);
      console.log('   twitterApp.consumerKey exists:', !!twitterApp.consumerKey);
      console.log('   twitterApp.consumerSecret exists:', !!twitterApp.consumerSecret);

      try {
        // Download image from S3
        const imageResponse = await fetch(body.imageUrl);

        if (!imageResponse.ok) {
          console.log('❌ Failed to download image from S3');
          console.log('   Status:', imageResponse.status);
          return NextResponse.json(
            { error: `Failed to download image from S3: ${imageResponse.status}` },
            { status: 400 }
          );
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        console.log('   Image size:', imageBuffer.length, 'bytes');

        // Upload to Twitter using v1 API (OAuth 1.0a)
        if (bot.accessToken && bot.accessTokenSecret && twitterApp.consumerKey && twitterApp.consumerSecret) {
          console.log('📤 Uploading image to Twitter using OAuth 1.0a...');
          console.log('   All OAuth 1.0a credentials available ✅');

          // Create OAuth 1.0a client for media upload
          const v1Client = new TwitterApi({
            appKey: twitterApp.consumerKey,
            appSecret: twitterApp.consumerSecret,
            accessToken: bot.accessToken,
            accessSecret: bot.accessTokenSecret,
          });

          // Upload media
          const uploadStartTime = Date.now();
          mediaId = await v1Client.v1.uploadMedia(imageBuffer, {
            mimeType: 'image/png', // Default to PNG, could be improved by detecting
          });
          const uploadDuration = Date.now() - uploadStartTime;

          console.log('   ✅ Media uploaded successfully');
          console.log('   Media ID:', mediaId);
          console.log('   Upload duration:', `${uploadDuration}ms`);
        } else {
          console.log('⚠️ Missing OAuth 1.0a credentials for media upload');
          console.log('   bot.accessToken:', bot.accessToken ? 'EXISTS' : 'MISSING');
          console.log('   bot.accessTokenSecret:', bot.accessTokenSecret ? 'EXISTS' : 'MISSING');
          console.log('   twitterApp.consumerKey:', twitterApp.consumerKey ? 'EXISTS' : 'MISSING');
          console.log('   twitterApp.consumerSecret:', twitterApp.consumerSecret ? 'EXISTS' : 'MISSING');
          console.log('   Falling back to URL append method');
          // Fall back to appending URL
          if (tweetText.length + 24 > 280) {
            return NextResponse.json(
              { error: 'Tweet text plus image URL exceeds 280 character limit' },
              { status: 400 }
            );
          }
          tweetText = `${tweetText} ${body.imageUrl}`;
        }
      } catch (error: any) {
        console.error('❌ Error handling S3 image:', error.message);
        // Fall back to appending URL
        if (tweetText.length + 24 <= 280) {
          tweetText = `${tweetText} ${body.imageUrl}`;
        }
      }
    }

    // Publish tweet
    console.log('📤 Publishing tweet...');
    console.log('   Tweet text preview:', tweetText.substring(0, 100) + (tweetText.length > 100 ? '...' : ''));
    console.log('   Tweet text length:', tweetText.length);
    console.log('   Tweet text (full):', JSON.stringify(tweetText)); // Show escaped version for debugging
    console.log('   Has media:', !!mediaId);
    const startTime = Date.now();

    const tweetData: any = {
      text: tweetText,
    };

    // Add media if uploaded
    if (mediaId) {
      tweetData.media = {
        media_ids: [mediaId],
      };
    }

    if (body.replyToTweetId) {
      tweetData.reply = {
        in_reply_to_tweet_id: body.replyToTweetId,
      };
    }

    const response = await client.v2.tweet(tweetData);
    const duration = Date.now() - startTime;

    console.log('');
    console.log('✅ TWEET PUBLISHED SUCCESSFULLY');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('   Tweet ID:', response.data.id);
    console.log('   Text:', response.data.text);
    console.log('   Duration:', `${duration}ms`);
    console.log('   URL:', `https://twitter.com/${bot.username}/status/${response.data.id}`);
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('');

    // Store idempotency key if provided (prevents duplicates on retry)
    if (body.idempotencyKey) {
      console.log('💾 Storing idempotency key...');

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Expire after 24 hours

      try {
        await prisma.idempotentTweet.create({
          data: {
            projectId: bot.projectId,
            idempotencyKey: body.idempotencyKey,
            tweetId: response.data.id,
            tweetText: response.data.text,
            replyToTweetId: body.replyToTweetId || null,
            expiresAt,
          },
        });

        console.log('   ✅ Idempotency key stored');
        console.log('   Expires at:', expiresAt.toISOString());
      } catch (error: any) {
        // Log error but don't fail the request (tweet was published successfully)
        console.warn('   ⚠️  Failed to store idempotency key:', error.message);
        console.warn('   This may result in duplicate tweets if client retries');
      }

      console.log('');
    }

    console.log('================================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      tweet: {
        id: response.data.id,
        text: response.data.text,
        url: `https://twitter.com/${bot.username}/status/${response.data.id}`,
      },
    });
  } catch (error: any) {
    console.error('❌ TWEET PUBLISHING ERROR');
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error type:', error.type);
    console.error('   Stack:', error.stack);

    // Log full Twitter API error response if available
    if (error.data) {
      console.error('   Twitter API Error Data:', JSON.stringify(error.data, null, 2));
    }
    if (error.errors) {
      console.error('   Twitter API Errors:', JSON.stringify(error.errors, null, 2));
    }
    if (error.rateLimit) {
      console.error('   Rate Limit Info:', JSON.stringify(error.rateLimit, null, 2));
    }

    // Check for specific Twitter API errors
    if (error.code === 403) {
      console.error('   Reason: Forbidden - check bot permissions');
    } else if (error.code === 401) {
      console.error('   Reason: Unauthorized - check bot credentials');
    } else if (error.code === 429) {
      console.error('   Reason: Rate limit exceeded');
    }

    console.log('================================================================================');
    console.log('');

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to publish tweet',
      },
      { status: error.code || 500 }
    );
  }
}