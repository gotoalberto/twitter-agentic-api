// Test real API calls to see if rate limits are saved
const { PrismaClient } = require('./src/generated/prisma');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function testRealApiCall() {
  try {
    // 1. Get Hivemind API key
    const config = await prisma.hivemindConfig.findFirst();
    if (!config || !config.apiKey) {
      console.log('❌ No Hivemind API key found');
      return;
    }

    const apiKey = config.apiKey;
    console.log('✅ Hivemind API Key found:', apiKey.substring(0, 10) + '...');

    // 2. Try to like a tweet (this should hit rate limit)
    console.log('\n🧪 Testing like endpoint (should hit rate limit)...');

    const likeResponse = await fetch('https://hive.pepes.dog/api/twitter/like', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        tweetId: '1861080853536538854', // A random tweet ID
        action: 'like'
      })
    });

    const likeData = await likeResponse.json();
    console.log('Like Response Status:', likeResponse.status);
    console.log('Like Response:', JSON.stringify(likeData, null, 2));

    // 3. Wait a moment for database to update
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Check if rate limits were saved
    console.log('\n📊 Checking database for rate limits...');
    const rateLimits = await prisma.rateLimit.findMany();
    console.log(`Found ${rateLimits.length} rate limits in database`);

    if (rateLimits.length > 0) {
      rateLimits.forEach(rl => {
        console.log(`\n  Account: @${rl.accountUsername}`);
        console.log(`  Endpoint: ${rl.endpoint}`);
        console.log(`  Type: ${rl.endpointType}`);
        console.log(`  Limit: ${rl.limit}`);
        console.log(`  Remaining: ${rl.remaining}`);
      });
    }

    // 5. Check rate limits via API
    console.log('\n📊 Checking rate limits via API...');
    const rateLimitResponse = await fetch('https://hive.pepes.dog/api/hivemind/rate-limits', {
      headers: {
        'X-API-Key': apiKey
      }
    });

    const rateLimitData = await rateLimitResponse.json();
    console.log('Rate Limits API Response:', JSON.stringify(rateLimitData, null, 2));

    // 6. Let's check if the issue is in the error handling
    if (likeResponse.status === 429 && rateLimits.length === 0) {
      console.log('\n⚠️  PROBLEM IDENTIFIED:');
      console.log('The API returned 429 (rate limit) but no rate limits were saved to database.');
      console.log('This suggests the rate limit info is not being extracted from error responses.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRealApiCall();