/**
 * Twitter Tweet Publishing Endpoint
 *
 * POST: Publish a tweet on behalf of a connected bot
 *
 * This endpoint allows external applications (like goodboy) to publish tweets
 * without managing Twitter credentials themselves.
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

/**
 * Download media from URL and return as Buffer
 */
async function downloadMedia(url: string): Promise<Buffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

interface TweetRequest {
  username: string;
  text: string;
  replyToTweetId?: string;
  idempotencyKey?: string; // Optional idempotency key to prevent duplicate tweets
  imageUrl?: string; // Deprecated: Use imageData instead - URL of image to attach
  videoUrl?: string; // Deprecated: Use videoData instead - URL of video to attach
  imageData?: string; // Base64 encoded image data (preferred over imageUrl)
  videoData?: string; // Base64 encoded video data (preferred over videoUrl)
  imageMimeType?: string; // MIME type for image (default: image/jpeg)
  videoMimeType?: string; // MIME type for video (default: video/mp4)
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
 *
 *   // Media options (use EITHER base64 data OR URL, not both):
 *
 *   // Option 1: Base64 encoded media (PREFERRED)
 *   "imageData": "data:image/jpeg;base64,/9j/4AAQ...", // Data URL format
 *   // OR raw base64 with explicit MIME type:
 *   "imageData": "/9j/4AAQ...", // Raw base64 data
 *   "imageMimeType": "image/jpeg", // MIME type for raw base64 (default: image/jpeg)
 *   // OR for video:
 *   "videoData": "data:video/mp4;base64,AAAAHGZ0...", // Data URL format
 *   // OR raw base64 with explicit MIME type:
 *   "videoData": "AAAAHGZ0...", // Raw base64 data
 *   "videoMimeType": "video/mp4", // MIME type for raw base64 (default: video/mp4)
 *
 *   // Option 2: Media URL (DEPRECATED - use base64 instead)
 *   "imageUrl": "https://example.com/image.jpg", // URL of image to attach
 *   "videoUrl": "https://example.com/video.mp4" // URL of video to attach
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "tweet": {
 *     "id": "1234567890",
 *     "text": "Tweet text",
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
 * - Use base64 encoded data (imageData/videoData) for inline media (PREFERRED)
 * - Or use URL-based media (imageUrl/videoUrl) which requires external hosting (DEPRECATED)
 * - Base64 data can be raw base64 string or data URL format (data:image/png;base64,...)
 * - Only one media type per tweet (image OR video, not both)
 * - Cannot mix base64 and URL approaches in same request
 * - Default MIME types: image/jpeg for images, video/mp4 for videos
 * - Custom MIME types supported via imageMimeType/videoMimeType parameters
 * - Supported image formats: PNG, JPG, GIF, WEBP
 * - Supported video formats: MP4
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
    console.log('   Image data:', body.imageData ? `${body.imageData.length} chars` : 'N/A');
    console.log('   Video data:', body.videoData ? `${body.videoData.length} chars` : 'N/A');
    console.log('   Image MIME type:', body.imageMimeType || 'N/A');
    console.log('   Video MIME type:', body.videoMimeType || 'N/A');
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

    // Validate media parameters
    const hasImage = body.imageUrl || body.imageData;
    const hasVideo = body.videoUrl || body.videoData;

    if (hasImage && hasVideo) {
      console.log('❌ Cannot include both image and video');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Cannot include both image and video - choose one' },
        { status: 400 }
      );
    }

    if (body.imageData && body.imageUrl) {
      console.log('❌ Cannot include both imageData and imageUrl');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Cannot include both imageData and imageUrl - choose one' },
        { status: 400 }
      );
    }

    if (body.videoData && body.videoUrl) {
      console.log('❌ Cannot include both videoData and videoUrl');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Cannot include both videoData and videoUrl - choose one' },
        { status: 400 }
      );
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

    // Handle media upload if provided
    let mediaId: string | undefined;
    let mediaBuffer: Buffer | undefined;
    let mediaType: 'image' | 'video' | undefined;
    let mimeType: string | undefined;

    // Handle base64 data
    if (body.imageData || body.videoData) {
      const isImage = !!body.imageData;
      mediaType = isImage ? 'image' : 'video';

      console.log(`📸 Processing base64 ${mediaType} data...`);

      try {
        // Extract base64 data (handle data URL format if present)
        let base64Data = isImage ? body.imageData! : body.videoData!;
        if (base64Data.includes(',')) {
          // Handle data URL format: "data:image/png;base64,..."
          console.log('   Detected data URL format, extracting base64 portion');
          base64Data = base64Data.split(',')[1];
        }

        // Convert base64 to Buffer
        mediaBuffer = Buffer.from(base64Data, 'base64');
        console.log(`   Decoded ${mediaBuffer.length} bytes from base64`);

        // Determine MIME type
        if (isImage) {
          mimeType = body.imageMimeType || 'image/jpeg';
        } else {
          mimeType = body.videoMimeType || 'video/mp4';
        }
        console.log('   MIME type:', mimeType);
      } catch (error: any) {
        console.error(`❌ Failed to decode base64 ${mediaType}:`, error.message);
        console.log('================================================================================');
        console.log('');
        return NextResponse.json(
          { error: `Failed to decode base64 ${mediaType}: ${error.message}` },
          { status: 400 }
        );
      }
    }
    // Handle URL-based media (deprecated but still supported)
    else if (body.imageUrl || body.videoUrl) {
      const mediaUrl = body.imageUrl || body.videoUrl;
      mediaType = body.imageUrl ? 'image' : 'video';

      console.log(`📸 Downloading ${mediaType} from URL (deprecated - use base64 instead)...`);
      console.log('   URL:', mediaUrl);

      try {
        mediaBuffer = await downloadMedia(mediaUrl!);
        console.log(`   Downloaded ${mediaBuffer.length} bytes`);

        // Default MIME types for URL-based media
        mimeType = mediaType === 'image' ? 'image/jpeg' : 'video/mp4';
      } catch (error: any) {
        console.error(`❌ Failed to download ${mediaType}:`, error.message);
        console.log('================================================================================');
        console.log('');
        return NextResponse.json(
          { error: `Failed to download ${mediaType}: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // Upload media to Twitter if we have a buffer
    if (mediaBuffer && mediaType && mimeType) {
      console.log(`📤 Uploading ${mediaType} to Twitter...`);
      const uploadStartTime = Date.now();

      // Check if bot has media.write scope for OAuth 2.0
      const hasMediaWriteScope = bot.scope?.includes('media.write');

      // Determine which authentication method to use for media upload
      let mediaUploadClient: TwitterApi | null = null;
      let useOAuth2ForMedia = false;

      if (bot.oauth2AccessToken && hasMediaWriteScope) {
        // Use OAuth 2.0 if we have the media.write scope
        console.log('   🔐 Using OAuth 2.0 for media upload (has media.write scope)');
        mediaUploadClient = client; // Use the already created client
        useOAuth2ForMedia = true;
      } else if (bot.accessToken && bot.accessTokenSecret) {
        // Fall back to OAuth 1.0a for media upload
        console.log('   ⚠️  Using OAuth 1.0a for media upload (OAuth 2.0 missing media.write scope)');

        const consumerKey = twitterApp.consumerKey;
        const consumerSecret = twitterApp.consumerSecret;

        if (!consumerKey || !consumerSecret) {
          console.log('❌ TwitterApp missing OAuth 1.0a credentials for media upload');
          return NextResponse.json(
            { error: 'TwitterApp not configured for OAuth 1.0a (required for media upload)' },
            { status: 500 }
          );
        }

        mediaUploadClient = new TwitterApi({
          appKey: consumerKey,
          appSecret: consumerSecret,
          accessToken: bot.accessToken,
          accessSecret: bot.accessTokenSecret,
        } as any);

        console.log('   🔑 Using OAuth 1.0a for media upload');
      } else {
        console.log('❌ Bot cannot upload media:');
        if (bot.oauth2AccessToken && !hasMediaWriteScope) {
          console.log('   - OAuth 2.0 token missing media.write scope');
          console.log('   - Please reconnect bot with media.write scope enabled');
        } else {
          console.log('   - No OAuth 1.0a credentials available');
          console.log('   - No OAuth 2.0 token with media.write scope');
        }
        return NextResponse.json(
          {
            error: 'Media upload not available. Bot needs either OAuth 1.0a credentials or OAuth 2.0 with media.write scope. Please reconnect the bot.',
            details: {
              hasOAuth2: !!bot.oauth2AccessToken,
              hasMediaWriteScope: hasMediaWriteScope,
              hasOAuth1: !!(bot.accessToken && bot.accessTokenSecret)
            }
          },
          { status: 500 }
        );
      }

      try {
        // IMPORTANT: Twitter's v1.1 media upload API currently requires OAuth 1.0a
        // Even with media.write scope, OAuth 2.0 tokens get 403 errors on v1.1 media endpoint
        // Twitter's v2 media upload API is not yet available in the SDK
        mediaId = await mediaUploadClient.v1.uploadMedia(mediaBuffer, {
          mimeType: mimeType,
        });

        const uploadDuration = Date.now() - uploadStartTime;
        console.log(`   ✅ ${mediaType} uploaded successfully`);
        console.log('   Media ID:', mediaId);
        console.log('   Duration:', `${uploadDuration}ms`);
        console.log('   Auth method:', useOAuth2ForMedia ? 'OAuth 2.0' : 'OAuth 1.0a');
        console.log('');
      } catch (error: any) {
        console.error(`❌ Failed to upload ${mediaType} to Twitter:`, error.message);
        console.log('   Error details:', error);

        // Provide more helpful error message based on auth method
        if (useOAuth2ForMedia && error.code === 403) {
          console.error('   💡 Hint: OAuth 2.0 media upload requires media.write scope');
          console.error('   Current scopes:', bot.scope);
        }

        console.log('================================================================================');
        console.log('');
        return NextResponse.json(
          { error: `Failed to upload ${mediaType} to Twitter: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // Publish tweet
    console.log('📤 Publishing tweet...');
    console.log('   Tweet text preview:', body.text.substring(0, 100) + (body.text.length > 100 ? '...' : ''));
    console.log('   Tweet text length:', body.text.length);
    console.log('   Tweet text (full):', JSON.stringify(body.text)); // Show escaped version for debugging
    const startTime = Date.now();

    const tweetData: any = {
      text: body.text,
    };

    if (body.replyToTweetId) {
      tweetData.reply = {
        in_reply_to_tweet_id: body.replyToTweetId,
      };
    }

    if (mediaId) {
      tweetData.media = {
        media_ids: [mediaId],
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
