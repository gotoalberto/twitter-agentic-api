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
import { getTwitterAppByProjectId } from '@/lib/db/twitter-apps';
import { getHivemindUserByUsername, getHivemindConfig, updateHivemindUserActivity } from '@/lib/db/hivemind';
import { prisma } from '@/lib/db/prisma';
import { isTokenExpired, refreshAccessToken, calculateExpirationDate } from '@/lib/twitter/oauth2';

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
  username: string;  // REQUIRED: Twitter username (bot or Hivemind user)
  text: string;
  replyToTweetId?: string;
  idempotencyKey?: string;
  imageUrl?: string;  // Deprecated: Use imageData instead
  videoUrl?: string;  // Deprecated: Use videoData instead
  imageData?: string; // Base64 encoded image data
  videoData?: string; // Base64 encoded video data
  imageMimeType?: string; // MIME type for image (default: image/jpeg)
  videoMimeType?: string; // MIME type for video (default: video/mp4)
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
 *
 *   // Option 1: Send image/video as base64 data (RECOMMENDED)
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
 *   // Option 2: Send image/video URLs (DEPRECATED - use base64 data instead)
 *   "imageUrl": "https://example.com/image.jpg", // deprecated - URL of image
 *   "videoUrl": "https://example.com/video.mp4" // deprecated - URL of video
 * }
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
  try {
    console.log('');
    console.log('================================================================================');
    console.log('🐦 TWEET PUBLISHING REQUEST V2');
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
    console.log('   Image data:', body.imageData ? `${body.imageData.length} chars (base64)` : 'N/A');
    console.log('   Image URL:', body.imageUrl || 'N/A');
    console.log('   Video data:', body.videoData ? `${body.videoData.length} chars (base64)` : 'N/A');
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
    let isHivemind = false;
    let projectId: string | null = null;
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
      const hivemindUser = await getHivemindUserByUsername(body.username);

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
      client = new TwitterApi({
        appKey: consumerKey,
        appSecret: consumerSecret,
        accessToken: userCredentials.accessToken,
        accessSecret: userCredentials.accessTokenSecret,
      } as any);
    }

    // Handle media upload if provided
    let mediaId: string | undefined;

    if (hasImage || hasVideo) {
      let mediaBuffer: Buffer;
      let mediaType: 'image' | 'video';
      let mimeType: string;

      // Handle base64 data
      if (body.imageData || body.videoData) {
        const isImage = !!body.imageData;
        mediaType = isImage ? 'image' : 'video';

        console.log(`📸 Processing ${mediaType} from base64 data...`);

        try {
          // Extract base64 data (handle data URL format if present)
          let base64Data = isImage ? body.imageData! : body.videoData!;
          if (base64Data.includes(',')) {
            // Handle data URL format: "data:image/png;base64,..."
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
          console.log(`   MIME type: ${mimeType}`);
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
      // Handle URL download (deprecated but still supported)
      else {
        const mediaUrl = body.imageUrl || body.videoUrl;
        mediaType = body.imageUrl ? 'image' : 'video';

        console.log(`📸 Downloading ${mediaType} from URL...`);
        console.log('   URL:', mediaUrl);
        console.log('   ⚠️ Note: URL media upload is deprecated. Please use base64 data instead.');

        try {
          mediaBuffer = await downloadMedia(mediaUrl!);
          console.log(`   Downloaded ${mediaBuffer.length} bytes`);
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

      // Upload to Twitter
      console.log(`📤 Uploading ${mediaType} to Twitter...`);
      const uploadStartTime = Date.now();

      try {
        mediaId = await client.v1.uploadMedia(mediaBuffer, {
          mimeType,
        });

        const uploadDuration = Date.now() - uploadStartTime;
        console.log(`   ✅ ${mediaType} uploaded successfully`);
        console.log('   Media ID:', mediaId);
        console.log('   Duration:', `${uploadDuration}ms`);
        console.log('');
      } catch (error: any) {
        console.error(`❌ Failed to upload ${mediaType} to Twitter:`, error.message);
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
    console.log('   Account type:', isHivemind ? 'Hivemind User' : 'Project Bot');
    console.log('   Tweet text preview:', body.text.substring(0, 100) + (body.text.length > 100 ? '...' : ''));
    console.log('   Tweet text length:', body.text.length);
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
    console.log('   URL:', `https://twitter.com/${body.username}/status/${response.data.id}`);
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('');

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