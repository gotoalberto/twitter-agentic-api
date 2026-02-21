// Test the NEW X API v2 webhook system
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function testNewWebhookAPI() {
  console.log('================================================================================');
  console.log('🚀 TESTING NEW X API v2 WEBHOOK SYSTEM');
  console.log('================================================================================');
  console.log('');

  try {
    // Get the project
    const projectId = 'cmj4h4o5y0000gy04oss0g3o9';
    console.log('1️⃣ Fetching project:', projectId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        twitterApp: true,
        webhookRegistrations: true
      }
    });

    if (!project || !project.twitterApp) {
      console.log('❌ Project or TwitterApp not found');
      return;
    }

    const twitterApp = project.twitterApp;
    console.log('✅ Found TwitterApp:', twitterApp.name);
    console.log('   ID:', twitterApp.id);
    console.log('');

    // First, let's test if bearer token actually works with basic API call
    console.log('2️⃣ Testing Bearer Token with basic API call...');

    // Test with a simple v2 endpoint
    const testResponse = await fetch('https://api.x.com/2/users/by/username/twitter', {
      headers: {
        'Authorization': `Bearer ${twitterApp.bearerToken}`
      }
    });

    console.log('   Response status:', testResponse.status);

    if (!testResponse.ok) {
      console.log('❌ Bearer token test failed');
      const error = await testResponse.text();
      console.log('   Error:', error);
      console.log('');
      console.log('   Let\'s try generating a fresh bearer token...');

      // Try to generate bearer token
      const credentials = Buffer.from(
        `${encodeURIComponent(twitterApp.consumerKey)}:${encodeURIComponent(twitterApp.consumerSecret)}`
      ).toString('base64');

      const tokenResponse = await fetch('https://api.twitter.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: 'grant_type=client_credentials',
      });

      if (!tokenResponse.ok) {
        const tokenError = await tokenResponse.text();
        console.log('   ❌ Cannot generate bearer token:', tokenError);
        console.log('');
        console.log('   ⚠️  IMPORTANT: The Consumer Key/Secret might be incorrect');
        return;
      }

      const tokenData = await tokenResponse.json();
      const newBearerToken = tokenData.access_token;
      console.log('   ✅ Generated new bearer token:', newBearerToken.substring(0, 30) + '...');

      // Update in database
      await prisma.twitterApp.update({
        where: { id: twitterApp.id },
        data: { bearerToken: newBearerToken }
      });

      twitterApp.bearerToken = newBearerToken;
      console.log('   ✅ Bearer token updated in database');
    } else {
      const data = await testResponse.json();
      console.log('✅ Bearer token is valid! Twitter user ID:', data.data.id);
    }
    console.log('');

    // Now test the NEW webhook API v2
    console.log('3️⃣ Testing NEW X API v2 Webhook System...');
    console.log('   Endpoint: POST https://api.x.com/2/webhooks');

    const webhookUrl = `https://bitso-twitter-api.vercel.app/api/webhooks/twitter/${twitterApp.id}`;
    console.log('   Webhook URL:', webhookUrl);
    console.log('');

    // List existing webhooks first
    console.log('4️⃣ Listing existing webhooks with v2 API...');
    const listResponse = await fetch('https://api.x.com/2/webhooks', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${twitterApp.bearerToken}`
      }
    });

    console.log('   List webhooks response status:', listResponse.status);

    if (listResponse.ok) {
      const webhooks = await listResponse.json();
      console.log('   ✅ Successfully listed webhooks:');
      console.log('   Response:', JSON.stringify(webhooks, null, 2));

      if (webhooks.data && webhooks.data.length > 0) {
        console.log(`   Found ${webhooks.data.length} webhook(s):`);
        webhooks.data.forEach(w => {
          console.log(`     - ID: ${w.id}, URL: ${w.url}, Valid: ${w.valid}`);
        });
      } else {
        console.log('   No webhooks registered yet');
      }
    } else {
      const error = await listResponse.text();
      console.log('   ❌ Failed to list webhooks:', error);
    }
    console.log('');

    // Try to register a new webhook with v2 API
    console.log('5️⃣ Attempting to register webhook with NEW v2 API...');

    const registerResponse = await fetch('https://api.x.com/2/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${twitterApp.bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl
      })
    });

    console.log('   Register response status:', registerResponse.status);
    const registerData = await registerResponse.text();

    if (registerResponse.ok) {
      const webhook = JSON.parse(registerData);
      console.log('✅ WEBHOOK REGISTERED SUCCESSFULLY WITH NEW API!');
      console.log('   Webhook ID:', webhook.id || webhook.data?.id);
      console.log('   Full response:', JSON.stringify(webhook, null, 2));

      // Save to database if successful
      if (webhook.id || webhook.data?.id) {
        const webhookId = webhook.id || webhook.data.id;

        const existing = await prisma.webhookRegistration.findFirst({
          where: {
            projectId: projectId,
            webhookId: webhookId
          }
        });

        if (!existing) {
          await prisma.webhookRegistration.create({
            data: {
              projectId: projectId,
              webhookId: webhookId,
              url: webhookUrl,
              subscribed: false
            }
          });
          console.log('   ✅ Saved webhook registration to database');
        }
      }
    } else {
      console.log('❌ Failed to register webhook with v2 API');
      console.log('   Error:', registerData);

      try {
        const errorObj = JSON.parse(registerData);
        if (errorObj.errors) {
          console.log('   Error details:', JSON.stringify(errorObj.errors, null, 2));
        }
      } catch {}
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    console.log('');
    console.log('================================================================================');
    await prisma.$disconnect();
  }
}

// Run the test
testNewWebhookAPI();