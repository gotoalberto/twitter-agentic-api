/**
 * Script to test Twitter API rate limit headers
 * This script will make API calls and log the rate limit information
 */

const { TwitterApi } = require('twitter-api-v2');
const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient();

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

    // Try to get a bot with OAuth 1.0a credentials first (more reliable for rate limit checking)
    console.log('🔄 Looking for OAuth 1.0a credentials...\n');

    const bot = await prisma.bot.findFirst({
      where: {
        AND: [
          { accessToken: { not: '' } },
          { accessTokenSecret: { not: '' } }
        ]
      }
    });

    if (bot) {
      // Decrypt credentials
      const { decrypt } = require('./src/lib/utils/encryption');
      const accessToken = await decrypt(bot.accessToken);
      const accessTokenSecret = await decrypt(bot.accessTokenSecret);

      // Test with OAuth 1.0a
      await testOAuth1(hivemindConfig.twitterApp, accessToken, accessTokenSecret, bot.username);
    } else {
      // Fallback to OAuth 2.0
      console.log('No OAuth 1.0a credentials found, trying OAuth 2.0...\n');

      const hivemindUser = await prisma.hivemindUser.findFirst({
        where: {
          oauth2AccessToken: { not: null },
          isActive: true
        }
      });

      if (!hivemindUser || !hivemindUser.oauth2AccessToken) {
        console.error('❌ No active credentials found (neither OAuth 1.0a nor OAuth 2.0)');
        return;
      }

      // Test with OAuth 2.0
      await testOAuth2(hivemindUser.oauth2AccessToken, hivemindUser.username);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function testOAuth2(accessToken, username) {
  console.log('🔐 Testing with OAuth 2.0');
  console.log('👤 User:', username);
  console.log('');

  const client = new TwitterApi(accessToken);

  // Test 1: Get authenticated user info
  console.log('📊 Test 1: Getting authenticated user info...');
  try {
    const startTime = Date.now();
    const result = await client.v2.me();
    const duration = Date.now() - startTime;

    console.log('✅ Success in', duration, 'ms');
    console.log('User ID:', result.data.id);
    console.log('Username:', result.data.username);

    // Check for rate limit headers in the response
    logRateLimitInfo(result);
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.rateLimit) {
      console.log('📊 Rate Limit Info from error:', error.rateLimit);
    }
    console.log('');
  }

  // Test 2: Search tweets
  console.log('📊 Test 2: Searching tweets...');
  try {
    const startTime = Date.now();
    const result = await client.v2.search('#pepesdog', { max_results: 10 });
    const duration = Date.now() - startTime;

    console.log('✅ Success in', duration, 'ms');
    console.log('Tweets found:', result.data?.data?.length || 0);

    // Check for rate limit headers
    logRateLimitInfo(result);
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.rateLimit) {
      console.log('📊 Rate Limit Info from error:', error.rateLimit);
    }
    console.log('');
  }

  // Test 3: Get rate limit status (if available)
  console.log('📊 Test 3: Checking rate limit status...');
  try {
    // Try to access rate limit directly (v1.1 endpoint if available)
    const v1Client = client.v1;
    const rateLimits = await v1Client.get('application/rate_limit_status.json', {
      resources: 'search,users,statuses'
    });

    console.log('✅ Rate Limit Status:');
    console.log(JSON.stringify(rateLimits, null, 2));
  } catch (error) {
    console.log('ℹ️ Rate limit status endpoint not available or requires different auth');
    console.log('Error:', error.message);
  }
}

async function testOAuth1(twitterApp, accessToken, accessTokenSecret, username) {
  console.log('🔐 Testing with OAuth 1.0a');
  console.log('👤 Bot:', username);
  console.log('');

  const client = new TwitterApi({
    appKey: twitterApp.consumerKey || process.env.TWITTER_OAUTH_API_KEY,
    appSecret: twitterApp.consumerSecret || process.env.TWITTER_OAUTH_API_SECRET,
    accessToken: accessToken,
    accessSecret: accessTokenSecret,
  });

  // Test 1: Get authenticated user info
  console.log('📊 Test 1: Getting authenticated user info...');
  try {
    const startTime = Date.now();
    const result = await client.v2.me();
    const duration = Date.now() - startTime;

    console.log('✅ Success in', duration, 'ms');
    console.log('User ID:', result.data.id);
    console.log('Username:', result.data.username);

    // Check for rate limit headers
    logRateLimitInfo(result);
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.rateLimit) {
      console.log('📊 Rate Limit Info from error:', error.rateLimit);
    }
    console.log('');
  }

  // Test 2: Get rate limit status using v1.1
  console.log('📊 Test 2: Checking rate limit status (v1.1)...');
  try {
    const rateLimits = await client.v1.get('application/rate_limit_status.json', {
      resources: 'search,users,statuses,friends,followers'
    });

    console.log('✅ Rate Limit Status Retrieved!');
    console.log('');

    // Display rate limits for key endpoints
    if (rateLimits.resources) {
      console.log('🔍 Key Endpoint Rate Limits:');
      console.log('-'.repeat(80));

      // Statuses (tweets)
      if (rateLimits.resources.statuses) {
        console.log('\n📝 Tweet Endpoints:');
        Object.entries(rateLimits.resources.statuses).forEach(([endpoint, info]) => {
          console.log(`  ${endpoint}:`);
          console.log(`    Limit: ${info.limit}, Remaining: ${info.remaining}, Reset: ${new Date(info.reset * 1000).toISOString()}`);
        });
      }

      // Users
      if (rateLimits.resources.users) {
        console.log('\n👤 User Endpoints:');
        const keyEndpoints = ['/users/lookup', '/users/show/:id', '/users/search'];
        Object.entries(rateLimits.resources.users).forEach(([endpoint, info]) => {
          if (keyEndpoints.some(key => endpoint.includes(key.replace(':id', '')))) {
            console.log(`  ${endpoint}:`);
            console.log(`    Limit: ${info.limit}, Remaining: ${info.remaining}, Reset: ${new Date(info.reset * 1000).toISOString()}`);
          }
        });
      }

      // Search
      if (rateLimits.resources.search) {
        console.log('\n🔍 Search Endpoints:');
        Object.entries(rateLimits.resources.search).forEach(([endpoint, info]) => {
          console.log(`  ${endpoint}:`);
          console.log(`    Limit: ${info.limit}, Remaining: ${info.remaining}, Reset: ${new Date(info.reset * 1000).toISOString()}`);
        });
      }
    }

  } catch (error) {
    console.log('ℹ️ Rate limit status endpoint error');
    console.log('Error:', error.message);
  }

  // Test 3: Make a v2 API call and check headers
  console.log('\n📊 Test 3: Making v2 API call to check headers...');
  try {
    // Use the raw client to access headers
    const response = await client.v2.get('tweets/search/recent', {
      query: 'pepesdog',
      max_results: 10
    });

    console.log('✅ Success!');

    // The twitter-api-v2 library exposes rate limit info
    if (response.rateLimit) {
      console.log('📊 Rate Limit Info from response:');
      console.log('  Limit:', response.rateLimit.limit);
      console.log('  Remaining:', response.rateLimit.remaining);
      console.log('  Reset:', new Date(response.rateLimit.reset * 1000).toISOString());
    } else {
      console.log('ℹ️ No rate limit info in response');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.rateLimit) {
      console.log('📊 Rate Limit Info from error:');
      console.log('  Limit:', error.rateLimit.limit);
      console.log('  Remaining:', error.rateLimit.remaining);
      console.log('  Reset:', new Date(error.rateLimit.reset * 1000).toISOString());
    }
  }
}

function logRateLimitInfo(response) {
  // Check if the response has rate limit information
  if (response && response.rateLimit) {
    console.log('📊 Rate Limit Headers:');
    console.log('  Limit:', response.rateLimit.limit);
    console.log('  Remaining:', response.rateLimit.remaining);
    console.log('  Reset:', response.rateLimit.reset ? new Date(response.rateLimit.reset * 1000).toISOString() : 'N/A');
  } else if (response && response.headers) {
    console.log('📊 Response Headers:');
    // Look for rate limit headers
    const rateLimitHeaders = Object.entries(response.headers).filter(([key]) =>
      key.toLowerCase().includes('rate') || key.toLowerCase().includes('limit')
    );

    if (rateLimitHeaders.length > 0) {
      rateLimitHeaders.forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    } else {
      console.log('  No rate limit headers found');
    }
  } else {
    console.log('ℹ️ No rate limit information available in response');
  }
}

// Run the tests
testRateLimits().catch(console.error);