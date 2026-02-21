const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function testWebhookForProject(projectId) {
  try {
    console.log('================================================================================');
    console.log('TESTING WEBHOOK FOR PROJECT:', projectId);
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

    if (!project.twitterApp) {
      console.log('❌ No TwitterApp configured for project');
      return;
    }

    if (!project.twitterApp.bearerToken) {
      console.log('❌ No Bearer Token configured for TwitterApp');
      return;
    }

    console.log('📁 Project:', project.name);
    console.log('🔑 TwitterApp:', project.twitterApp.name);
    console.log('🤖 Bot:', project.bot ? `@${project.bot.username}` : 'Not connected');
    console.log('');

    // Test 1: List webhooks using v2 API
    console.log('📋 Test 1: Listing webhooks using Twitter API v2...');
    console.log('   Endpoint: GET https://api.twitter.com/2/webhooks');
    console.log('   Auth: Bearer Token');
    console.log('');

    try {
      const response = await fetch('https://api.twitter.com/2/webhooks', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${project.twitterApp.bearerToken}`,
        }
      });

      console.log('   Response Status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ Success! Response:', JSON.stringify(data, null, 2));

        if (data.data && data.data.length > 0) {
          console.log('\n   📡 Registered Webhooks:');
          data.data.forEach(webhook => {
            console.log(`      ID: ${webhook.id}`);
            console.log(`      URL: ${webhook.url}`);
            console.log(`      Valid: ${webhook.valid}`);
            console.log(`      Created: ${webhook.created_at}`);
            console.log('      ---');
          });
        } else {
          console.log('   ⚠️  No webhooks registered for this app');
        }
      } else {
        const error = await response.text();
        console.log('   ❌ Error:', error);
      }
    } catch (error) {
      console.error('   ❌ Request failed:', error.message);
    }

    console.log('');

    // Test 2: Check if webhook exists in our database
    console.log('📋 Test 2: Checking webhook registrations in database...');
    if (project.webhookRegistrations.length > 0) {
      console.log('   ✅ Found webhook registrations in database:');
      project.webhookRegistrations.forEach(reg => {
        console.log(`      ID: ${reg.webhookId}`);
        console.log(`      URL: ${reg.url}`);
        console.log(`      Subscribed: ${reg.subscribed}`);
        console.log(`      Created: ${reg.createdAt}`);
      });
    } else {
      console.log('   ⚠️  No webhook registrations in database');
    }

    console.log('');

    // Test 3: Try to register a webhook (will likely fail without TAAS)
    console.log('📋 Test 3: Testing webhook registration (v1.1 - requires TAAS)...');

    if (!project.twitterApp.consumerKey || !project.twitterApp.consumerSecret) {
      console.log('   ❌ Cannot test - OAuth 1.0a credentials not configured');
    } else {
      const webhookUrl = `https://bitso-twitter-api.vercel.app/api/webhooks/twitter/${project.twitterApp.id}`;
      const apiUrl = 'https://api.twitter.com/1.1/account_activity/all/production/webhooks.json';

      console.log('   Endpoint:', apiUrl);
      console.log('   Webhook URL:', webhookUrl);
      console.log('   Auth: OAuth 1.0a (App-only)');
      console.log('');

      // Note: This is simplified - actual OAuth 1.0a requires proper signature
      console.log('   ⚠️  Note: v1.1 webhook registration requires TAAS access');
      console.log('   ⚠️  Most new apps do NOT have this access');
      console.log('   ⚠️  Expected result: 403 Forbidden');
    }

    console.log('\n================================================================================');
    console.log('SUMMARY');
    console.log('================================================================================');

    // Check if everything is configured correctly
    const issues = [];

    if (!project.bot) {
      issues.push('Bot not connected');
    } else if (!project.bot.accessToken || !project.bot.accessTokenSecret) {
      issues.push('Bot missing OAuth 1.0a tokens (needed for subscriptions)');
    }

    if (!project.twitterApp.bearerToken) {
      issues.push('Bearer Token not configured');
    }

    if (!project.twitterApp.consumerKey || !project.twitterApp.consumerSecret) {
      issues.push('OAuth 1.0a app credentials not configured (needed for webhook registration)');
    }

    if (issues.length > 0) {
      console.log('❌ Issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('✅ All credentials configured correctly');
      console.log('');
      console.log('📌 Next steps:');
      console.log('   1. Check if webhooks are listed in Twitter API response above');
      console.log('   2. If no webhooks exist, manual registration may be needed');
      console.log('   3. Most apps cannot register new webhooks without TAAS access');
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
  console.log('Usage: node test-webhook.js <project-id>');
  process.exit(1);
}

testWebhookForProject(projectId);