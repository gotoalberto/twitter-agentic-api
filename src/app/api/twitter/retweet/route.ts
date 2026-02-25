import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { prisma } from '@/lib/db/prisma';
import { refreshAccessToken, isTokenExpired, calculateExpirationDate } from '@/lib/twitter/oauth2';
import { saveRateLimit, extractRateLimit, EndpointType } from '@/lib/services/rate-limit-tracker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tweetId, action = 'retweet' } = body; // action can be 'retweet' or 'unretweet'

    // Get API key from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid API key' }, { status: 401 });
    }

    const apiKey = authHeader.substring(7);
    console.log('🔑 API Key received:', apiKey.substring(0, 8) + '...');

    // Validate Hivemind API key
    const hivemindConfig = await prisma.hivemindConfig.findFirst();

    if (!hivemindConfig || hivemindConfig.apiKey !== apiKey) {
      console.log('❌ Invalid API key');
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Check if tweet ID is provided
    if (!tweetId) {
      return NextResponse.json({ error: 'Tweet ID is required' }, { status: 400 });
    }

    // Get the Twitter app for Hivemind
    if (!hivemindConfig.twitterAppId) {
      return NextResponse.json({ error: 'Hivemind Twitter app not configured' }, { status: 500 });
    }

    const twitterApp = await prisma.twitterApp.findUnique({
      where: { id: hivemindConfig.twitterAppId }
    });

    if (!twitterApp) {
      return NextResponse.json({ error: 'Twitter app not found' }, { status: 500 });
    }

    // Get a user that has connected to Hivemind (for now, using the first active user)
    const hivemindUser = await prisma.hivemindUser.findFirst({
      where: {
        oauth2AccessToken: { not: null }
      }
    });

    if (!hivemindUser) {
      return NextResponse.json({
        error: 'No active Hivemind user found. Please connect a Twitter account first.'
      }, { status: 400 });
    }

    // Check if OAuth 2.0 token is expired and refresh if needed
    let oauth2Token = hivemindUser.oauth2AccessToken;

    if (oauth2Token && isTokenExpired(hivemindUser.expiresAt)) {
      console.log('⏰ OAuth 2.0 token expired, attempting refresh...');

      if (hivemindUser.refreshToken && twitterApp.clientId && twitterApp.clientSecret) {
        try {
          const refreshedTokens = await refreshAccessToken({
            refreshToken: hivemindUser.refreshToken,
            clientId: twitterApp.clientId,
            clientSecret: twitterApp.clientSecret,
          });

          // Update tokens in database
          const newExpiresAt = calculateExpirationDate(refreshedTokens.expiresIn);
          await prisma.hivemindUser.update({
            where: { userId: hivemindUser.userId },
            data: {
              oauth2AccessToken: refreshedTokens.accessToken,
              refreshToken: refreshedTokens.refreshToken || hivemindUser.refreshToken,
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

    console.log('🔐 Using OAuth 2.0 for retweet');
    const client = new TwitterApi(oauth2Token);

    // Perform the retweet or unretweet action
    try {
      let result;
      const v2Client = client.v2;
      const userId = hivemindUser.userId;

      if (action === 'unretweet') {
        console.log('↩️ Attempting to unretweet tweet:', tweetId);
        result = await v2Client.unretweet(userId, tweetId);
        console.log('✅ Unretweet successful');
      } else {
        console.log('🔄 Attempting to retweet tweet:', tweetId);
        result = await v2Client.retweet(userId, tweetId);
        console.log('✅ Retweet successful');

        // Log the retweet action to HivemindAction table
        if (result.data?.retweeted) {
          try {
            // Try to get tweet details for logging
            let tweetText = '';
            let tweetAuthor = '';
            let tweetUrl = `https://twitter.com/i/status/${tweetId}`;

            try {
              const tweet = await v2Client.singleTweet(tweetId, {
                'tweet.fields': ['author_id', 'text'],
                'user.fields': ['username'],
                expansions: ['author_id']
              });

              if (tweet.data) {
                tweetText = tweet.data.text || '';
                const author = tweet.includes?.users?.find(u => u.id === tweet.data.author_id);
                tweetAuthor = author?.username || 'unknown';
                tweetUrl = `https://twitter.com/${tweetAuthor}/status/${tweetId}`;
              }
            } catch (error) {
              console.log('⚠️ Could not fetch tweet details for logging');
            }

            await prisma.hivemindAction.create({
              data: {
                userId: hivemindUser.userId,
                username: hivemindUser.username,
                displayName: hivemindUser.displayName,
                actionType: 'retweet',
                tweetId,
                tweetAuthor,
                tweetText: tweetText.substring(0, 280), // Limit to 280 chars
                tweetUrl,
              },
            });
            console.log('📝 Retweet action logged to HivemindAction');
          } catch (error) {
            console.error('⚠️ Failed to log retweet action:', error);
            // Continue even if logging fails
          }
        }
      }

      // Save rate limit information
      const rateLimitInfo = extractRateLimit(result);
      if (rateLimitInfo) {
        await saveRateLimit(
          {
            hivemindUserId: hivemindUser.userId,
            accountId: hivemindUser.userId,
            accountUsername: hivemindUser.username,
            endpoint: action === 'unretweet' ? 'DELETE /2/users/:id/retweets/:source_tweet_id' : 'POST /2/users/:id/retweets',
            endpointType: EndpointType.RETWEET,
          },
          rateLimitInfo
        );
      }

      return NextResponse.json({
        success: true,
        action,
        tweetId,
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

        console.error('📊 Rate limit details:', {
          limit: rateLimitInfo.limit || 'unknown',
          remaining: rateLimitInfo.remaining || 0,
          reset: resetTime,
          endpoint: 'POST /2/users/:id/retweets'
        });

        // Save rate limit information even on error
        if (rateLimitInfo.limit && rateLimitInfo.reset) {
          try {
            await saveRateLimit(
              {
                hivemindUserId: hivemindUser.userId,
                accountId: hivemindUser.userId,
                accountUsername: hivemindUser.username,
                endpoint: action === 'unretweet' ? 'DELETE /2/users/:id/retweets/:source_tweet_id' : 'POST /2/users/:id/retweets',
                endpointType: EndpointType.RETWEET,
              },
              {
                limit: rateLimitInfo.limit || 50,
                remaining: 0, // When we hit 429, remaining is always 0
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
            limit: rateLimitInfo.limit || 1000,
            remaining: 0,
            retryAfter: rateLimitInfo.reset ? Math.max(0, rateLimitInfo.reset - Math.floor(Date.now() / 1000)) : 900, // seconds until reset
            endpoint: 'retweets'
          }
        }, { status: 429 });
      }

      // Handle specific Twitter API errors
      if (twitterError?.code === 327) {
        return NextResponse.json({
          error: 'You have already retweeted this Tweet.',
          details: {
            message: 'This tweet has already been retweeted by this user.',
            tweetId: tweetId,
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

      // Log full error details for debugging
      if (twitterError?.data) {
        console.error('📝 Twitter API Error Details:', JSON.stringify(twitterError.data, null, 2));
      }

      throw twitterError;
    }
  } catch (error) {
    console.error('❌ Error in retweet endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process retweet action' },
      { status: 500 }
    );
  }
}