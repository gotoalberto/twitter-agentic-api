// Test webhook registration and fix bearer token
const { PrismaClient } = require('./src/generated/prisma');
const { createBearerToken } = require('./src/lib/twitter/bearer-token');
const prisma = new PrismaClient();

async function testAndFixWebhook() {
  console.log('================================================================================');
  console.log('🔧 TESTING WEBHOOK REGISTRATION AND FIXING BEARER TOKEN');
  console.log('================================================================================');
  console.log('');

  try {
    // 1. Get the project with the problem
    const projectId = 'cmj4h4o5y0000gy04oss0g3o9';
    console.log('1️⃣ Fetching project:', projectId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        bot: true,
        twitterApp: true,
        webhookRegistrations: true
      }
    });

    if (!project) {
      console.log('❌ Project not found');
      return;
    }

    console.log('✅ Found project:', project.name);
    console.log('   Bot:', project.bot ? `@${project.bot.username}` : 'None');
    console.log('   TwitterApp:', project.twitterApp ? project.twitterApp.name : 'None');
    console.log('');

    if (!project.twitterApp) {
      console.log('❌ Project has no TwitterApp assigned');
      return;
    }

    const twitterApp = project.twitterApp;
    console.log('2️⃣ TwitterApp Details:');
    console.log('   Name:', twitterApp.name);
    console.log('   ID:', twitterApp.id);
    console.log('   Webhook Env:', twitterApp.webhookEnv);
    console.log('   Has Bearer Token:', !!twitterApp.bearerToken);
    console.log('');

    // 2. Test current bearer token
    console.log('3️⃣ Testing current bearer token...');

    if (twitterApp.bearerToken) {
      const testResponse = await fetch('https://api.twitter.com/2/users/by/username/twitter', {
        headers: {
          'Authorization': `Bearer ${twitterApp.bearerToken}`
        }
      });

      if (testResponse.ok) {
        console.log('✅ Current bearer token is valid');
      } else {
        console.log('❌ Current bearer token is invalid or expired');
        console.log('   Status:', testResponse.status);
        const error = await testResponse.text();
        console.log('   Error:', error);
      }
    } else {
      console.log('❌ No bearer token configured');
    }
    console.log('');

    // 3. Generate new bearer token
    console.log('4️⃣ Generating new bearer token...');

    try {
      const newBearerToken = await createBearerToken(
        twitterApp.consumerKey,
        twitterApp.consumerSecret
      );

      console.log('✅ Bearer token generated successfully');

      // Update in database
      await prisma.twitterApp.update({
        where: { id: twitterApp.id },
        data: { bearerToken: newBearerToken }
      });

      console.log('✅ Bearer token updated in database');
      console.log('');

      // 4. Test webhook operations with new token
      console.log('5️⃣ Testing webhook operations with new token...');

      // List webhooks
      const webhookEnv = twitterApp.webhookEnv || 'production';
      const listUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/webhooks.json`;

      const listResponse = await fetch(listUrl, {
        headers: {
          'Authorization': `Bearer ${newBearerToken}`
        }
      });

      if (listResponse.ok) {
        const webhooks = await listResponse.json();
        console.log(`✅ Successfully listed webhooks: ${webhooks.length} found`);

        webhooks.forEach(w => {
          console.log(`   - ID: ${w.id}`);
          console.log(`     URL: ${w.url}`);
          console.log(`     Valid: ${w.valid}`);
        });
      } else {
        const error = await listResponse.text();
        console.log('❌ Failed to list webhooks:', error);
        console.log('   Status:', listResponse.status);
      }
      console.log('');

      // 5. Try to register webhook using OAuth 1.0a
      console.log('6️⃣ Attempting webhook registration with OAuth 1.0a...');

      const OAuth = require('oauth-1.0a');
      const crypto = require('crypto');

      const oauth = new OAuth({
        consumer: {
          key: twitterApp.consumerKey,
          secret: twitterApp.consumerSecret
        },
        signature_method: 'HMAC-SHA1',
        hash_function(base_string, key) {
          return crypto.createHmac('sha1', key).update(base_string).digest('base64');
        }
      });

      const webhookUrl = `https://bitso-twitter-api.vercel.app/api/webhooks/twitter/${twitterApp.id}`;
      console.log('   Webhook URL:', webhookUrl);

      const registerUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/webhooks.json`;

      const registerData = {
        url: registerUrl,
        method: 'POST'
      };

      const registerHeaders = oauth.toHeader(oauth.authorize(registerData));

      const registerResponse = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          ...registerHeaders,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `url=${encodeURIComponent(webhookUrl)}`
      });

      if (registerResponse.ok) {
        const webhook = await registerResponse.json();
        console.log('✅ Webhook registered successfully!');
        console.log('   Webhook ID:', webhook.id);

        // Save to database
        await prisma.webhookRegistration.create({
          data: {
            projectId: projectId,
            webhookId: webhook.id,
            url: webhookUrl,
            subscribed: false
          }
        });

        console.log('✅ Saved to database');
      } else {
        const error = await registerResponse.text();
        console.log('❌ Failed to register webhook');
        console.log('   Status:', registerResponse.status);
        console.log('   Error:', error);

        // Try to parse error
        try {
          const errorObj = JSON.parse(error);
          if (errorObj.errors && errorObj.errors[0]) {
            console.log('   Error code:', errorObj.errors[0].code);
            console.log('   Error message:', errorObj.errors[0].message);

            if (errorObj.errors[0].code === 214) {
              console.log('   ℹ️  This usually means the webhook URL already exists');
            }
          }
        } catch (e) {}
      }

    } catch (tokenError) {
      console.error('❌ Failed to generate bearer token:', tokenError.message);

      if (tokenError.message.includes('401')) {
        console.log('   ⚠️  The consumer key/secret appear to be invalid');
        console.log('   Please check the TwitterApp credentials in the database');
      }
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
testAndFixWebhook();