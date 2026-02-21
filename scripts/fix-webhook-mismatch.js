const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function fixWebhookMismatch(projectId) {
  try {
    console.log('================================================================================');
    console.log('FIXING WEBHOOK MISMATCH FOR PROJECT:', projectId);
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
    console.log('🤖 Bot:', project.bot ? `@${project.bot.username}` : 'Not connected');
    console.log('');

    // Step 1: Check current webhook registrations
    console.log('📋 Step 1: Current webhook registrations in database:');
    if (project.webhookRegistrations.length > 0) {
      project.webhookRegistrations.forEach(reg => {
        console.log(`   ID: ${reg.webhookId}`);
        console.log(`   URL: ${reg.url}`);
        console.log(`   Subscribed: ${reg.subscribed}`);
        console.log(`   Created: ${reg.createdAt}`);
      });
    } else {
      console.log('   None found');
    }
    console.log('');

    // Step 2: Check what webhooks actually exist in Twitter
    if (project.twitterApp?.bearerToken) {
      console.log('📋 Step 2: Checking webhooks in Twitter API...');

      const response = await fetch('https://api.twitter.com/2/webhooks', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${project.twitterApp.bearerToken}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   Found ${data.meta?.result_count || 0} webhook(s) in Twitter`);

        if (data.data && data.data.length > 0) {
          data.data.forEach(webhook => {
            console.log(`   - ID: ${webhook.id}, URL: ${webhook.url}`);
          });
        }
      } else {
        console.log('   ❌ Failed to check Twitter webhooks');
      }
    } else {
      console.log('   ⚠️  Cannot check - no Bearer Token');
    }
    console.log('');

    // Step 3: Clean up mismatched webhook registrations
    console.log('📋 Step 3: Cleaning up mismatched webhook registrations...');

    const oldWebhookId = '1999190094972911617'; // The old webhook that doesn't belong to this app

    const deleted = await prisma.webhookRegistration.deleteMany({
      where: {
        projectId: projectId,
        webhookId: oldWebhookId
      }
    });

    if (deleted.count > 0) {
      console.log(`   ✅ Deleted ${deleted.count} mismatched webhook registration(s)`);
      console.log(`   Removed webhook ID: ${oldWebhookId}`);
    } else {
      console.log('   No mismatched webhooks to clean up');
    }
    console.log('');

    // Step 4: Provide next steps
    console.log('================================================================================');
    console.log('NEXT STEPS');
    console.log('================================================================================');
    console.log('');

    console.log('The mismatched webhook has been cleaned up. Now you need to:');
    console.log('');
    console.log('1. IMPORTANT: The TwitterApp "goodboy-new" has NO webhooks registered in Twitter');
    console.log('2. Webhook registration requires TAAS access (most new apps do NOT have this)');
    console.log('3. Options:');
    console.log('');
    console.log('   Option A: Manual webhook registration (if you have TAAS access):');
    console.log('   - Use Twitter Developer Portal to manually register the webhook');
    console.log('   - URL should be: https://bitso-twitter-api.vercel.app/api/webhooks/twitter/cmlwr6ynj0000jj041q5jsjoc');
    console.log('');
    console.log('   Option B: Use a different TwitterApp that already has webhooks:');
    console.log('   - Switch to a TwitterApp that already has registered webhooks');
    console.log('   - Update the project to use that TwitterApp instead');
    console.log('');
    console.log('   Option C: Contact Twitter/X support:');
    console.log('   - Request TAAS access for your app');
    console.log('   - Or request manual webhook registration');
    console.log('');

    if (!project.bot?.accessToken || !project.bot?.accessTokenSecret) {
      console.log('⚠️  ADDITIONAL ISSUE: Bot lacks OAuth 1.0a tokens');
      console.log('   - The bot needs to be reconnected with OAuth 1.0a (not OAuth 2.0)');
      console.log('   - Use: https://bitso-twitter-api.vercel.app/api/projects/' + projectId + '/bot/authorize-oauth1');
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
  console.log('Usage: node fix-webhook-mismatch.js <project-id>');
  process.exit(1);
}

fixWebhookMismatch(projectId);