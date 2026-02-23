/**
 * Twitter Direct Message (DM) Endpoint
 *
 * POST: Send a direct message on behalf of a connected bot
 *
 * This endpoint allows external applications to send DMs
 * without managing Twitter credentials themselves.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getBotByUsername } from '@/lib/db/bots';
import { getProjectById } from '@/lib/db/projects';
import { getTwitterAppByProjectId } from '@/lib/db/twitter-apps';
import { saveRateLimit, extractRateLimit, EndpointType } from '@/lib/services/rate-limit-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface DMRequest {
  username: string;
  recipientId: string;
  text: string;
}

/**
 * POST: Send a direct message
 *
 * Request body:
 * {
 *   "username": "bot_handle",
 *   "recipientId": "1234567890",
 *   "text": "Message text"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "dm": {
 *     "id": "1234567890",
 *     "text": "Message text",
 *     "recipientId": "1234567890"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  let body: DMRequest = {} as DMRequest; // Initialize with empty object
  let bot: any;
  let project: any;

  try {
    console.log('');
    console.log('================================================================================');
    console.log('💬 DM SENDING REQUEST');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Parse request body
    body = await request.json();

    console.log('📋 Request details:');
    console.log('   Username:', body.username);
    console.log('   Recipient ID:', body.recipientId);
    console.log('   Text length:', body.text?.length || 0);
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

    if (!body.recipientId) {
      console.log('❌ Missing recipientId');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'recipientId is required' },
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

    if (body.text.length > 10000) {
      console.log('❌ Text too long:', body.text.length, 'characters');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'text must be 10000 characters or less' },
        { status: 400 }
      );
    }

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

    // Validate API key
    console.log('🔐 Validating API key...');
    const apiKey = request.headers.get('x-api-key');

    // Get project to check API key
    project = await getProjectById(bot.projectId);

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

    const consumerKey = twitterApp.consumerKey;
    const consumerSecret = twitterApp.consumerSecret;
    console.log('🔑 Using credentials from TwitterApp:', twitterApp.name);

    // Create Twitter client with OAuth 1.0a
    console.log('🔑 Initializing Twitter client...');
    const client = new TwitterApi({
      appKey: consumerKey,
      appSecret: consumerSecret,
      accessToken: bot.accessToken,
      accessSecret: bot.accessTokenSecret,
    } as any);

    // Send DM
    console.log('📤 Sending direct message...');
    const startTime = Date.now();

    const response = await client.v2.sendDmToParticipant(body.recipientId, {
      text: body.text,
    });

    const duration = Date.now() - startTime;

    console.log('');
    console.log('✅ DM SENT SUCCESSFULLY');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('   DM ID:', response.dm_event_id);
    console.log('   Recipient ID:', body.recipientId);
    console.log('   Duration:', `${duration}ms`);
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('');

    // Save rate limit information
    const rateLimitInfo = extractRateLimit(response);
    if (rateLimitInfo) {
      await saveRateLimit(
        {
          projectId: project.id,
          accountId: bot.userId,
          accountUsername: bot.username,
          endpoint: 'POST /2/dm_conversations/with/:participant_id/messages',
          endpointType: EndpointType.DM,
        },
        rateLimitInfo
      );
    }

    console.log('================================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      dm: {
        id: response.dm_event_id,
        text: body.text,
        recipientId: body.recipientId,
      },
    });
  } catch (error: any) {
    console.error('❌ DM SENDING ERROR');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);

    // Check for specific Twitter API errors
    if (error.code === 403) {
      console.error('   Reason: Forbidden - check bot permissions or if recipient allows DMs');
    } else if (error.code === 401) {
      console.error('   Reason: Unauthorized - check bot credentials');
    } else if (error.code === 429) {
      console.error('   Reason: Rate limit exceeded');

      // Extract rate limit info if available
      const rateLimitInfo = error?.rateLimit || {};
      const resetTime = rateLimitInfo.reset ? new Date(rateLimitInfo.reset * 1000).toISOString() : 'unknown';

      console.error('📊 Rate limit details:', {
        limit: rateLimitInfo.limit || 'unknown',
        remaining: rateLimitInfo.remaining || 0,
        reset: resetTime,
        endpoint: 'POST /2/dm_conversations/with/:participant_id/messages'
      });

      // Save rate limit information even on error
      if (rateLimitInfo.limit && rateLimitInfo.reset && bot && project) {
        try {
          await saveRateLimit(
            {
              projectId: project.id,
              accountId: bot.userId,
              accountUsername: bot.username,
              endpoint: 'POST /2/dm_conversations/with/:participant_id/messages',
              endpointType: EndpointType.DM,
            },
            {
              limit: rateLimitInfo.limit || 1000,
              remaining: 0, // When we hit 429, remaining is always 0
              reset: rateLimitInfo.reset
            }
          );
          console.log('💾 Rate limit saved to database despite error');
        } catch (saveError) {
          console.error('❌ Failed to save rate limit:', saveError);
        }
      }

      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Too many DM requests.',
          details: {
            message: 'Twitter API rate limit reached for DMs. Please wait before trying again.',
            resetAt: resetTime,
            limit: rateLimitInfo.limit || 1000,
            remaining: 0,
            retryAfter: rateLimitInfo.reset ? Math.max(0, rateLimitInfo.reset - Math.floor(Date.now() / 1000)) : 900,
            endpoint: 'dm'
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
        error: error.message || 'Failed to send DM',
      },
      { status: error.code || 500 }
    );
  }
}
