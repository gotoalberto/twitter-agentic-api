// Test Hivemind Rate Limits
const { PrismaClient } = require('./src/generated/prisma');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function testHivemindRateLimits() {
  try {
    // 1. Get Hivemind API key
    const config = await prisma.hivemindConfig.findFirst();
    if (!config || !config.apiKey) {
      console.log('❌ No Hivemind API key found');
      return;
    }

    const apiKey = config.apiKey;
    console.log('✅ Hivemind API Key found:', apiKey.substring(0, 10) + '...');

    // 2. Get connected users
    const users = await prisma.hivemindUser.findMany({
      where: { isActive: true },
      select: {
        username: true,
        displayName: true,
        oauth2AccessToken: true,
      }
    });

    if (users.length === 0) {
      console.log('❌ No active Hivemind users found');
      return;
    }

    console.log('\n📋 Connected Hivemind Users:');
    users.forEach(user => {
      console.log(`- @${user.username} (${user.displayName})`);
    });

    const testUser = users[0];
    console.log(`\n🎯 Using @${testUser.username} for testing`);

    // 3. Test giving a like to a tweet (using a popular tweet that likely exists)
    const testTweetId = '1760364628397973926'; // A known tweet ID

    console.log('\n🧪 Testing like endpoint...');
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
    console.log('Like Response:', JSON.stringify(likeData, null, 2));

    // 4. Now check rate limits
    console.log('\n📊 Checking rate limits...');
    const rateLimitResponse = await fetch('https://hive.pepes.dog/api/hivemind/rate-limits', {
      headers: {
        'X-API-Key': apiKey
      }
    });

    const rateLimitData = await rateLimitResponse.json();
    console.log('Rate Limit Response Status:', rateLimitResponse.status);
    console.log('Rate Limits:', JSON.stringify(rateLimitData, null, 2));

    // 5. Check rate limits for specific user
    console.log(`\n📊 Checking rate limits for @${testUser.username}...`);
    const userRateLimitResponse = await fetch(`https://hive.pepes.dog/api/hivemind/rate-limits?username=${testUser.username}`, {
      headers: {
        'X-API-Key': apiKey
      }
    });

    const userRateLimitData = await userRateLimitResponse.json();
    console.log('User Rate Limit Response Status:', userRateLimitResponse.status);
    console.log('User Rate Limits:', JSON.stringify(userRateLimitData, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testHivemindRateLimits();