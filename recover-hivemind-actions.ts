import { PrismaClient } from './src/generated/prisma';

const prisma = new PrismaClient();

async function recoverHivemindActions() {
  try {
    console.log('🔄 Starting Hivemind Actions Recovery...');
    console.log('============================================');

    // Get all rate limit records to understand usage patterns
    const rateLimits = await prisma.rateLimit.findMany({
      where: {
        hivemindUserId: { not: null }
      },
      orderBy: {
        lastUpdated: 'desc'
      }
    });

    console.log(`\n📊 Found ${rateLimits.length} rate limit records`);

    // Group by user and endpoint type
    const userActions = new Map<string, { likes: number, retweets: number, user: any }>();

    // Get all hivemind users
    const hivemindUsers = await prisma.hivemindUser.findMany();
    const userMap = new Map(hivemindUsers.map(u => [u.userId, u]));

    // Analyze rate limits to estimate actions
    for (const rateLimit of rateLimits) {
      const userId = rateLimit.hivemindUserId!;
      const user = userMap.get(userId);

      if (!user) continue;

      if (!userActions.has(userId)) {
        userActions.set(userId, {
          likes: 0,
          retweets: 0,
          user: {
            userId: user.userId,
            username: user.username,
            displayName: user.displayName
          }
        });
      }

      const userData = userActions.get(userId)!;
      const used = rateLimit.limit - rateLimit.remaining;

      if (rateLimit.endpointType === 'like' && used > userData.likes) {
        userData.likes = used;
      } else if (rateLimit.endpointType === 'retweet' && used > userData.retweets) {
        userData.retweets = used;
      }
    }

    console.log('\n📈 Estimated actions per user:');
    for (const [userId, data] of userActions) {
      console.log(`\n👤 ${data.user.username} (${data.user.displayName})`);
      console.log(`   ❤️  Likes: ${data.likes}`);
      console.log(`   🔄 Retweets: ${data.retweets}`);
    }

    // Check existing HivemindAction records
    const existingActions = await prisma.hivemindAction.count();
    console.log(`\n📝 Existing HivemindAction records: ${existingActions}`);

    // Create simulated HivemindAction records based on rate limit usage
    const actionsToCreate = [];

    for (const [userId, data] of userActions) {
      // Skip if no actions
      if (data.likes === 0 && data.retweets === 0) continue;

      // Check how many actions we already have for this user
      const existingUserLikes = await prisma.hivemindAction.count({
        where: { userId, actionType: 'like' }
      });
      const existingUserRetweets = await prisma.hivemindAction.count({
        where: { userId, actionType: 'retweet' }
      });

      const likesToAdd = Math.max(0, data.likes - existingUserLikes);
      const retweetsToAdd = Math.max(0, data.retweets - existingUserRetweets);

      console.log(`\n🔧 Processing ${data.user.username}:`);
      console.log(`   Existing likes: ${existingUserLikes}, Need to add: ${likesToAdd}`);
      console.log(`   Existing retweets: ${existingUserRetweets}, Need to add: ${retweetsToAdd}`);

      // Create placeholder like actions
      for (let i = 0; i < likesToAdd; i++) {
        const timestamp = new Date(Date.now() - (48 * 60 * 60 * 1000) + (i * 60 * 1000)); // Spread over last 48h
        actionsToCreate.push({
          userId,
          username: data.user.username,
          displayName: data.user.displayName,
          actionType: 'like' as const,
          tweetId: `recovered_like_${userId}_${i}`,
          tweetAuthor: 'unknown',
          tweetText: '[Recovered from rate limits - actual tweet data not available]',
          tweetUrl: 'https://twitter.com',
          performedAt: timestamp
        });
      }

      // Create placeholder retweet actions
      for (let i = 0; i < retweetsToAdd; i++) {
        const timestamp = new Date(Date.now() - (48 * 60 * 60 * 1000) + (i * 60 * 1000)); // Spread over last 48h
        actionsToCreate.push({
          userId,
          username: data.user.username,
          displayName: data.user.displayName,
          actionType: 'retweet' as const,
          tweetId: `recovered_rt_${userId}_${i}`,
          tweetAuthor: 'unknown',
          tweetText: '[Recovered from rate limits - actual tweet data not available]',
          tweetUrl: 'https://twitter.com',
          performedAt: timestamp
        });
      }
    }

    if (actionsToCreate.length > 0) {
      console.log(`\n💾 Creating ${actionsToCreate.length} recovered action records...`);

      const result = await prisma.hivemindAction.createMany({
        data: actionsToCreate
      });

      console.log(`✅ Successfully created ${result.count} action records`);
    } else {
      console.log('\n✅ No missing actions to recover');
    }

    // Final statistics
    const finalCount = await prisma.hivemindAction.count();
    const likeCount = await prisma.hivemindAction.count({ where: { actionType: 'like' } });
    const retweetCount = await prisma.hivemindAction.count({ where: { actionType: 'retweet' } });

    console.log('\n📊 Final Statistics:');
    console.log(`   Total HivemindActions: ${finalCount}`);
    console.log(`   Total Likes: ${likeCount}`);
    console.log(`   Total Retweets: ${retweetCount}`);
    console.log(`   Records added in this recovery: ${actionsToCreate.length}`);

  } catch (error) {
    console.error('❌ Error recovering actions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the recovery
recoverHivemindActions();