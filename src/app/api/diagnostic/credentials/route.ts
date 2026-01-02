/**
 * Diagnostic endpoint to verify Twitter API credentials
 *
 * This endpoint tests if the TWITTER_OAUTH_API_KEY and TWITTER_OAUTH_API_SECRET
 * are correctly configured by attempting to use them with a connected bot's credentials.
 *
 * Returns masked values and test results without exposing actual secrets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getBotByUsername } from '@/lib/db/bots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DIAGNOSTIC: Testing Twitter API credentials');

    // Get environment variables
    const apiKey = process.env.TWITTER_OAUTH_API_KEY;
    const apiSecret = process.env.TWITTER_OAUTH_API_SECRET;

    // Mask credentials (show first/last 4 chars only)
    const maskCredential = (value: string | undefined) => {
      if (!value) return 'NOT_SET';
      if (value.length < 12) return '***MASKED***';
      return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
    };

    const result = {
      environment: {
        apiKey: {
          present: !!apiKey,
          masked: maskCredential(apiKey),
          length: apiKey?.length || 0,
        },
        apiSecret: {
          present: !!apiSecret,
          masked: maskCredential(apiSecret),
          length: apiSecret?.length || 0,
        },
      },
      tests: [] as any[],
    };

    if (!apiKey || !apiSecret) {
      return NextResponse.json({
        success: false,
        error: 'Missing TWITTER_OAUTH_API_KEY or TWITTER_OAUTH_API_SECRET',
        result,
      }, { status: 500 });
    }

    // Test with pepesdogbot credentials
    console.log('📦 Fetching pepesdogbot from database...');
    const bot = await getBotByUsername('pepesdogbot');

    if (!bot) {
      return NextResponse.json({
        success: false,
        error: 'Bot pepesdogbot not found in database',
        result,
      }, { status: 404 });
    }

    console.log('✅ Bot found:', bot.username);
    result.tests.push({
      name: 'Bot lookup',
      success: true,
      botUsername: bot.username,
      botUserId: bot.userId,
    });

    // Test 1: Initialize Twitter client
    console.log('🔑 Initializing Twitter client...');
    try {
      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: bot.accessToken,
        accessSecret: bot.accessTokenSecret,
      });

      result.tests.push({
        name: 'Twitter client initialization',
        success: true,
      });

      // Test 2: Get user info (READ permission)
      console.log('📖 Testing READ permission...');
      const user = await client.v2.me();

      result.tests.push({
        name: 'Read permission test',
        success: true,
        username: user.data.username,
        userId: user.data.id,
      });

      // Test 3: Post a test tweet (WRITE permission)
      console.log('✏️  Testing WRITE permission...');
      const testTweet = `Diagnostic test - ${Date.now()}`;
      const tweet = await client.v2.tweet(testTweet);

      result.tests.push({
        name: 'Write permission test',
        success: true,
        tweetId: tweet.data.id,
        tweetUrl: `https://twitter.com/${bot.username}/status/${tweet.data.id}`,
      });

      // Clean up: delete test tweet
      console.log('🗑️  Cleaning up test tweet...');
      await client.v2.deleteTweet(tweet.data.id);

      result.tests.push({
        name: 'Test tweet cleanup',
        success: true,
      });

      return NextResponse.json({
        success: true,
        message: 'All credentials are working correctly',
        result,
      });

    } catch (error: any) {
      console.error('❌ Twitter API error:', error.message);

      result.tests.push({
        name: 'Twitter API test',
        success: false,
        error: error.message,
        code: error.code || null,
        data: error.data || null,
      });

      return NextResponse.json({
        success: false,
        error: 'Twitter API credentials test failed',
        details: error.message,
        result,
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ Diagnostic error:', error);

    return NextResponse.json({
      success: false,
      error: 'Diagnostic test failed',
      details: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
