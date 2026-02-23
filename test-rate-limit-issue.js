// Test to check why rate limits are showing as empty
const { PrismaClient } = require('./src/generated/prisma');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function testRateLimitIssue() {
  try {
    console.log('🔍 Investigating rate limit issue...\n');

    // 1. Check if there are any rate limits in the database
    const allRateLimits = await prisma.rateLimit.findMany();
    console.log(`📊 Total rate limits in database: ${allRateLimits.length}`);

    if (allRateLimits.length > 0) {
      console.log('\n📋 Existing rate limits:');
      allRateLimits.forEach(rl => {
        console.log(`\n  Account: @${rl.accountUsername}`);
        console.log(`  Endpoint: ${rl.endpoint}`);
        console.log(`  Type: ${rl.endpointType}`);
        console.log(`  Limit: ${rl.limit}`);
        console.log(`  Remaining: ${rl.remaining}`);
        console.log(`  Reset: ${rl.reset}`);
        console.log(`  ProjectId: ${rl.projectId || 'N/A'}`);
        console.log(`  HivemindUserId: ${rl.hivemindUserId || 'N/A'}`);
      });
    }

    // 2. Get Hivemind API key
    const config = await prisma.hivemindConfig.findFirst();
    if (!config || !config.apiKey) {
      console.log('❌ No Hivemind API key found');
      return;
    }

    const apiKey = config.apiKey;
    console.log('\n✅ Hivemind API Key found:', apiKey.substring(0, 10) + '...');

    // 3. Try to make a simple API call that won't fail
    console.log('\n🔄 Testing with a simple user lookup...');

    // Get connected users first
    const users = await prisma.hivemindUser.findMany({
      where: { isActive: true },
      take: 1
    });

    if (users.length === 0) {
      console.log('❌ No active Hivemind users found');
      return;
    }

    const testUser = users[0];
    console.log(`\n👤 Testing with user: @${testUser.username}`);

    // 4. Check current rate limits via API
    console.log('\n📊 Checking rate limits via API...');
    const rateLimitResponse = await fetch('https://hive.pepes.dog/api/hivemind/rate-limits', {
      headers: {
        'X-API-Key': apiKey
      }
    });

    const rateLimitData = await rateLimitResponse.json();
    console.log('API Response Status:', rateLimitResponse.status);
    console.log('API Response:', JSON.stringify(rateLimitData, null, 2));

    // 5. Check rate limits for active (non-expired) entries only
    const now = new Date();
    const activeRateLimits = await prisma.rateLimit.findMany({
      where: {
        reset: {
          gte: now // Only get rate limits that haven't reset yet
        }
      }
    });

    console.log(`\n⏰ Active rate limits (not expired): ${activeRateLimits.length}`);

    // 6. Check expired rate limits
    const expiredRateLimits = await prisma.rateLimit.findMany({
      where: {
        reset: {
          lt: now // Rate limits that have already reset
        }
      }
    });

    console.log(`🕐 Expired rate limits: ${expiredRateLimits.length}`);

    // 7. Let's check the rate limit tracking service logic
    console.log('\n🔍 Checking rate limit service logic...');

    // The getProjectRateLimits and getHivemindUserRateLimits functions
    // filter by reset >= new Date(), so let's see if that's the issue

    if (expiredRateLimits.length > 0 && activeRateLimits.length === 0) {
      console.log('\n⚠️  ISSUE FOUND: All rate limits have expired!');
      console.log('The API only returns rate limits that haven\'t reset yet.');
      console.log('Since Twitter rate limits have reset, they are filtered out.');
      console.log('\nThis is actually correct behavior - we only show active rate limits.');
      console.log('To see rate limits, we need to make new API calls to Twitter.');
    }

    // 8. Try to manually insert a test rate limit to verify the system works
    console.log('\n🧪 Creating a test rate limit entry...');

    const futureReset = new Date();
    futureReset.setHours(futureReset.getHours() + 1); // Reset in 1 hour

    const testRateLimit = await prisma.rateLimit.upsert({
      where: {
        accountId_endpoint: {
          accountId: testUser.userId,
          endpoint: 'TEST /manual/test'
        }
      },
      update: {
        limit: 100,
        remaining: 75,
        reset: futureReset,
        lastUpdated: new Date(),
        lastRequestAt: new Date()
      },
      create: {
        accountId: testUser.userId,
        accountUsername: testUser.username,
        endpoint: 'TEST /manual/test',
        endpointType: 'other',
        limit: 100,
        remaining: 75,
        reset: futureReset,
        hivemindUserId: testUser.userId
      }
    });

    console.log('✅ Test rate limit created');

    // 9. Now check rate limits again
    console.log('\n📊 Checking rate limits again after test entry...');
    const testResponse = await fetch('https://hive.pepes.dog/api/hivemind/rate-limits', {
      headers: {
        'X-API-Key': apiKey
      }
    });

    const testData = await testResponse.json();
    console.log('Test Response:', JSON.stringify(testData, null, 2));

    // 10. Clean up test entry
    await prisma.rateLimit.delete({
      where: {
        id: testRateLimit.id
      }
    });
    console.log('\n🧹 Test rate limit cleaned up');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRateLimitIssue();