/**
 * Twitter Tweet Publishing Endpoint V2
 *
 * Supports both:
 * - Project bots (with project API keys)
 * - Hivemind users (with Hivemind API key)
 *
 * POST: Publish a tweet on behalf of a connected account
 *
 * This endpoint allows external applications to publish tweets
 * without managing Twitter credentials themselves.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getBotByUsername } from '@/lib/db/bots';
import { getProjectById } from '@/lib/db/projects';
import { getTwitterAppByProjectId, getDefaultTwitterApp } from '@/lib/db/twitter-apps';
import { getHivemindUserByUsername, getHivemindConfig, updateHivemindUserActivity } from '@/lib/db/hivemind';
import { prisma } from '@/lib/db/prisma';
import { isTokenExpired, refreshAccessToken, calculateExpirationDate } from '@/lib/twitter/oauth2';
import { saveRateLimit, extractRateLimit, EndpointType } from '@/lib/services/rate-limit-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;


interface TweetRequest {
  username: string;  // REQUIRED: Twitter username (bot or Hivemind user)
  text: string;
  replyToTweetId?: string;
  idempotencyKey?: string;
  imageUrl?: string;  // URL of image to include in tweet (will be appended to text for auto-preview)
  videoUrl?: string;  // URL of video to include in tweet (will be appended to text for auto-preview)
}

/**
 * POST: Publish a tweet
 *
 * Request body:
 * {
 *   "username": "twitter_handle",  // Required: can be project bot OR Hivemind user
 *   "text": "Tweet text",
 *   "replyToTweetId": "1234567890", // optional
 *   "idempotencyKey": "unique-key-123", // optional - prevents duplicate tweets on retry
 *   "imageUrl": "https://example.com/image.jpg", // optional - URL of image (will be appended to text for auto-preview)
 *   "videoUrl": "https://example.com/video.mp4" // optional - URL of video (will be appended to text for auto-preview)
 * }
 *
 * Note: Twitter automatically shows preview for URLs in tweets. URLs count as 23 characters
 * regardless of actual length. Only one media URL (image OR video) can be included.
 *
 * Headers:
 * X-API-Key: <api_key> // Project API key OR Hivemind API key
 *
 * Response:
 * {
 *   "success": true,
 *   "tweet": {
 *     "id": "1234567890",
 *     "text": "Tweet text",
 *     "url": "https://twitter.com/username/status/1234567890"
 *   },
 *   "idempotent": true // optional - present if this was a cached idempotent response
 * }
 */
