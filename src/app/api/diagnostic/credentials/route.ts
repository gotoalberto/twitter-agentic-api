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

    // Test with BitsoOnchain credentials
    console.log('📦 Fetching BitsoOnchain from database...');
    const bot = await getBotByUsername('BitsoOnchain');

    if (!bot) {
      return NextResponse.json({
        success: false,
        error: 'Bot BitsoOnchain not found in database',
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
      } as any);

      result.tests.push({
        name: 'Twitter client initialization',
        success: true,
      });

      // Test 2: Get user info (v2.me)
      console.log('📖 Testing v2.me() - Verify bot credentials...');
      try {
        const user = await client.v2.me();
        result.tests.push({
          name: 'v2.me() - Bot credential verification',
          success: true,
          username: user.data.username,
          userId: user.data.id,
        });
      } catch (error: any) {
        console.error('❌ v2.me() failed:', error.message);
        result.tests.push({
          name: 'v2.me() - Bot credential verification',
          success: false,
          error: error.message,
          code: error.code || null,
          type: error.type || null,
          data: error.data || null,
          errors: error.errors || null,
        });
      }

      // Test 3: userByUsername('gotoalberto') - THIS IS THE FAILING CALL
      console.log('🔍 Testing userByUsername("gotoalberto") - THE FAILING ENDPOINT...');
      try {
        const userResponse = await client.v2.userByUsername('gotoalberto', {
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

        result.tests.push({
          name: 'userByUsername("gotoalberto") - User lookup',
          success: true,
          username: userResponse.data?.username,
          userId: userResponse.data?.id,
          followers: userResponse.data?.public_metrics?.followers_count || 0,
        });
      } catch (error: any) {
        console.error('❌ userByUsername("gotoalberto") failed:', error.message);
        console.error('   Error code:', error.code);
        console.error('   Error type:', error.type);
        console.error('   Error data:', JSON.stringify(error.data || {}, null, 2));
        console.error('   Error errors:', JSON.stringify(error.errors || {}, null, 2));

        result.tests.push({
          name: 'userByUsername("gotoalberto") - User lookup',
          success: false,
          error: error.message,
          code: error.code || null,
          type: error.type || null,
          data: error.data || null,
          errors: error.errors || null,
          rateLimit: error.rateLimit || null,
          fullError: JSON.stringify(error, null, 2),
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Diagnostic tests completed',
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
