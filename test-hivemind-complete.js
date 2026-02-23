// Test complete Hivemind Rate Limits with like and retweet
const { PrismaClient } = require('./src/generated/prisma');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function testHivemindComplete() {
  try {
    // 1. Get Hivemind API key
    const config = await prisma.hivemindConfig.findFirst();
    if (!config || !config.apiKey) {
      console.log('❌ No Hivemind API key found');
      return;
    }

    const apiKey = config.apiKey;
    console.log('✅ Hivemind API Key found:', apiKey.substring(0, 10) + '...');

    // 2. Get connected users - using one that hasn't hit rate limits
    const users = await prisma.hivemindUser.findMany({
      where: { isActive: true },
      select: {
        username: true,
        displayName: true,
        oauth2AccessToken: true,
      }
    });

    console.log('\n📋 Connected Hivemind Users:');
    users.forEach(user => {
      console.log(`- @${user.username} (${user.displayName})`);
    });

    // Use gotoalberto account for testing
    const testUser = users.find(u => u.username === 'gotoalberto') || users[0];
    console.log(`\n🎯 Using @${testUser.username} for testing`);

    // 3. First check initial rate limits
    console.log('\n📊 Initial rate limits check...');
    let rateLimitResponse = await fetch(`https://hive.pepes.dog/api/hivemind/rate-limits?username=${testUser.username}`, {
      headers: {
        'X-API-Key': apiKey
      }
    });

    let rateLimitData = await rateLimitResponse.json();
    console.log('Initial Rate Limits:', JSON.stringify(rateLimitData, null, 2));

    // 4. Test giving a like to a popular tweet
    const testTweetId = '1861080853536538854'; // Recent tweet from pepes.dog

    console.log('\n💙 Testing like endpoint...');
    console.log('Tweet ID:', testTweetId);

    // First unlike in case it was already liked
    await fetch('https://hive.pepes.dog/api/twitter/like', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        tweetId: testTweetId,
        action: 'unlike'
      })
    });

    // Now like the tweet
    const likeResponse = await fetch('https://hive.pepes.dog/api/twitter/like', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        tweetId: testTweetId,
        action: 'like'
      })
    });

    const likeData = await likeResponse.json();
    console.log('Like Response Status:', likeResponse.status);
    if (likeResponse.status === 200) {
      console.log('✅ Like successful!');
    } else {
      console.log('Like Response:', JSON.stringify(likeData, null, 2));
    }

    // 5. Test retweet
    console.log('\n🔄 Testing retweet endpoint...');

    // First unretweet in case it was already retweeted
    await fetch('https://hive.pepes.dog/api/twitter/retweet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        tweetId: testTweetId,
        action: 'unretweet'
      })
    });

    // Now retweet
    const retweetResponse = await fetch('https://hive.pepes.dog/api/twitter/retweet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        tweetId: testTweetId,
        action: 'retweet'
      })
    });

    const retweetData = await retweetResponse.json();
    console.log('Retweet Response Status:', retweetResponse.status);
    if (retweetResponse.status === 200) {
      console.log('✅ Retweet successful!');
    } else {
      console.log('Retweet Response:', JSON.stringify(retweetData, null, 2));
    }

    // 6. Wait a moment for rate limits to be saved
    console.log('\n⏳ Waiting 2 seconds for rate limits to be saved...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 7. Check rate limits after actions
    console.log('\n📊 Checking rate limits after actions...');
    rateLimitResponse = await fetch(`https://hive.pepes.dog/api/hivemind/rate-limits?username=${testUser.username}`, {
      headers: {
        'X-API-Key': apiKey
      }
    });

    rateLimitData = await rateLimitResponse.json();
    console.log('Rate Limit Response Status:', rateLimitResponse.status);

    if (rateLimitResponse.status === 200) {
      console.log('\n✅ Rate limits successfully tracked!');
      console.log('Summary:', rateLimitData.summary);

      if (rateLimitData.rateLimits && rateLimitData.rateLimits.length > 0) {
        console.log('\n📈 Rate Limit Details:');
        rateLimitData.rateLimits.forEach(rl => {
          console.log(`\n  Endpoint: ${rl.endpoint}`);
          console.log(`  Type: ${rl.endpointType}`);
          console.log(`  Limit: ${rl.limit}`);
          console.log(`  Remaining: ${rl.remaining}`);
          console.log(`  Used: ${rl.used} (${rl.percentageUsed}%)`);
          console.log(`  Resets in: ${rl.resetIn} seconds`);
        });
      } else {
        console.log('No rate limit data found yet');
      }
    } else {
      console.log('Rate Limits Error:', JSON.stringify(rateLimitData, null, 2));
    }

    // 8. Check all Hivemind rate limits
    console.log('\n📊 Checking ALL Hivemind rate limits...');
    const allRateLimitsResponse = await fetch('https://hive.pepes.dog/api/hivemind/rate-limits', {
      headers: {
        'X-API-Key': apiKey
      }
    });

    const allRateLimitsData = await allRateLimitsResponse.json();
    if (allRateLimitsResponse.status === 200) {
      console.log('Total Users with Rate Limits:', allRateLimitsData.summary?.totalUsers || 0);
      console.log('Active Endpoints:', allRateLimitsData.summary?.activeEndpoints || 0);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testHivemindComplete();