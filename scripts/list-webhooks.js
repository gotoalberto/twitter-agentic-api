const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function listWebhooks(twitterAppId) {
  try {
    console.log('================================================================================');
    console.log('LISTING WEBHOOKS VIA X API v2');
    console.log('================================================================================\n');

    // Get TwitterApp
    const app = await prisma.twitterApp.findUnique({
      where: { id: twitterAppId }
    });

    if (!app) {
      console.log('❌ TwitterApp not found:', twitterAppId);
      return;
    }

    console.log('🔑 TwitterApp:', app.name);
    console.log('   Bearer Token:', app.bearerToken ? '✅ Set' : '❌ Missing');
    console.log('');

    if (!app.bearerToken) {
      console.log('❌ Cannot list webhooks - Bearer Token is missing');
      return;
    }

    // List webhooks using X API v2
    console.log('📡 Calling X API v2: GET /2/webhooks');
    console.log('');

    const response = await fetch('https://api.x.com/2/webhooks', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${app.bearerToken}`,
      }
    });

    console.log('Response Status:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      const webhooks = data.data || [];

      console.log(`\n✅ Found ${webhooks.length} webhook(s):\n`);

      webhooks.forEach((webhook, index) => {
        console.log(`📌 Webhook ${index + 1}:`);
        console.log(`   ID: ${webhook.id}`);
        console.log(`   URL: ${webhook.url}`);
        console.log(`   Valid: ${webhook.valid}`);
        console.log(`   Created: ${webhook.created_at}`);
        console.log('');
      });

      if (webhooks.length === 0) {
        console.log('   No webhooks registered for this app');
      }
    } else {
      const errorText = await response.text();
      console.log('❌ Failed to list webhooks:');
      console.log('   Error:', errorText);
    }

    console.log('================================================================================\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get TwitterApp ID from command line
const appId = process.argv[2] || 'cmlwr6ynj0000jj041q5jsjoc'; // Default to goodboy-new
listWebhooks(appId);