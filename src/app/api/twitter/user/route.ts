/**
 * Twitter User Information Endpoint
 *
 * GET: Get detailed information about a Twitter user by handle
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

/**
 * GET: Get Twitter user information
 *
 * Query parameters:
 * - handle: Twitter username (WITHOUT @) - REQUIRED
 *
 * Example:
 * GET /api/twitter/user?handle=elonmusk
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
 *     "url": "https://twitter.com/username",
 *     "following": [
 *       {
 *         "id": "9876543210",
 *         "username": "followeduser",
 *         "name": "Followed User",
 *         "description": "Bio...",
 *         "followers_count": 1000,
 *         "following_count": 500,
 *         "tweet_count": 5000,
 *         "verified": true,
 *         "verified_type": "blue",
 *         "profile_image_url": "https://..."
 *       }
 *     ],
 *     "total_following": 567,
 *     "following_next_token": "ABCD1234..." | null
 *   }
 * }
 *
 * Authentication:
 * - Requires X-API-Key header with valid API key from any registered project
 * - Any valid project API key can access this endpoint
 */
export async function GET(request: NextRequest) {
  try {
    console.log('');
    console.log('================================================================================');
    console.log('👤 TWITTER USER LOOKUP REQUEST');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Get handle from query parameters
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');

    console.log('📋 Request details:');
    console.log('   Handle:', handle);
    console.log('');

    // Validate request
    if (!handle) {
      console.log('❌ Missing handle');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'handle query parameter is required' },
        { status: 400 }
      );
    }

    // Validate handle doesn't contain @
    if (handle.includes('@')) {
      console.log('❌ Handle contains @ symbol');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'handle must be username only (without @ symbol)' },
        { status: 400 }
      );
    }

    console.log('   Username:', handle);
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

    // Get Twitter API credentials from the project's TwitterApp
    const { getTwitterAppByProjectId } = await import('@/lib/db/twitter-apps');
    const twitterApp = await getTwitterAppByProjectId(project.id);

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

    // Create Twitter client with OAuth 1.0a using the bot's credentials
    console.log('🔑 Initializing Twitter client...');

    // Bot credentials are stored in plain text
    const client = new TwitterApi({
      appKey: consumerKey,
      appSecret: consumerSecret,
      accessToken: project.bot.accessToken,
      accessSecret: project.bot.accessTokenSecret,
    } as any);

    // Fetch user information from Twitter API
    console.log('🔍 Fetching user information from Twitter...');
    const startTime = Date.now();

    const userResponse = await client.v2.userByUsername(handle, {
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
        { error: `User not found: ${handle}` },
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

    // Fetch following list
    console.log('🔍 Fetching following list...');
    const followingStartTime = Date.now();

    const followingResponse = await client.v2.following(user.id, {
      max_results: 100, // Maximum allowed by API
      'user.fields': [
        'id',
        'username',
        'name',
        'description',
        'public_metrics',
        'verified',
        'verified_type',
        'profile_image_url',
      ],
    });

    const followingDuration = Date.now() - followingStartTime;

    const followingList = followingResponse.data?.map(followedUser => ({
      id: followedUser.id,
      username: followedUser.username,
      name: followedUser.name,
      description: followedUser.description || null,
      followers_count: followedUser.public_metrics?.followers_count || 0,
      following_count: followedUser.public_metrics?.following_count || 0,
      tweet_count: followedUser.public_metrics?.tweet_count || 0,
      verified: followedUser.verified || false,
      verified_type: followedUser.verified_type || null,
      profile_image_url: followedUser.profile_image_url || null,
    })) || [];

    console.log('');
    console.log('✅ FOLLOWING LIST RETRIEVED');
    console.log('────────────────────────────────────────────────────────────────────────────────');
    console.log('   Total following retrieved:', followingList.length);
    console.log('   Pagination available:', !!followingResponse.meta.next_token);
    console.log('   Duration:', `${followingDuration}ms`);
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
        following: followingList,
        total_following: followingList.length,
        following_next_token: followingResponse.meta.next_token || null,
      },
    });
  } catch (error: any) {
    console.error('❌ USER LOOKUP ERROR');
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error type:', error.type);
    console.error('   Error data:', JSON.stringify(error.data || {}, null, 2));
    console.error('   Error errors:', JSON.stringify(error.errors || {}, null, 2));
    console.error('   Error rateLimit:', JSON.stringify(error.rateLimit || {}, null, 2));
    console.error('   Full error object:', JSON.stringify(error, null, 2));
    console.error('   Stack:', error.stack);

    // Check for specific Twitter API errors
    if (error.code === 402) {
      console.error('   ⚠️  ERROR 402: Payment Required');
      console.error('   This usually means:');
      console.error('   - The Twitter API plan has expired or is suspended');
      console.error('   - The bot account is suspended');
      console.error('   - Payment is required for the API tier');
    } else if (error.code === 403) {
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
