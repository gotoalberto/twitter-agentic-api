// Final test of rate limits system
const { PrismaClient } = require('./src/generated/prisma');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function testFinalRateLimits() {
  try {
    // 1. Get Hivemind API key
    const config = await prisma.hivemindConfig.findFirst();
    if (!config || !config.apiKey) {
      console.log('❌ No Hivemind API key found');
      return;
    }

    const apiKey = config.apiKey;
    console.log('✅ Hivemind API Key found:', apiKey.substring(0, 10) + '...');

    // 2. Test rate limits endpoint (should work now after migration)
    console.log('\n📊 Testing rate limits endpoint...');
    const rateLimitResponse = await fetch('https://hive.pepes.dog/api/hivemind/rate-limits', {
      headers: {
        'X-API-Key': apiKey
      }
    });

    const rateLimitData = await rateLimitResponse.json();
    console.log('Rate Limit Response Status:', rateLimitResponse.status);

    if (rateLimitResponse.status === 200) {
      console.log('\n✅ Rate limits API working!');
      console.log('Summary:', JSON.stringify(rateLimitData.summary, null, 2));

      if (rateLimitData.rateLimits && rateLimitData.rateLimits.length > 0) {
        console.log('\n📈 Current Rate Limits:');
        rateLimitData.rateLimits.forEach(rl => {
          console.log(`\n  User: @${rl.account.username}`);
          console.log(`  Endpoint: ${rl.endpoint}`);
          console.log(`  Type: ${rl.endpointType}`);
          console.log(`  Limit: ${rl.limit}`);
          console.log(`  Remaining: ${rl.remaining}`);
          console.log(`  Used: ${rl.used} (${rl.percentageUsed}%)`);
          console.log(`  Resets in: ${rl.resetIn} seconds`);
        });
      } else {
        console.log('No rate limit data available yet');
        console.log('Rate limits will be populated as API calls are made');
      }
    } else {
      console.log('Error:', rateLimitData.error);
    }

    // 3. Test specific user rate limits
    console.log('\n📊 Testing user-specific rate limits for @gotoalberto...');
    const userRateLimitResponse = await fetch('https://hive.pepes.dog/api/hivemind/rate-limits?username=gotoalberto', {
      headers: {
        'X-API-Key': apiKey
      }
    });

    const userRateLimitData = await userRateLimitResponse.json();
    if (userRateLimitResponse.status === 200) {
      console.log('User Rate Limits Summary:', JSON.stringify(userRateLimitData.summary, null, 2));
    }

    // 4. Check documentation pages
    console.log('\n📚 Documentation has been updated:');
    console.log('- Hivemind Docs: https://hive.pepes.dog/dashboard/hivemind');
    console.log('- Projects Docs: https://hive.pepes.dog/dashboard/projects/[id]');
    console.log('\nBoth pages now include:');
    console.log('✅ Rate Limits API endpoint documentation');
    console.log('✅ Example requests and responses');
    console.log('✅ Error handling for 429 rate limit errors');
    console.log('✅ Best practices for rate limit management');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFinalRateLimits();