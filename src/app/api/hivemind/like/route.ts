import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getHivemindUserById } from '@/lib/db/hivemind';
import { decrypt } from '@/lib/utils/encryption';
import { saveRateLimit, extractRateLimit, EndpointType } from '@/lib/services/rate-limit-tracker';
import { refreshAccessToken, isTokenExpired } from '@/lib/twitter/oauth2';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface LikeRequest {
  userId: string;
  tweetId: string;
  action?: 'like' | 'unlike';
}

/**
 * POST: Like or unlike a tweet from a Hivemind user
 *
 * Request body:
 * {
 *   "userId": "hivemind_user_id",
 *   "tweetId": "1234567890",
 *   "action": "like" // or "unlike" (default: "like")
 * }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('');
    console.log('================================================================================');
    console.log('❤️ HIVEMIND LIKE REQUEST');
    console.log('================================================================================');
    console.log('   Timestamp:', new Date().toISOString());

    // Parse request body
    const body: LikeRequest = await request.json();

    console.log('📋 Request details:');
    console.log('   User ID:', body.userId);
    console.log('   Tweet ID:', body.tweetId);
    console.log('   Action:', body.action || 'like');
    console.log('');

    // Validate request
    if (!body.userId || !body.tweetId) {
      return NextResponse.json(
        { error: 'userId and tweetId are required' },
        { status: 400 }
      );
    }

    // Get API key from headers
    const apiKey = request.headers.get('x-api-key');

    if (!apiKey || !apiKey.startsWith('hm_')) {
      return NextResponse.json(
        { error: 'Invalid Hivemind API key' },
        { status: 401 }
      );
    }

    // Verify Hivemind API key
    const hivemindConfig = await prisma.hivemindConfig.findFirst();
    if (!hivemindConfig || hivemindConfig.apiKey !== apiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Get Hivemind user
    const user = await getHivemindUserById(body.userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('✅ User found:', user.username);

    // Check if OAuth 2.0 token needs refresh
    let accessToken = user.oauth2AccessToken;

    if (accessToken && user.expiresAt) {
      if (isTokenExpired(user.expiresAt)) {
        console.log('🔄 OAuth 2.0 token expired, attempting to refresh...');

        if (user.refreshToken) {
          const hivemindConfig = await prisma.hivemindConfig.findFirst({
            include: { twitterApp: true }
          });

          if (hivemindConfig?.twitterApp?.clientId && hivemindConfig?.twitterApp?.clientSecret) {
            try {
              const refreshResult = await refreshAccessToken({
                refreshToken: user.refreshToken,
                clientId: hivemindConfig.twitterApp.clientId,
                clientSecret: hivemindConfig.twitterApp.clientSecret
              });

              // Update user with new tokens
              await prisma.hivemindUser.update({
                where: { userId: user.userId },
                data: {
                  oauth2AccessToken: refreshResult.accessToken,
                  refreshToken: refreshResult.refreshToken || user.refreshToken,
                  expiresAt: new Date(Date.now() + refreshResult.expiresIn * 1000),
                  scope: refreshResult.scope,
                  lastActiveAt: new Date(),
                },
              });

              accessToken = refreshResult.accessToken;
              console.log('✅ Token refreshed successfully');
            } catch (error) {
              console.error('❌ Failed to refresh token:', error);
              accessToken = null;
            }
          }
        }
      }
    }

    // Initialize Twitter client
    let client: TwitterApi;

    if (accessToken) {
      // Use OAuth 2.0
      console.log('🔑 Using OAuth 2.0 for like operation');
      client = new TwitterApi(accessToken);
    } else if (user.accessToken && user.accessTokenSecret) {
      // Fallback to OAuth 1.0a
      console.log('🔑 Using OAuth 1.0a for like operation');

      const hivemindConfig = await prisma.hivemindConfig.findFirst({
        include: { twitterApp: true }
      });

      if (!hivemindConfig?.twitterApp?.consumerKey || !hivemindConfig?.twitterApp?.consumerSecret) {
        return NextResponse.json(
          { error: 'Twitter API credentials not configured' },
          { status: 500 }
        );
      }

      const decryptedAccessToken = await decrypt(user.accessToken);
      const decryptedAccessTokenSecret = await decrypt(user.accessTokenSecret);

      client = new TwitterApi({
        appKey: hivemindConfig.twitterApp.consumerKey,
        appSecret: hivemindConfig.twitterApp.consumerSecret,
        accessToken: decryptedAccessToken,
        accessSecret: decryptedAccessTokenSecret,
      });
    } else {
      return NextResponse.json(
        { error: 'No valid authentication method available' },
        { status: 400 }
      );
    }

    const action = body.action || 'like';

    try {
      // Get tweet details first (for logging)
      let tweetText = '';
      let tweetAuthor = '';
      let tweetUrl = '';

      try {
        const tweet = await client.v2.singleTweet(body.tweetId, {
          'tweet.fields': ['author_id', 'text'],
          'user.fields': ['username'],
          expansions: ['author_id']
        });

        if (tweet.data) {
          tweetText = tweet.data.text || '';
          const author = tweet.includes?.users?.find(u => u.id === tweet.data.author_id);
          tweetAuthor = author?.username || 'unknown';
          tweetUrl = `https://twitter.com/${tweetAuthor}/status/${body.tweetId}`;
        }
      } catch (error) {
        console.log('⚠️ Could not fetch tweet details for logging');
        tweetUrl = `https://twitter.com/i/status/${body.tweetId}`;
      }

      // Perform the like/unlike action
      const response = action === 'unlike'
        ? await client.v2.unlike(user.userId, body.tweetId)
        : await client.v2.like(user.userId, body.tweetId);

      // Log the action to the database
      if (action === 'like' && response.data?.liked) {
        await prisma.hivemindAction.create({
          data: {
            userId: user.userId,
            username: user.username,
            displayName: user.displayName,
            actionType: 'like',
            tweetId: body.tweetId,
            tweetAuthor,
            tweetText: tweetText.substring(0, 280), // Limit to 280 chars
            tweetUrl,
          },
        });
        console.log('📝 Like action logged to database');
      }

      // Extract and save rate limit info
      const rateLimit = extractRateLimit(response);
      if (rateLimit) {
        await saveRateLimit(
          {
            hivemindUserId: user.userId,
            accountId: user.userId,
            accountUsername: user.username,
            endpoint: 'likes',
            endpointType: EndpointType.LIKE,
          },
          rateLimit
        );
      }

      // Update last active time
      await prisma.hivemindUser.update({
        where: { userId: user.userId },
        data: { lastActiveAt: new Date() }
      });

      console.log(`✅ Tweet ${action}d successfully`);
      console.log('================================================================================');
      console.log('');

      return NextResponse.json({
        success: true,
        action,
        tweetId: body.tweetId,
        user: {
          id: user.userId,
          username: user.username,
        },
      });

    } catch (error: any) {
      console.error(`❌ Failed to ${action} tweet:`, error);

      // Extract rate limit from error response if available
      if (error.rateLimit) {
        await saveRateLimit(
          {
            hivemindUserId: user.userId,
            accountId: user.userId,
            accountUsername: user.username,
            endpoint: 'likes',
            endpointType: EndpointType.LIKE,
          },
          error.rateLimit
        );
      }

      const errorMessage = error.message || `Failed to ${action} tweet`;
      const statusCode = error.code === 429 ? 429 : 500;

      console.log('================================================================================');
      console.log('');

      return NextResponse.json(
        {
          error: errorMessage,
          details: error.data?.detail || undefined
        },
        { status: statusCode }
      );
    }

  } catch (error: any) {
    console.error('❌ Like request failed:', error);
    console.log('================================================================================');
    console.log('');

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}