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
  imageUrl?: string; // Optional image URL to attach to tweet
  videoUrl?: string; // Optional video URL to attach to tweet
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
 *   "imageUrl": "https://example.com/image.jpg", // optional - URL of image to attach
 *   "videoUrl": "https://example.com/video.mp4" // optional - URL of video to attach
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
 * - imageUrl and videoUrl are optional parameters
 * - If provided, media is downloaded and uploaded to Twitter
 * - Media is attached to the tweet (not as URL in text)
 * - Only one media type per tweet (image OR video, not both)
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
    if (body.imageUrl && body.videoUrl) {
      console.log('❌ Cannot include both image and video');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Cannot include both imageUrl and videoUrl - choose one' },
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

    // Get Twitter API credentials
    const consumerKey = process.env.TWITTER_OAUTH_API_KEY;
    const consumerSecret = process.env.TWITTER_OAUTH_API_SECRET;

    if (!consumerKey || !consumerSecret) {
      console.log('❌ Missing Twitter API credentials');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Twitter API credentials not configured' },
        { status: 500 }
      );
    }

    // Create Twitter client with OAuth 1.0a
    console.log('🔑 Initializing Twitter client...');
    const client = new TwitterApi({
      appKey: consumerKey,
      appSecret: consumerSecret,
      accessToken: bot.accessToken,
      accessSecret: bot.accessTokenSecret,
    });

    // Handle media upload if provided
    let mediaId: string | undefined;

    if (body.imageUrl || body.videoUrl) {
      const mediaUrl = body.imageUrl || body.videoUrl;
      const mediaType = body.imageUrl ? 'image' : 'video';

      console.log(`📸 Downloading ${mediaType} from URL...`);
      console.log('   URL:', mediaUrl);

      try {
        const mediaBuffer = await downloadMedia(mediaUrl!);
        console.log(`   Downloaded ${mediaBuffer.length} bytes`);

        console.log(`📤 Uploading ${mediaType} to Twitter...`);
        const uploadStartTime = Date.now();

        mediaId = await client.v1.uploadMedia(mediaBuffer, {
          mimeType: mediaType === 'image' ? 'image/jpeg' : 'video/mp4',
        });

        const uploadDuration = Date.now() - uploadStartTime;
        console.log(`   ✅ ${mediaType} uploaded successfully`);
        console.log('   Media ID:', mediaId);
        console.log('   Duration:', `${uploadDuration}ms`);
        console.log('');
      } catch (error: any) {
        console.error(`❌ Failed to upload ${mediaType}:`, error.message);
        console.log('================================================================================');
        console.log('');
        return NextResponse.json(
          { error: `Failed to upload ${mediaType}: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // Publish tweet
    console.log('📤 Publishing tweet...');
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
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);

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