export async function POST(request: NextRequest) {
  let body: TweetRequest = {} as TweetRequest; // Initialize with empty object to avoid TypeScript errors
  let isHivemind = false;
  let projectId: string | null = null;
  let hivemindUser: any = null;
  let bot: any = null;

  try {
    console.log('');
    console.log('================================================================================');
    console.log('🐦 TWEET PUBLISHING REQUEST V2');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Parse request body
    body = await request.json();

    console.log('📋 Request details:');
    console.log('   Username:', body?.username || 'N/A');
    console.log('   Text length:', body?.text?.length || 0);
    console.log('   Reply to:', body?.replyToTweetId || 'N/A');
    console.log('   Idempotency key:', body?.idempotencyKey || 'N/A');
    console.log('   Image URL:', body?.imageUrl || 'N/A');
    console.log('   Video URL:', body?.videoUrl || 'N/A');
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

    // Get API key from headers
    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
      console.log('❌ Missing API key - X-API-Key header required');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'API key required - include X-API-Key header' },
        { status: 401 }
      );
    }

    // Determine if this is a Hivemind or Project API request
    let userCredentials: { accessToken: string; accessTokenSecret: string } | null = null;
    let oauth2Token: string | null = null; // For OAuth 2.0 support
    let consumerKey: string | undefined;
    let consumerSecret: string | undefined;

    // Check if it's a Hivemind API key (starts with 'hm_')
    if (apiKey.startsWith('hm_')) {
      console.log('🌐 Hivemind API key detected');

      // Validate Hivemind API key
      const hivemindConfig = await getHivemindConfig();

      console.log('📊 Hivemind Config Check:', {
        configExists: !!hivemindConfig,
        enabled: hivemindConfig?.enabled,
        hasApiKey: !!hivemindConfig?.apiKey,
        apiKeyMatch: hivemindConfig?.apiKey === apiKey
      });

      if (!hivemindConfig || !hivemindConfig.enabled) {
        console.log('❌ Hivemind is not enabled');
        console.log('   Config exists:', !!hivemindConfig);
        console.log('   Enabled:', hivemindConfig?.enabled);
        console.log('================================================================================');
        console.log('');
        return NextResponse.json(
          { error: 'Hivemind is not enabled' },
          { status: 403 }
        );
      }

      if (hivemindConfig.apiKey !== apiKey) {
        console.log('❌ Invalid Hivemind API key');
        console.log('   Expected:', hivemindConfig.apiKey?.substring(0, 10) + '...');
        console.log('   Received:', apiKey?.substring(0, 10) + '...');
        console.log('================================================================================');
        console.log('');
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }

      // Get Hivemind user credentials
      console.log('📦 Fetching Hivemind user credentials for:', body.username);
      hivemindUser = await getHivemindUserByUsername(body.username);

      console.log('👤 Hivemind User Check:', {
        username: body.username,
        userFound: !!hivemindUser,
        isActive: hivemindUser?.isActive,
        hasTokens: !!(hivemindUser?.accessToken && hivemindUser?.accessTokenSecret)
      });

      if (!hivemindUser) {
        console.log('❌ Hivemind user not found:', body.username);
        console.log('================================================================================');
        console.log('');
        return NextResponse.json(
          { error: `No Hivemind user found with username: ${body.username}` },
          { status: 404 }
        );
      }

      if (!hivemindUser.isActive) {
        console.log('❌ Hivemind user is inactive:', body.username);
        console.log('   User exists but isActive:', hivemindUser.isActive);
        console.log('================================================================================');
        console.log('');
        return NextResponse.json(
          { error: 'User has disconnected from Hivemind' },
          { status: 403 }
        );
      }

      console.log('✅ Hivemind user found:', hivemindUser.username);

      // Check if user has OAuth 2.0 tokens
      let useOAuth2 = false;

      if (hivemindUser.oauth2AccessToken) {
        console.log('🔐 User has OAuth 2.0 tokens');

        // Check if token is expired
        if (isTokenExpired(hivemindUser.expiresAt)) {
          console.log('⏰ OAuth 2.0 token expired, attempting refresh...');

          if (hivemindUser.refreshToken && hivemindConfig.twitterApp?.clientId && hivemindConfig.twitterApp?.clientSecret) {
            try {
              const refreshedTokens = await refreshAccessToken({
                refreshToken: hivemindUser.refreshToken,
                clientId: hivemindConfig.twitterApp.clientId,
                clientSecret: hivemindConfig.twitterApp.clientSecret
              });

              // Update tokens in database
              const newExpiresAt = calculateExpirationDate(refreshedTokens.expiresIn);
              await prisma.hivemindUser.update({
                where: { userId: hivemindUser.userId },
                data: {
                  oauth2AccessToken: refreshedTokens.accessToken,
                  refreshToken: refreshedTokens.refreshToken || hivemindUser.refreshToken,
                  expiresAt: newExpiresAt,
                  scope: refreshedTokens.scope
                }
              });

              console.log('✅ Token refreshed successfully');
              console.log('   New expiration:', newExpiresAt.toISOString());

              oauth2Token = refreshedTokens.accessToken;
              useOAuth2 = true;
            } catch (error: any) {
              console.error('❌ Failed to refresh OAuth 2.0 token:', error.message);
              console.log('   User needs to re-authenticate');
              return NextResponse.json(
                { error: 'OAuth 2.0 token expired and refresh failed. Please reconnect to Hivemind.' },
                { status: 401 }
              );
            }
          } else {
            console.log('❌ Cannot refresh token - missing refresh token or OAuth 2.0 credentials');
            return NextResponse.json(
              { error: 'OAuth 2.0 token expired. Please reconnect to Hivemind.' },
              { status: 401 }
            );
          }
        } else {
          console.log('✅ OAuth 2.0 token is still valid');
          oauth2Token = hivemindUser.oauth2AccessToken;
          useOAuth2 = true;
        }
      } else if (hivemindUser.accessToken && hivemindUser.accessTokenSecret) {
        console.log('🔐 User has OAuth 1.0a tokens');
        userCredentials = {
          accessToken: hivemindUser.accessToken,
          accessTokenSecret: hivemindUser.accessTokenSecret
        };
      } else {
        console.log('❌ User has no valid authentication tokens');
        return NextResponse.json(
          { error: 'User has no authentication tokens. Please reconnect to Hivemind.' },
          { status: 401 }
        );
      }

      // Update user activity
      await updateHivemindUserActivity(hivemindUser.userId);

      // Get Twitter API credentials from Hivemind config
      if (!hivemindConfig.twitterAppId || !hivemindConfig.twitterApp) {
        console.log('❌ Hivemind has no TwitterApp configured');
        console.log('================================================================================');
        console.log('');
        return NextResponse.json(
          { error: 'Hivemind TwitterApp not configured' },
          { status: 500 }
        );
      }

      // For OAuth 1.0a, we need consumer key/secret
      if (!useOAuth2) {
        if (!hivemindConfig.twitterApp.consumerKey || !hivemindConfig.twitterApp.consumerSecret) {
          console.error('❌ Hivemind TwitterApp missing OAuth 1.0a credentials');
          return NextResponse.json({
            success: false,
            error: 'Hivemind TwitterApp does not have OAuth 1.0a credentials configured'
          }, { status: 500 });
        }
        consumerKey = hivemindConfig.twitterApp.consumerKey;
        consumerSecret = hivemindConfig.twitterApp.consumerSecret;
      }

      console.log('🔑 Using credentials from Hivemind TwitterApp:', hivemindConfig.twitterApp.name);
      console.log('   Auth method:', useOAuth2 ? 'OAuth 2.0' : 'OAuth 1.0a');

      isHivemind = true;
    } else {
      // It's a project API key
      console.log('🏗️ Project API key detected');

      // Get bot credentials from PostgreSQL
      console.log('📦 Fetching bot credentials from database...');
      bot = await getBotByUsername(body.username);

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

      projectId = bot.projectId;
      userCredentials = {
        accessToken: bot.accessToken,
        accessTokenSecret: bot.accessTokenSecret
      };

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

      if (!twitterApp.consumerKey || !twitterApp.consumerSecret) {
        console.error('❌ Project TwitterApp missing OAuth 1.0a credentials');
        return NextResponse.json({
          success: false,
          error: 'Project TwitterApp does not have OAuth 1.0a credentials configured'
        }, { status: 500 });
      }

      consumerKey = twitterApp.consumerKey;
      consumerSecret = twitterApp.consumerSecret;
      console.log('🔑 Using credentials from Project TwitterApp:', twitterApp.name);
    }
    console.log('');

    // Ensure we have credentials (OAuth 1.0a needs consumer key/secret, OAuth 2.0 needs token)
    if (!oauth2Token && (!consumerKey || !consumerSecret)) {
      console.log('❌ Missing Twitter API credentials');
      console.log('   OAuth 2.0 token:', oauth2Token ? '✅' : '❌');
      console.log('   OAuth 1.0a consumer key:', consumerKey ? '✅' : '❌');
      console.log('   OAuth 1.0a consumer secret:', consumerSecret ? '✅' : '❌');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Twitter API credentials not configured' },
        { status: 500 }
      );
    }

    if (!oauth2Token && !userCredentials) {
      console.log('❌ No user credentials found');
      console.log('   OAuth 2.0 token:', oauth2Token ? '✅' : '❌');
      console.log('   OAuth 1.0a credentials:', userCredentials ? '✅' : '❌');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'User credentials not found' },
        { status: 500 }
      );
    }

    // Check for existing tweet with this idempotency key (only for projects)
    if (body.idempotencyKey && projectId) {
      console.log('🔍 Checking idempotency key...');

      const existingTweet = await prisma.idempotentTweet.findUnique({
        where: {
          projectId_idempotencyKey: {
            projectId,
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
        console.log('   URL:', `https://twitter.com/${body.username}/status/${existingTweet.tweetId}`);
        console.log('────────────────────────────────────────────────────────────────────────────────');
        console.log('   Returning cached result - NO duplicate tweet published');
        console.log('================================================================================');
        console.log('');

        return NextResponse.json({
          success: true,
          tweet: {
            id: existingTweet.tweetId,
            text: existingTweet.tweetText,
            url: `https://twitter.com/${body.username}/status/${existingTweet.tweetId}`,
          },
          idempotent: true,
        });
      }

      console.log('   No existing tweet found for this idempotency key');
      console.log('   Proceeding with tweet publishing...');
      console.log('');
    }

    // Create Twitter client
    console.log('🔑 Initializing Twitter client...');
    let client: TwitterApi;

    // Check if this is a Hivemind request with OAuth 2.0
    if (isHivemind && oauth2Token) {
      console.log('   Using OAuth 2.0 bearer token');
      client = new TwitterApi(oauth2Token);
    } else {
      console.log('   Using OAuth 1.0a credentials');
      if (!userCredentials) {
        throw new Error('OAuth 1.0a credentials are required but not available');
      }
      client = new TwitterApi({
        appKey: consumerKey,
        appSecret: consumerSecret,
        accessToken: userCredentials.accessToken,
        accessSecret: userCredentials.accessTokenSecret,
      } as any);
    }

    // Handle S3 image upload if provided
    let mediaId: string | undefined;

    if (body.imageUrl?.includes('s3')) {
      console.log('🖼️ Downloading image from S3 for upload to Twitter...');
      console.log('   S3 URL:', body.imageUrl);

      // Debug: Check OAuth 1.0a credentials
      console.log('🔍 Checking OAuth 1.0a credentials for media upload:');
      if (isHivemind) {
        console.log('   Type: Hivemind user');
        console.log('   userCredentials.accessToken exists:', !!userCredentials?.accessToken);
        console.log('   userCredentials.accessTokenSecret exists:', !!userCredentials?.accessTokenSecret);
      } else {
        console.log('   Type: Project bot');
        console.log('   bot.accessToken exists:', !!bot?.accessToken);
        console.log('   bot.accessTokenSecret exists:', !!bot?.accessTokenSecret);
      }
      console.log('   consumerKey exists:', !!consumerKey);
      console.log('   consumerSecret exists:', !!consumerSecret);

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
        const hasOAuth1 = isHivemind
          ? (userCredentials?.accessToken && userCredentials?.accessTokenSecret)
          : (bot?.accessToken && bot?.accessTokenSecret);

        if (hasOAuth1 && consumerKey && consumerSecret) {
          console.log('📤 Uploading image to Twitter using OAuth 1.0a...');
          console.log('   All OAuth 1.0a credentials available ✅');

          // Get Twitter app credentials
          let twitterApp;
          if (isHivemind) {
            // For Hivemind, use default Twitter app or specific app
            const defaultApp = await getDefaultTwitterApp();
            twitterApp = defaultApp;
          } else {
            // For project bots, use project's Twitter app
            twitterApp = await getTwitterAppByProjectId(bot!.projectId);
          }

          if (!twitterApp || !twitterApp.consumerKey || !twitterApp.consumerSecret) {
            console.log('⚠️ No Twitter app credentials for media upload');
            console.log('   Falling back to URL append method');
            if (tweetText.length + 24 > 280) {
              return NextResponse.json(
                { error: 'Tweet text plus image URL exceeds 280 character limit' },
                { status: 400 }
              );
            }
            tweetText = `${tweetText} ${body.imageUrl}`;
          } else {
            // Create OAuth 1.0a client for media upload
            const v1Client = new TwitterApi({
              appKey: twitterApp.consumerKey,
              appSecret: twitterApp.consumerSecret,
              accessToken: isHivemind ? userCredentials!.accessToken : bot!.accessToken,
              accessSecret: isHivemind ? userCredentials!.accessTokenSecret : bot!.accessTokenSecret,
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
          }
        } else {
          console.log('⚠️ No OAuth 1.0a credentials for media upload');
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
    console.log('   Account type:', isHivemind ? 'Hivemind User' : 'Project Bot');
    console.log('   Tweet text preview:', body.text.substring(0, 100) + (body.text.length > 100 ? '...' : ''));
    console.log('   Tweet text length:', body.text.length);
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
    console.log('   URL:', `https://twitter.com/${body.username}/status/${response.data.id}`);
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('');

    // Save rate limit information
    const rateLimitInfo = extractRateLimit(response);
    if (rateLimitInfo) {
      // Determine the account that made the request
      const accountInfo = isHivemind
        ? {
            accountId: hivemindUser?.userId || body.username,
            accountUsername: body.username
          }
        : {
            accountId: bot?.userId || body.username,
            accountUsername: body.username
          };

      await saveRateLimit(
        {
          projectId: projectId || undefined,
          hivemindUserId: isHivemind ? (hivemindUser?.userId || undefined) : undefined,
          accountId: accountInfo.accountId,
          accountUsername: accountInfo.accountUsername,
          endpoint: 'POST /2/tweets',
          endpointType: EndpointType.TWEET,
        },
        rateLimitInfo
      );
    }

    // Store idempotency key if provided (only for projects)
    if (body.idempotencyKey && projectId) {
      console.log('💾 Storing idempotency key...');

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      try {
        await prisma.idempotentTweet.create({
          data: {
            projectId,
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
        url: `https://twitter.com/${body.username}/status/${response.data.id}`,
      },
    });
  } catch (error: any) {
    console.error('❌ TWEET PUBLISHING ERROR');
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error type:', error.type);
    console.error('   Stack:', error.stack);

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
      console.error('   Reason: Forbidden - check permissions');
    } else if (error.code === 401) {
      console.error('   Reason: Unauthorized - check credentials');
    } else if (error.code === 429) {
      console.error('   Reason: Rate limit exceeded');

      // Save rate limit information even on error
      if (error.rateLimit) {
        try {
          const accountInfo = isHivemind
            ? {
                accountId: hivemindUser?.userId || body?.username || 'unknown',
                accountUsername: body?.username || 'unknown'
              }
            : {
                accountId: bot?.userId || body?.username || 'unknown',
                accountUsername: body?.username || 'unknown'
              };

          await saveRateLimit(
            {
              projectId: projectId || undefined,
              hivemindUserId: isHivemind ? (hivemindUser?.userId || undefined) : undefined,
              accountId: accountInfo.accountId,
              accountUsername: accountInfo.accountUsername,
              endpoint: 'POST /2/tweets',
              endpointType: EndpointType.TWEET,
            },
            {
              limit: error.rateLimit.limit || 300,
              remaining: 0, // When we hit 429, remaining is always 0
              reset: error.rateLimit.reset
            }
          );
          console.log('💾 Rate limit saved to database despite error');
        } catch (saveError) {
          console.error('❌ Failed to save rate limit:', saveError);
        }
      }

      // Return enhanced error response
      const resetTime = error.rateLimit?.reset ? new Date(error.rateLimit.reset * 1000).toISOString() : 'unknown';
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Too many tweet requests.',
          details: {
            message: 'Twitter API rate limit reached for tweets. Please wait before trying again.',
            resetAt: resetTime,
            limit: error.rateLimit?.limit || 300,
            remaining: 0,
            retryAfter: error.rateLimit?.reset ? Math.max(0, error.rateLimit.reset - Math.floor(Date.now() / 1000)) : 900,
            endpoint: 'tweets'
          }
        },
        { status: 429 }
      );
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