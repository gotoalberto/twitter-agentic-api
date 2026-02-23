// Check current rate limits
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function checkCurrentRateLimits() {
  try {
    // Get all rate limits from database
    const allRateLimits = await prisma.rateLimit.findMany({
      orderBy: {
        lastRequestAt: 'desc'
      },
      take: 10
    });

    console.log('📊 All Rate Limits in Database (last 10):');
    console.log('=========================================\n');

    if (allRateLimits.length === 0) {
      console.log('No rate limits found in database');
      return;
    }

    const now = Date.now();

    allRateLimits.forEach(rl => {
      console.log(`Account: @${rl.accountUsername}`);
      console.log(`Endpoint: ${rl.endpoint}`);
      console.log(`Type: ${rl.endpointType}`);
      console.log(`Limit: ${rl.limit}`);
      console.log(`Remaining: ${rl.remaining}`);
      console.log(`Reset: ${rl.reset.toISOString()}`);

      // Calculate resetIn
      const resetTime = rl.reset.getTime();
      const resetIn = Math.max(0, Math.floor((resetTime - now) / 1000));
      const minutes = Math.floor(resetIn / 60);
      const seconds = resetIn % 60;

      console.log(`Reset in: ${resetIn} seconds (${minutes}m ${seconds}s)`);

      if (resetIn === 0) {
        console.log('Status: ⚠️ EXPIRED (rate limit has reset)');
      } else if (rl.remaining === 0) {
        console.log('Status: ❌ EXHAUSTED (no calls remaining)');
      } else {
        console.log(`Status: ✅ ACTIVE (${rl.remaining} calls remaining)`);
      }

      console.log(`Last request: ${rl.lastRequestAt.toISOString()}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentRateLimits();