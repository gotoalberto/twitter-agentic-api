/**
 * Twitter User Information Endpoint
 *
 * POST: Get detailed information about a Twitter user by handle
 *
 * This endpoint allows external applications to retrieve user information
 * including followers, account age, and other profile details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface UserRequest {
  handle: string; // Twitter handle (with or without @)
}

/**
 * POST: Get Twitter user information
 *
 * Request body:
 * {
 *   "handle": "@username" or "username"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "user": {
 *     "id": "1234567890",
 *     "username": "username",
 *     "name": "Display Name",
 *     "description": "User bio...",
 *     "created_at": "2013-12-14T04:35:55.000Z",
 *     "account_age_days": 4025,
 *     "followers_count": 1234,
 *     "following_count": 567,
 *     "tweet_count": 8901,
 *     "verified": false,
 *     "verified_type": "blue" | "business" | "government" | null,
 *     "protected": false,
 *     "profile_image_url": "https://...",
 *     "url": "https://twitter.com/username"
 *   }
 * }
 *
 * Authentication:
 * - Requires X-API-Key header with valid API key from any registered project
 * - Any valid project API key can access this endpoint
 */
export async function POST(request: NextRequest) {
  try {
    console.log('');
    console.log('================================================================================');
    console.log('👤 TWITTER USER LOOKUP REQUEST');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Parse request body
    const body: UserRequest = await request.json();

    console.log('📋 Request details:');
    console.log('   Handle:', body.handle);
    console.log('');

    // Validate request
    if (!body.handle) {
      console.log('❌ Missing handle');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'handle is required' },
        { status: 400 }
      );
    }

    // Clean handle (remove @ if present)
    const cleanHandle = body.handle.startsWith('@')
      ? body.handle.substring(1)
      : body.handle;

    console.log('   Clean handle:', cleanHandle);
    console.log('');

    // Validate API key
    console.log('🔐 Validating API key...');
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

    // Check if API key is valid (matches any project)
    const project = await prisma.project.findFirst({
      where: {
        apiKey: apiKey,
      },
      include: {
        bot: true,
      },
    });

    if (!project) {
      console.log('❌ Invalid API key');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    console.log('✅ API key validated');
    console.log('   Project:', project.name);
    console.log('');

    // Check if project has a connected bot (required for Twitter API access)
    if (!project.bot) {
      console.log('❌ Project has no connected bot');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Project must have a connected bot to access Twitter API' },
        { status: 400 }
      );
    }

    console.log('✅ Bot found:', project.bot.username);
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

    // Create Twitter client with OAuth 1.0a using the bot's credentials
    console.log('🔑 Initializing Twitter client...');
    const client = new TwitterApi({
      appKey: consumerKey,
      appSecret: consumerSecret,
      accessToken: project.bot.accessToken,
      accessSecret: project.bot.accessTokenSecret,
    });

    // Fetch user information from Twitter API
    console.log('🔍 Fetching user information from Twitter...');
    const startTime = Date.now();

    const userResponse = await client.v2.userByUsername(cleanHandle, {
      'user.fields': [
        'id',
        'name',
        'username',
        'created_at',
        'description',
        'public_metrics',
        'verified',
        'verified_type',
        'protected',
        'profile_image_url',
        'url',
      ],
    });

    const duration = Date.now() - startTime;

    if (!userResponse.data) {
      console.log('❌ User not found');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: `User not found: @${cleanHandle}` },
        { status: 404 }
      );
    }

    const user = userResponse.data;

    // Calculate account age in days
    const createdAt = user.created_at ? new Date(user.created_at) : null;
    const accountAgeDays = createdAt
      ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    console.log('');
    console.log('✅ USER INFORMATION RETRIEVED');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('   User ID:', user.id);
    console.log('   Username:', user.username);
    console.log('   Name:', user.name);
    console.log('   Created:', user.created_at || 'N/A');
    console.log('   Account age:', accountAgeDays ? `${accountAgeDays} days` : 'N/A');
    console.log('   Followers:', user.public_metrics?.followers_count || 0);
    console.log('   Following:', user.public_metrics?.following_count || 0);
    console.log('   Tweets:', user.public_metrics?.tweet_count || 0);
    console.log('   Verified:', user.verified || false);
    console.log('   Protected:', user.protected || false);
    console.log('   Duration:', `${duration}ms`);
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('');

    console.log('================================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        description: user.description || null,
        created_at: user.created_at || null,
        account_age_days: accountAgeDays,
        followers_count: user.public_metrics?.followers_count || 0,
        following_count: user.public_metrics?.following_count || 0,
        tweet_count: user.public_metrics?.tweet_count || 0,
        verified: user.verified || false,
        verified_type: user.verified_type || null,
        protected: user.protected || false,
        profile_image_url: user.profile_image_url || null,
        url: `https://twitter.com/${user.username}`,
      },
    });
  } catch (error: any) {
    console.error('❌ USER LOOKUP ERROR');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);

    // Check for specific Twitter API errors
    if (error.code === 403) {
      console.error('   Reason: Forbidden - check bot permissions');
    } else if (error.code === 401) {
      console.error('   Reason: Unauthorized - check bot credentials');
    } else if (error.code === 429) {
      console.error('   Reason: Rate limit exceeded');
    } else if (error.code === 404) {
      console.error('   Reason: User not found');
    }

    console.log('================================================================================');
    console.log('');

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch user information',
      },
      { status: error.code || 500 }
    );
  }
}
