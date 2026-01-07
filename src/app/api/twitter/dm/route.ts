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
  try {
    console.log('');
    console.log('================================================================================');
    console.log('💬 DM SENDING REQUEST');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Parse request body
    const body: DMRequest = await request.json();

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
