const { PrismaClient } = require('../src/generated/prisma');
const { TwitterApi } = require('twitter-api-v2');

const prisma = new PrismaClient();

async function checkWebhookSubscription(projectId) {
  try {
    console.log('================================================================================');
    console.log('CHECKING WEBHOOK SUBSCRIPTION STATUS');
    console.log('================================================================================\n');

    // Get project with all relationships
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        bot: true,
        twitterApp: true,
        webhookRegistrations: true,
      }
    });

    if (!project) {
      console.log('❌ Project not found!');
      return;
    }

    console.log('📁 Project:', project.name);
    console.log('🔑 TwitterApp:', project.twitterApp?.name || 'None');
    console.log('🤖 Bot:', project.bot ? `@${project.bot.username} (ID: ${project.bot.userId})` : 'Not connected');
    console.log('');

    // Check if bot has OAuth 1.0a tokens
    if (project.bot) {
      console.log('📋 Bot OAuth Tokens:');
      console.log('   Access Token:', project.bot.accessToken ? '✅ Present' : '❌ Missing');
      console.log('   Access Token Secret:', project.bot.accessTokenSecret ? '✅ Present' : '❌ Missing');
      console.log('');
    }

    // Check webhook registrations
    if (project.webhookRegistrations.length > 0) {
      console.log('📡 Webhook Registrations:');
      project.webhookRegistrations.forEach(reg => {
        console.log(`   Webhook ID: ${reg.webhookId}`);
        console.log(`   URL: ${reg.url}`);
        console.log(`   Subscribed: ${reg.subscribed ? '✅ YES' : '❌ NO'}`);
        console.log(`   Created: ${reg.createdAt}`);
        console.log('');
      });

      // Check actual subscription status with Twitter API
      if (project.bot?.accessToken && project.bot?.accessTokenSecret && project.twitterApp) {
        console.log('🔍 Checking subscription status with Twitter API...\n');

        try {
          // Create OAuth 1.0a client with user tokens
          const userClient = new TwitterApi({
            appKey: project.twitterApp.consumerKey,
            appSecret: project.twitterApp.consumerSecret,
            accessToken: project.bot.accessToken,
            accessTokenSecret: project.bot.accessTokenSecret,
          });

          // Try v1.1 API first
          try {
            const webhookId = project.webhookRegistrations[0].webhookId;
            const url = `https://api.twitter.com/1.1/account_activity/all/production/subscriptions.json`;

            console.log('   Testing v1.1 subscription endpoint...');
            const v1Response = await userClient.v1.get('account_activity/all/production/subscriptions.json');
            console.log('   ✅ Bot IS subscribed (v1.1 API confirmed)');
            console.log('   Subscription active:', v1Response);
          } catch (v1Error) {
            if (v1Error.code === 404) {
              console.log('   ❌ Bot is NOT subscribed (404 - subscription not found)');
              console.log('   Need to subscribe the bot to the webhook');
            } else {
              console.log('   ⚠️  v1.1 API error:', v1Error.message);
            }
          }

          console.log('');

          // Also try v2 API
          if (project.twitterApp.bearerToken) {
            console.log('   Testing v2 webhook list endpoint...');
            const response = await fetch('https://api.twitter.com/2/webhooks', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${project.twitterApp.bearerToken}`,
              }
            });

            if (response.ok) {
              const data = await response.json();
              if (data.data && data.data.length > 0) {
                console.log('   ✅ Webhooks found in v2 API:');
                data.data.forEach(webhook => {
                  const isOurWebhook = project.webhookRegistrations.some(reg => reg.webhookId === webhook.id);
                  console.log(`      ID: ${webhook.id} ${isOurWebhook ? '(This is our webhook)' : ''}`);
                  console.log(`      URL: ${webhook.url}`);
                  console.log(`      Valid: ${webhook.valid}`);
                });
              } else {
                console.log('   ⚠️  No webhooks found in v2 API');
              }
            }
          }

        } catch (error) {
          console.error('   ❌ Error checking subscription:', error.message);
        }
      } else {
        console.log('⚠️  Cannot check subscription - missing OAuth tokens or TwitterApp');
      }
    } else {
      console.log('❌ No webhook registrations found in database');
    }

    console.log('\n================================================================================');
    console.log('SUBSCRIPTION FIX INSTRUCTIONS');
    console.log('================================================================================\n');

    if (project.bot && project.webhookRegistrations.length > 0) {
      const reg = project.webhookRegistrations[0];
      if (!reg.subscribed || !project.bot.accessToken || !project.bot.accessTokenSecret) {
        console.log('To subscribe the bot to the webhook, run:');
        console.log('');
        console.log(`node scripts/subscribe-bot-to-webhook.js ${projectId}`);
        console.log('');
        console.log('This will:');
        console.log('1. Use the bot\'s OAuth 1.0a tokens to subscribe');
        console.log('2. Enable the bot to receive webhook events');
        console.log('3. Update the subscription status in the database');
      } else {
        console.log('✅ Bot appears to be properly configured for webhooks');
        console.log('');
        console.log('If events are still not appearing:');
        console.log('1. Check that mentions include the exact handle @' + project.bot.username);
        console.log('2. Verify the webhook URL is accessible: ' + reg.url);
        console.log('3. Check Vercel logs for incoming webhook events');
        console.log('4. Ensure forwarding endpoints are configured and active');
      }
    }

    console.log('\n================================================================================\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get project ID from command line
const projectId = process.argv[2];
if (!projectId) {
  console.log('Usage: node check-webhook-subscription.js <project-id>');
  console.log('Example: node check-webhook-subscription.js cmj4h4o5y0000gy04oss0g3o9');
  process.exit(1);
}

checkWebhookSubscription(projectId);