// Try to trigger tweet rate limit
const apiKey = 'hm_FnbDNJraFq3fCQv4LPLStcX_uO352lxC';

async function spamTweets() {
  console.log('🐦 Attempting to trigger tweet rate limit...\n');

  for (let i = 1; i <= 5; i++) {
    console.log(`Attempt ${i}/5...`);

    const response = await fetch('https://hive.pepes.dog/api/twitter/tweet/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        username: 'Zeus_CC8',
        text: `Rate limit test ${i} - ${new Date().toISOString()}`
      })
    });

    const data = await response.json();

    if (response.status === 429) {
      console.log(`✅ Hit rate limit on attempt ${i}`);
      console.log('Rate limit details:', JSON.stringify(data.details, null, 2));
      break;
    } else if (response.status === 200) {
      console.log(`✅ Tweet ${i} posted: ${data.tweet?.id}`);
    } else {
      console.log(`❌ Error (${response.status}): ${data.error}`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Check database for tweet rate limits
  const { PrismaClient } = require('./src/generated/prisma');
  const prisma = new PrismaClient();

  console.log('\n📊 Checking database for tweet rate limits...\n');

  const tweetLimits = await prisma.rateLimit.findMany({
    where: {
      endpointType: 'tweet'
    },
    orderBy: {
      lastRequestAt: 'desc'
    },
    take: 5
  });

  if (tweetLimits.length > 0) {
    console.log('Found', tweetLimits.length, 'tweet rate limit entries:');
    tweetLimits.forEach(rl => {
      console.log(`\n@${rl.accountUsername}: ${rl.remaining}/${rl.limit} remaining`);
      console.log(`Reset: ${rl.reset.toISOString()}`);
    });
  } else {
    console.log('❌ No tweet rate limits found in database');
    console.log('\n⚠️ This suggests that Twitter API v2 with OAuth 2.0 might not');
    console.log('   return rate limit headers on successful requests.');
    console.log('   Rate limits are only captured when hitting 429 errors.');
  }

  await prisma.$disconnect();
}

spamTweets().catch(console.error);