/**
 * Script to test Twitter API rate limit headers
 * Run with: npx tsx src/scripts/test-rate-limits.ts
 */

import 'dotenv/config';
import { TwitterApi } from 'twitter-api-v2';
import { prisma } from '@/lib/db/prisma';
import { decrypt } from '@/lib/utils/encryption';

async function testRateLimits() {
  try {
    console.log('🔍 Testing Twitter API Rate Limits\n');
    console.log('=' .repeat(80));

    // Get Hivemind configuration
    const hivemindConfig = await prisma.hivemindConfig.findFirst({
      include: {
        twitterApp: true
      }
    });

    if (!hivemindConfig || !hivemindConfig.twitterApp) {
      console.error('❌ Hivemind config or Twitter app not found');
      return;
    }

    console.log('📱 Twitter App:', hivemindConfig.twitterApp.name);
    console.log('');

    // Try to get a bot with OAuth 1.0a credentials first
    console.log('🔄 Looking for OAuth 1.0a credentials...\n');

    const bot = await prisma.bot.findFirst({
      where: {
        NOT: [
          { accessToken: '' },
          { accessTokenSecret: '' }
        ]
      }
    });

    if (bot && bot.accessToken && bot.accessTokenSecret) {
      // Decrypt credentials
      const accessToken = await decrypt(bot.accessToken);
      const accessTokenSecret = await decrypt(bot.accessTokenSecret);

      // Test with OAuth 1.0a
      await testOAuth1(hivemindConfig.twitterApp, accessToken, accessTokenSecret, bot.username);
    } else {
      // Try Hivemind users with OAuth 1.0a
      console.log('Checking Hivemind users with OAuth 1.0a...\n');

      const hivemindUser = await prisma.hivemindUser.findFirst({});

      if (hivemindUser && hivemindUser.accessToken && hivemindUser.accessTokenSecret) {
        console.log('✅ Found Hivemind user with OAuth 1.0a:', hivemindUser.username);

        // Decrypt credentials
        const accessToken = await decrypt(hivemindUser.accessToken);
        const accessTokenSecret = await decrypt(hivemindUser.accessTokenSecret);

        // Test with OAuth 1.0a
        await testOAuth1(hivemindConfig.twitterApp, accessToken, accessTokenSecret, hivemindUser.username);
      } else {
        // Fallback to OAuth 2.0
        console.log('No OAuth 1.0a credentials found, trying OAuth 2.0...\n');

        const hivemindUser2 = await prisma.hivemindUser.findFirst({
          where: {
            isActive: true
          }
        });

        if (!hivemindUser2 || !hivemindUser2.oauth2AccessToken) {
          console.error('❌ No active credentials found (neither OAuth 1.0a nor OAuth 2.0)');
          return;
        }

        // Test with OAuth 2.0
        await testOAuth2(hivemindUser2.oauth2AccessToken, hivemindUser2.username);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function testOAuth1(twitterApp: any, accessToken: string, accessTokenSecret: string, username: string) {
  console.log('🔐 Testing with OAuth 1.0a');
  console.log('👤 Account:', username);
  console.log('');

  const client = new TwitterApi({
    appKey: twitterApp.consumerKey || process.env.TWITTER_OAUTH_API_KEY!,
    appSecret: twitterApp.consumerSecret || process.env.TWITTER_OAUTH_API_SECRET!,
    accessToken: accessToken,
    accessSecret: accessTokenSecret,
  });

  // Test 1: Get rate limit status using v1.1
  console.log('📊 Test 1: Getting rate limit status from Twitter API...');
  console.log('-'.repeat(80));

  try {
    const rateLimits = await client.v1.get('application/rate_limit_status.json');

    console.log('✅ Rate Limit Status Retrieved!\n');

    // Display rate limits for key endpoints
    if (rateLimits.resources) {
      // Tweet operations
      console.log('📝 TWEET OPERATIONS:');
      console.log('-'.repeat(60));

      if (rateLimits.resources.statuses) {
        const tweetEndpoints = {
          '/statuses/update': 'Post Tweet',
          '/statuses/retweet/:id': 'Retweet',
          '/statuses/unretweet/:id': 'Unretweet',
          '/statuses/user_timeline': 'User Timeline',
          '/statuses/home_timeline': 'Home Timeline',
        };

        Object.entries(tweetEndpoints).forEach(([endpoint, description]) => {
          const info = rateLimits.resources.statuses[endpoint];
          if (info) {
            const resetIn = Math.max(0, info.reset - Math.floor(Date.now() / 1000));
            console.log(`\n  ${description} (${endpoint}):`);
            console.log(`    ├─ Limit: ${info.limit} calls`);
            console.log(`    ├─ Remaining: ${info.remaining} calls`);
            console.log(`    └─ Resets in: ${Math.floor(resetIn / 60)}m ${resetIn % 60}s`);
          }
        });
      }

      // Like operations (favorites)
      console.log('\n\n❤️ LIKE OPERATIONS:');
      console.log('-'.repeat(60));

      if (rateLimits.resources.favorites) {
        const likeEndpoints = {
          '/favorites/create': 'Like Tweet',
          '/favorites/destroy': 'Unlike Tweet',
          '/favorites/list': 'List Likes',
        };

        Object.entries(likeEndpoints).forEach(([endpoint, description]) => {
          const info = rateLimits.resources.favorites[endpoint];
          if (info) {
            const resetIn = Math.max(0, info.reset - Math.floor(Date.now() / 1000));
            console.log(`\n  ${description} (${endpoint}):`);
            console.log(`    ├─ Limit: ${info.limit} calls`);
            console.log(`    ├─ Remaining: ${info.remaining} calls`);
            console.log(`    └─ Resets in: ${Math.floor(resetIn / 60)}m ${resetIn % 60}s`);
          }
        });
      }

      // User operations
      console.log('\n\n👤 USER OPERATIONS:');
      console.log('-'.repeat(60));

      if (rateLimits.resources.users) {
        const userEndpoints = {
          '/users/lookup': 'User Lookup',
          '/users/show/:id': 'User Info',
          '/users/search': 'User Search',
        };

        Object.entries(userEndpoints).forEach(([endpoint, description]) => {
          const info = rateLimits.resources.users[endpoint];
          if (info) {
            const resetIn = Math.max(0, info.reset - Math.floor(Date.now() / 1000));
            console.log(`\n  ${description} (${endpoint}):`);
            console.log(`    ├─ Limit: ${info.limit} calls`);
            console.log(`    ├─ Remaining: ${info.remaining} calls`);
            console.log(`    └─ Resets in: ${Math.floor(resetIn / 60)}m ${resetIn % 60}s`);
          }
        });
      }

      // Friends & Followers
      console.log('\n\n👥 FRIENDS & FOLLOWERS:');
      console.log('-'.repeat(60));

      if (rateLimits.resources.friends) {
        const friendEndpoints = {
          '/friends/ids': 'Following IDs',
          '/friends/list': 'Following List',
        };

        Object.entries(friendEndpoints).forEach(([endpoint, description]) => {
          const info = rateLimits.resources.friends[endpoint];
          if (info) {
            const resetIn = Math.max(0, info.reset - Math.floor(Date.now() / 1000));
            console.log(`\n  ${description} (${endpoint}):`);
            console.log(`    ├─ Limit: ${info.limit} calls`);
            console.log(`    ├─ Remaining: ${info.remaining} calls`);
            console.log(`    └─ Resets in: ${Math.floor(resetIn / 60)}m ${resetIn % 60}s`);
          }
        });
      }
    }

  } catch (error: any) {
    console.error('❌ Error getting rate limit status:', error.message);
  }

  // Test 2: Make a v2 API call and check headers
  console.log('\n\n📊 Test 2: Making v2 API call to check response headers...');
  console.log('-'.repeat(80));

  try {
    const result = await client.v2.me();

    console.log('✅ API call successful!');
    console.log('  User:', result.data.username);

    // Check for rate limit in response
    if ((result as any).rateLimit) {
      const rateLimit = (result as any).rateLimit;
      const resetIn = Math.max(0, rateLimit.reset - Math.floor(Date.now() / 1000));

      console.log('\n📊 Rate Limit Info from Response Headers:');
      console.log(`  ├─ Limit: ${rateLimit.limit} calls`);
      console.log(`  ├─ Remaining: ${rateLimit.remaining} calls`);
      console.log(`  ├─ Reset: ${new Date(rateLimit.reset * 1000).toISOString()}`);
      console.log(`  └─ Resets in: ${Math.floor(resetIn / 60)}m ${resetIn % 60}s`);
    } else {
      console.log('  ℹ️ No rate limit info in response headers');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);

    // Check if error has rate limit info
    if (error.rateLimit) {
      const resetIn = Math.max(0, error.rateLimit.reset - Math.floor(Date.now() / 1000));

      console.log('\n📊 Rate Limit Info from Error:');
      console.log(`  ├─ Limit: ${error.rateLimit.limit} calls`);
      console.log(`  ├─ Remaining: ${error.rateLimit.remaining} calls`);
      console.log(`  ├─ Reset: ${new Date(error.rateLimit.reset * 1000).toISOString()}`);
      console.log(`  └─ Resets in: ${Math.floor(resetIn / 60)}m ${resetIn % 60}s`);
    }
  }

  // Test 3: Try v2 endpoints with OAuth 1.0a
  console.log('\n\n📊 Test 3: Testing v2 endpoints (likes, retweets)...');
  console.log('-'.repeat(80));

  // Get a test tweet ID
  try {
    const tweets = await client.v2.search('from:pepesdog_cn', { max_results: 10 });

    if (tweets.data?.data && tweets.data.data.length > 0) {
      const testTweetId = tweets.data.data[0].id;
      console.log('  Using test tweet ID:', testTweetId);

      // Check rate limit from search response
      if ((tweets as any).rateLimit) {
        console.log('\n  Search endpoint rate limit:');
        console.log(`    Remaining: ${(tweets as any).rateLimit.remaining}/${(tweets as any).rateLimit.limit}`);
      }
    }
  } catch (error: any) {
    console.log('  Could not get test tweet:', error.message);
  }
}

async function testOAuth2(accessToken: string, username: string) {
  console.log('🔐 Testing with OAuth 2.0');
  console.log('👤 User:', username);
  console.log('⚠️  Note: OAuth 2.0 has limited rate limit visibility\n');

  const client = new TwitterApi(accessToken);

  // OAuth 2.0 doesn't have access to rate_limit_status endpoint
  console.log('📊 Making API calls to check response headers...');
  console.log('-'.repeat(80));

  // Test different endpoints
  const tests = [
    { name: 'User Info', fn: () => client.v2.me() },
    { name: 'Search Tweets', fn: () => client.v2.search('#pepesdog', { max_results: 10 }) },
  ];

  for (const test of tests) {
    console.log(`\n  Testing: ${test.name}`);
    try {
      const result = await test.fn();
      console.log('    ✅ Success');

      // Check for rate limit in response
      if ((result as any).rateLimit) {
        const rateLimit = (result as any).rateLimit;
        console.log(`    Rate Limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
      } else {
        console.log('    ℹ️ No rate limit info available');
      }
    } catch (error: any) {
      console.log(`    ❌ Error: ${error.message}`);

      if (error.rateLimit) {
        console.log(`    Rate Limit: ${error.rateLimit.remaining}/${error.rateLimit.limit} remaining`);
      }
    }
  }
}

// Run the tests
testRateLimits().catch(console.error);