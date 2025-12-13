/**
 * Subscribe Existing Bot to Webhook
 *
 * This script subscribes an already-connected bot to an existing webhook registration.
 * Useful when the bot was connected but the webhook subscription failed or wasn't created.
 *
 * Usage: node subscribe-existing-bot.js
 */

const { PrismaClient } = require('./src/generated/prisma');
const { subscribeWebhook } = require('./src/lib/twitter/webhooks');

const prisma = new PrismaClient();

async function subscribeExistingBot() {
  try {
    console.log('');
    console.log('==============================================================================');
    console.log('SUBSCRIBE EXISTING BOT TO WEBHOOK');
    console.log('==============================================================================');
    console.log('');

    // Get environment variables
    const consumerKey = process.env.TWITTER_OAUTH_API_KEY;
    const consumerSecret = process.env.TWITTER_OAUTH_API_SECRET;

    if (!consumerKey || !consumerSecret) {
      throw new Error('Missing TWITTER_OAUTH_API_KEY or TWITTER_OAUTH_API_SECRET');
    }

    // Get all projects with bots and webhook registrations
    const projects = await prisma.project.findMany({
      include: {
        bot: true,
        webhookRegistrations: true,
      },
    });

    console.log(`Found ${projects.length} project(s)\n`);

    for (const project of projects) {
      console.log('------------------------------------------------------------------------------');
      console.log(`Project: ${project.name} (ID: ${project.id})`);
      console.log('------------------------------------------------------------------------------');

      // Skip if no bot
      if (!project.bot) {
        console.log('❌ No bot connected - skipping');
        console.log('');
        continue;
      }

      console.log(`Bot: @${project.bot.username} (${project.bot.userId})`);

      // Find webhook registration
      const webhookReg = project.webhookRegistrations[0];

      if (!webhookReg) {
        console.log('❌ No webhook registration found - skipping');
        console.log('');
        continue;
      }

      console.log(`Webhook ID: ${webhookReg.webhookId}`);
      console.log(`Subscribed: ${webhookReg.subscribed ? 'YES ✓' : 'NO ✗'}`);

      // Skip if already subscribed
      if (webhookReg.subscribed) {
        console.log('✅ Already subscribed - skipping');
        console.log('');
        continue;
      }

      // Subscribe bot to webhook
      console.log('');
      console.log('📌 Subscribing bot to webhook...');

      try {
        await subscribeWebhook(
          consumerKey,
          consumerSecret,
          project.bot.accessToken,
          project.bot.accessTokenSecret,
          webhookReg.webhookId
        );

        // Update subscription status in database
        await prisma.webhookRegistration.update({
          where: { id: webhookReg.id },
          data: { subscribed: true },
        });

        console.log('✅ Bot successfully subscribed to webhook!');
      } catch (error) {
        console.error('❌ Failed to subscribe bot:', error.message);
      }

      console.log('');
    }

    console.log('==============================================================================');
    console.log('SUBSCRIPTION COMPLETE');
    console.log('==============================================================================');
    console.log('');
  } catch (error) {
    console.error('Error subscribing bots:', error);
  } finally {
    await prisma.$disconnect();
  }
}

subscribeExistingBot();
