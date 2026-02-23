// Test tweet rate limit tracking
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function testTweetRateLimit() {
  try {
    const apiKey = 'hm_FnbDNJraFq3fCQv4LPLStcX_uO352lxC';

    console.log('🐦 Testing Tweet Rate Limit Tracking');
    console.log('=====================================\n');

    // Try to post a tweet
    console.log('1. Attempting to post a tweet...\n');
    const tweetResponse = await fetch('https://hive.pepes.dog/api/twitter/tweet/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        username: 'Zeus_CC8',
        text: 'Test tweet for rate limit tracking ' + new Date().toISOString()
      })
    });

    const tweetData = await tweetResponse.json();
    console.log('Tweet Response Status:', tweetResponse.status);
    console.log('Response:', JSON.stringify(tweetData, null, 2));
    console.log('');

    // Wait a moment for database to update
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check rate limits in database for tweet endpoint
    console.log('2. Checking database for tweet rate limits...\n');
    const tweetRateLimits = await prisma.rateLimit.findMany({
      where: {
        endpointType: 'tweet'
      },
      orderBy: {
        lastRequestAt: 'desc'
      },
      take: 5
    });

    if (tweetRateLimits.length > 0) {
      console.log('📊 Tweet Rate Limits Found:', tweetRateLimits.length);
      tweetRateLimits.forEach(rl => {
        console.log(`\nAccount: @${rl.accountUsername}`);
        console.log(`Endpoint: ${rl.endpoint}`);
        console.log(`Limit: ${rl.limit}`);
        console.log(`Remaining: ${rl.remaining}`);
        console.log(`Reset: ${rl.reset.toISOString()}`);
        console.log(`Last request: ${rl.lastRequestAt.toISOString()}`);
      });
    } else {
      console.log('❌ No tweet rate limits found in database');
    }

    // Check via API
    console.log('\n3. Checking via Hivemind Rate Limits API...\n');
    const rateLimitResponse = await fetch('https://hive.pepes.dog/api/hivemind/rate-limits', {
      headers: {
        'X-API-Key': apiKey
      }
    });

    const rateLimitData = await rateLimitResponse.json();

    if (rateLimitData.rateLimits) {
      const tweetLimits = rateLimitData.rateLimits.filter(rl => rl.endpointType === 'tweet');

      if (tweetLimits.length > 0) {
        console.log('✅ Tweet rate limits found via API:');
        tweetLimits.forEach(rl => {
          console.log(`\n  Account: @${rl.account.username}`);
          console.log(`  Endpoint: ${rl.endpoint}`);
          console.log(`  Limit: ${rl.limit}`);
          console.log(`  Remaining: ${rl.remaining}`);
          console.log(`  Used: ${rl.used}`);
          console.log(`  Percentage used: ${rl.percentageUsed}%`);
          console.log(`  Reset in: ${rl.resetIn} seconds`);
        });
      } else {
        console.log('❌ No tweet rate limits returned by API');
      }
    }

    // Summary
    console.log('\n=====================================');
    console.log('📋 Summary:');
    console.log('');

    if (tweetResponse.status === 429) {
      console.log('✅ Tweet endpoint returned 429 (rate limited)');
      if (tweetRateLimits.length > 0) {
        console.log('✅ Rate limit was saved to database');
      } else {
        console.log('❌ Rate limit NOT saved to database (BUG!)');
      }
    } else if (tweetResponse.status === 200 || tweetResponse.status === 201) {
      console.log('✅ Tweet posted successfully');
      if (tweetRateLimits.length > 0) {
        console.log('✅ Rate limit tracking is working');
      } else {
        console.log('⚠️ No rate limit info saved (might be normal if no headers returned)');
      }
    } else {
      console.log(`⚠️ Unexpected status: ${tweetResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTweetRateLimit();