/**
 * Project Retweet/Unretweet Endpoint
 *
 * POST: Retweet or unretweet a tweet on behalf of the project's bot
 *
 * This endpoint allows projects to retweet/unretweet tweets
 * using their connected bot account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getProjectById } from '@/lib/db/projects';
import { getBotByProjectId } from '@/lib/db/bots';
import { getTwitterAppByProjectId } from '@/lib/db/twitter-apps';
import { saveRateLimit, extractRateLimit, EndpointType } from '@/lib/services/rate-limit-tracker';
import { refreshAccessToken, isTokenExpired, calculateExpirationDate } from '@/lib/twitter/oauth2';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface RetweetRequest {
  tweetId: string;
  action?: 'retweet' | 'unretweet';
}

/**
 * POST: Retweet or unretweet a tweet
 *
 * Request body:
 * {
 *   "tweetId": "1234567890",
 *   "action": "retweet" // or "unretweet" (default: "retweet")
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "action": "retweet",
 *   "tweetId": "1234567890"
 * }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let params: { id: string } | undefined;
  let body: RetweetRequest | undefined;

  try {
    params = await context.params;

    console.log('');
    console.log('================================================================================');
    console.log('🔄 PROJECT RETWEET REQUEST');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   Project ID:', params.id);
    console.log('');

    // Parse request body
    body = await request.json();

    console.log('📋 Request details:');
    console.log('   Tweet ID:', body?.tweetId);
    console.log('   Action:', body?.action || 'retweet');
    console.log('');

    // Validate request
    if (!body?.tweetId) {
      console.log('❌ Missing tweetId');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'tweetId is required' },
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

    // Get project
    const project = await getProjectById(params.id);

    if (!project) {
      console.log('❌ Project not found');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Verify API key
    if (project.apiKey !== apiKey) {
      console.log('❌ Invalid API key');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Check if project has API access
    if (!project.apiEnabled) {
      console.log('❌ API disabled for this project');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'API access is disabled for this project. Please enable it in the project settings.' },
        { status: 403 }
      );
    }

    // Get bot for this project
    const bot = await getBotByProjectId(params.id);

    if (!bot) {
      console.log('❌ No bot connected to this project');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'No bot account connected. Please connect a Twitter account first.' },
        { status: 400 }
      );
    }

    console.log('✅ Bot found:', bot.username);
    console.log('');

    // Get Twitter API credentials from the project's TwitterApp
    const twitterApp = await getTwitterAppByProjectId(params.id);
    if (!twitterApp) {
      console.log('❌ Project has no TwitterApp configured');
      console.log('================================================================================');
      console.log('');
      return NextResponse.json(
        { error: 'Project TwitterApp not configured. Please assign a Twitter App to this project.' },
        { status: 500 }
      );
    }

    // Check if OAuth 2.0 token is expired and refresh if needed
    let oauth2Token = bot.oauth2AccessToken;

    if (oauth2Token && isTokenExpired(bot.expiresAt)) {
      console.log('⏰ OAuth 2.0 token expired, attempting refresh...');

      if (bot.refreshToken && twitterApp.clientId && twitterApp.clientSecret) {
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

          oauth2Token = refreshedTokens.accessToken;
          console.log('✅ Token refreshed successfully');
        } catch (error) {
          console.error('❌ Failed to refresh token:', error);
          return NextResponse.json({ error: 'Failed to refresh authentication token' }, { status: 401 });
        }
      }
    }

    // Create Twitter client with OAuth 2.0
    if (!oauth2Token) {
      return NextResponse.json({ error: 'No valid OAuth 2.0 token found' }, { status: 500 });
    }

    console.log('🔐 Using OAuth 2.0 for retweet operation');
    const client = new TwitterApi(oauth2Token);

    // Perform the retweet or unretweet action
    const action = body?.action || 'retweet';
    const startTime = Date.now();

    try {
      let result;
      const v2Client = client.v2;

      if (action === 'unretweet') {
        console.log('↩️ Attempting to unretweet tweet:', body!.tweetId);
        result = await v2Client.unretweet(bot.userId, body!.tweetId);
        console.log('✅ Unretweet successful');
      } else {
        console.log('🔄 Attempting to retweet tweet:', body!.tweetId);
        result = await v2Client.retweet(bot.userId, body!.tweetId);
        console.log('✅ Retweet successful');
      }

      const duration = Date.now() - startTime;

      // Save rate limit information
      const rateLimitInfo = extractRateLimit(result);
      if (rateLimitInfo) {
        await saveRateLimit(
          {
            projectId: project.id,
            accountId: bot.userId,
            accountUsername: bot.username,
            endpoint: action === 'unretweet' ? 'DELETE /2/users/:id/retweets/:source_tweet_id' : 'POST /2/users/:id/retweets',
            endpointType: EndpointType.RETWEET,
          },
          rateLimitInfo
        );
      }

      console.log('');
      console.log('✅ RETWEET OPERATION COMPLETED');
      console.log('────────────────────────────────────────────────────────────────────────────────');
      console.log('   Action:', action);
      console.log('   Tweet ID:', body!.tweetId);
      console.log('   Duration:', `${duration}ms`);
      console.log('────────────────────────────────────────────────────────────────────────────────');
      console.log('');
      console.log('================================================================================');
      console.log('');

      return NextResponse.json({
        success: true,
        action,
        tweetId: body!.tweetId,
        result: result.data,
      });
    } catch (twitterError: any) {
      console.error('❌ Twitter API error:', twitterError);

      // Handle rate limit error (429)
      if (twitterError?.code === 429 || twitterError?.status === 429) {
        console.error('⚠️ Rate limit exceeded for retweet endpoint');

        // Extract rate limit info if available
        const rateLimitInfo = twitterError?.rateLimit || {};
        const resetTime = rateLimitInfo.reset ? new Date(rateLimitInfo.reset * 1000).toISOString() : 'unknown';

        // Save rate limit information even on error
        if (rateLimitInfo.limit && rateLimitInfo.reset && bot && project) {
          try {
            await saveRateLimit(
              {
                projectId: project.id,
                accountId: bot.userId,
                accountUsername: bot.username,
                endpoint: action === 'unretweet' ? 'DELETE /2/users/:id/retweets/:source_tweet_id' : 'POST /2/users/:id/retweets',
                endpointType: EndpointType.RETWEET,
              },
              {
                limit: rateLimitInfo.limit || 50,
                remaining: 0,
                reset: rateLimitInfo.reset
              }
            );
            console.log('💾 Rate limit saved to database despite error');
          } catch (saveError) {
            console.error('❌ Failed to save rate limit:', saveError);
          }
        }

        return NextResponse.json({
          error: 'Rate limit exceeded. Too many retweet requests.',
          details: {
            message: 'Twitter API rate limit reached for retweets. Please wait before trying again.',
            resetAt: resetTime,
            limit: rateLimitInfo.limit || 50,
            remaining: 0,
            retryAfter: rateLimitInfo.reset ? Math.max(0, rateLimitInfo.reset - Math.floor(Date.now() / 1000)) : 900,
            endpoint: 'retweets'
          }
        }, { status: 429 });
      }

      // Handle specific Twitter API errors
      if (twitterError?.code === 327) {
        return NextResponse.json({
          error: 'You have already retweeted this Tweet.',
          details: {
            message: 'This tweet has already been retweeted by this bot.',
            tweetId: body!.tweetId,
            action: action
          }
        }, { status: 400 });
      }

      if (twitterError?.errors?.[0]) {
        const errorDetail = twitterError.errors[0];
        return NextResponse.json({
          error: errorDetail.message || 'Twitter API error',
          code: errorDetail.code,
        }, { status: 400 });
      }

      throw twitterError;
    }
  } catch (error: any) {
    console.error('❌ Error in project retweet endpoint:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      projectId: params?.id,
      tweetId: body?.tweetId
    });

    // Return more detailed error in development
    const errorResponse = {
      error: 'Failed to process retweet action',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        name: error.name
      } : undefined
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}