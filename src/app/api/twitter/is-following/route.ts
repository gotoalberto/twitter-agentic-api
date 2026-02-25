/**
 * Twitter Is Following Check Endpoint
 *
 * GET: Check if a user follows another user on Twitter
 *
 * This endpoint iterates through all users that userA follows to determine
 * if userB is in that list. Handles pagination automatically.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { prisma } from '@/lib/db/prisma';
import { getTwitterAppByProjectId } from '@/lib/db/twitter-apps';
import { getTwitterApiIoClient } from '@/lib/twitter-api-io/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET: Check if userA follows userB
 *
 * Query parameters:
 * - userA: Twitter username to check (WITHOUT @) - REQUIRED
 * - userB: Twitter username to check if followed (WITHOUT @) - REQUIRED
 *
 * Example:
 * GET /api/twitter/is-following?userA=gotoalberto&userB=elonmusk
 *
 * Response:
 * {
 *   "success": true,
 *   "userA": "gotoalberto",
 *   "userB": "elonmusk",
 *   "isFollowing": true
 * }
 *
 * Authentication:
 * - Requires X-API-Key header with valid API key from any registered project
 */
export async function GET(request: NextRequest) {
  try {
    console.log('');
    console.log('================================================================================');
    console.log('🔍 TWITTER IS-FOLLOWING CHECK REQUEST');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('');

    // Get handles from query parameters
    const { searchParams } = new URL(request.url);
    const userA = searchParams.get('userA');
    const userB = searchParams.get('userB');

    console.log('📋 Request details:');
    console.log('   UserA:', userA);
    console.log('   UserB:', userB);
    console.log('');

    // Validate request
    if (!userA || !userB) {
      console.log('❌ Missing parameters');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'userA and userB query parameters are required' },
        { status: 400 }
      );
    }

    // Validate handles don't contain @
    if (userA.includes('@') || userB.includes('@')) {
      console.log('❌ Handle contains @ symbol');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'handles must be usernames only (without @ symbol)' },
        { status: 400 }
      );
    }

    console.log('   UserA:', userA);
    console.log('   UserB:', userB);
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

    // Use TwitterAPI.io for checking following relationship
    console.log('🔑 Using TwitterAPI.io for is-following check...');
    const startTime = Date.now();

    try {
      const twitterApiIoClient = getTwitterApiIoClient();

      // Check if userA follows userB directly with TwitterAPI.io
      console.log('🔍 Checking follow relationship via TwitterAPI.io...');
      const isFollowing = await twitterApiIoClient.checkFollowRelationship(userA, userB);

      const duration = Date.now() - startTime;

      console.log('');
      console.log('✅ IS-FOLLOWING CHECK COMPLETED');
      console.log('────────────────────────────────────────────────────────────────────────────────');
      console.log(`   User A: @${userA}`);
      console.log(`   User B: @${userB}`);
      console.log(`   Is Following: ${isFollowing}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Method: TwitterAPI.io (optimized)`);
      console.log('────────────────────────────────────────────────────────────────────────────────');
      console.log('');

      console.log('================================================================================');
      console.log('');

      return NextResponse.json({
        success: true,
        userA: userA,
        userB: userB,
        isFollowing: isFollowing,
        meta: {
          durationMs: duration,
          method: 'twitterapi.io',
        },
      });
    } catch (innerError: any) {
      // Fallback to Twitter API if TwitterAPI.io fails
      console.log('⚠️ TwitterAPI.io failed, falling back to Twitter API...');
      console.error('   TwitterAPI.io error:', innerError.message);

      // Get Twitter API credentials from the project's TwitterApp
      const twitterApp = await getTwitterAppByProjectId(project.id);
      if (!twitterApp) {
        throw new Error('Project TwitterApp not configured');
      }

      // Create Twitter client with OAuth 1.0a
      const client = new TwitterApi({
        appKey: twitterApp.consumerKey,
        appSecret: twitterApp.consumerSecret,
        accessToken: project.bot.accessToken,
        accessSecret: project.bot.accessTokenSecret,
      } as any);

      // Get user IDs for both users
      const [userAResponse, userBResponse] = await Promise.all([
        client.v2.userByUsername(userA),
        client.v2.userByUsername(userB),
      ]);

      if (!userAResponse.data) {
        throw new Error(`User not found: ${userA}`);
      }

      if (!userBResponse.data) {
        throw new Error(`User not found: ${userB}`);
      }

      const userAId = userAResponse.data.id;
      const userBId = userBResponse.data.id;

      console.log(`✅ User A: @${userA} (ID: ${userAId})`);
      console.log(`✅ User B: @${userB} (ID: ${userBId})`);

      // Iterate through userA's following list
      let isFollowing = false;
      let nextToken: string | undefined = undefined;
      let totalChecked = 0;
      let iterations = 0;

      do {
        iterations++;
        console.log(`   Iteration ${iterations}: Checking batch of users...`);

        const followingResponse: any = await client.v2.following(userAId, {
          max_results: 1000,
          pagination_token: nextToken,
        });

        const batchSize = followingResponse.data?.length || 0;
        totalChecked += batchSize;

        console.log(`   Checked ${batchSize} users (total: ${totalChecked})`);

        if (followingResponse.data) {
          isFollowing = followingResponse.data.some((user: any) => user.id === userBId);
          if (isFollowing) {
            console.log(`   ✅ Found! User A follows User B`);
            break;
          }
        }

        nextToken = followingResponse.meta.next_token;
        if (!nextToken) {
          console.log(`   ❌ Not found. User A does not follow User B`);
          break;
        }
      } while (nextToken && !isFollowing);

      const duration = Date.now() - startTime;

      console.log('');
      console.log('✅ IS-FOLLOWING CHECK COMPLETED (via Twitter API fallback)');
      console.log('────────────────────────────────────────────────────────────────────────────────');
      console.log(`   User A: @${userA}`);
      console.log(`   User B: @${userB}`);
      console.log(`   Is Following: ${isFollowing}`);
      console.log(`   Total users checked: ${totalChecked}`);
      console.log(`   Iterations: ${iterations}`);
      console.log(`   Duration: ${duration}ms`);
      console.log('────────────────────────────────────────────────────────────────────────────────');
      console.log('');

      console.log('================================================================================');
      console.log('');

      return NextResponse.json({
        success: true,
        userA: userA,
        userB: userB,
        isFollowing: isFollowing,
        meta: {
          totalChecked: totalChecked,
          iterations: iterations,
          durationMs: duration,
          method: 'twitter-api-fallback',
        },
      });
    }
  } catch (error: any) {
    console.error('❌ IS-FOLLOWING CHECK ERROR');
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
        error: error.message || 'Failed to check is-following status',
      },
      { status: error.code || 500 }
    );
  }
}
