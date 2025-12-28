/**
 * Match Twitter Subscriptions to Database Bots
 *
 * Compares the user IDs from Twitter API subscriptions
 * with the bots in our database to identify which bots
 * are actually subscribed.
 */

import dotenv from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/index.js';

dotenv.config({ path: '.env.production.local' });

const prisma = new PrismaClient();

// User IDs from Twitter API subscription list
const SUBSCRIBED_USER_IDS = [
  '1460606890392629248',
  '1167045425620295680',
  '1940075986579857408',
];

async function main() {
  try {
    console.log('');
    console.log('=================================================================');
    console.log('   SUBSCRIPTION TO BOT MATCHER');
    console.log('=================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('=================================================================');
    console.log('');

    // Get all bots from database
    console.log('💾 Fetching all bots from database...');
    const bots = await prisma.bot.findMany({
      include: {
        project: true,
      },
    });
    console.log(`   Found ${bots.length} bot(s) in database`);
    console.log('');

    // Display all bots
    console.log('=================================================================');
    console.log('   ALL BOTS IN DATABASE');
    console.log('=================================================================');
    console.log('');

    for (const bot of bots) {
      console.log(`Bot: @${bot.username}`);
      console.log('  User ID:', bot.userId);
      console.log('  Project:', bot.project.name);
      console.log('  Project ID:', bot.projectId);
      console.log('  Connected At:', bot.connectedAt);
      console.log('');
    }

    // Match subscriptions to bots
    console.log('=================================================================');
    console.log('   TWITTER SUBSCRIPTIONS vs DATABASE BOTS');
    console.log('=================================================================');
    console.log('');

    console.log('Twitter API reports 3 active subscriptions:');
    console.log('');

    let matchedCount = 0;
    let unmatchedCount = 0;

    for (let i = 0; i < SUBSCRIBED_USER_IDS.length; i++) {
      const userId = SUBSCRIBED_USER_IDS[i];
      const bot = bots.find(b => b.userId === userId);

      console.log(`${i + 1}. User ID: ${userId}`);

      if (bot) {
        console.log(`   ✅ MATCHED - Bot @${bot.username} in project "${bot.project.name}"`);
        console.log(`   Project ID: ${bot.projectId}`);
        matchedCount++;
      } else {
        console.log(`   ❌ NOT FOUND IN DATABASE`);
        console.log(`   This subscription is orphaned - no matching bot in database`);
        unmatchedCount++;
      }

      console.log('');
    }

    // Check for bots in DB but not subscribed
    console.log('=================================================================');
    console.log('   BOTS IN DATABASE BUT NOT SUBSCRIBED');
    console.log('=================================================================');
    console.log('');

    const unsubscribedBots = bots.filter(bot => !SUBSCRIBED_USER_IDS.includes(bot.userId));

    if (unsubscribedBots.length === 0) {
      console.log('✅ All bots in database have active subscriptions');
    } else {
      console.log(`⚠️  Found ${unsubscribedBots.length} bot(s) in database WITHOUT subscriptions:`);
      console.log('');
      for (const bot of unsubscribedBots) {
        console.log(`  Bot: @${bot.username}`);
        console.log('  User ID:', bot.userId);
        console.log('  Project:', bot.project.name);
        console.log('  Connected At:', bot.connectedAt);
        console.log('');
      }
    }

    // Summary
    console.log('=================================================================');
    console.log('   SUMMARY');
    console.log('=================================================================');
    console.log('   Twitter API subscriptions:', SUBSCRIBED_USER_IDS.length);
    console.log('   Bots in database:', bots.length);
    console.log('   Matched (in both):', matchedCount);
    console.log('   Orphaned (only in Twitter):', unmatchedCount);
    console.log('   Not subscribed (only in DB):', unsubscribedBots.length);
    console.log('');

    if (unmatchedCount > 0) {
      console.log('⚠️  RECOMMENDATION:');
      console.log('   There are orphaned subscriptions in Twitter that don\'t match any bot in the database.');
      console.log('   These may be from old/deleted bots and could be causing the "subscription limit exceeded" issue.');
      console.log('   Consider deleting these orphaned subscriptions.');
      console.log('');
    }

    console.log('=================================================================');
    console.log('');

    await prisma.$disconnect();

  } catch (error) {
    console.error('');
    console.error('=================================================================');
    console.error('   ERROR');
    console.error('=================================================================');
    console.error('');
    console.error(error);
    console.error('');
    process.exit(1);
  }
}

main();
