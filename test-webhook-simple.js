// Simple test webhook registration
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function testWebhook() {
  console.log('================================================================================');
  console.log('🔧 TESTING WEBHOOK REGISTRATION');
  console.log('================================================================================');
  console.log('');

  try {
    // 1. Get the project
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
    console.log('   Webhook Registrations:', project.webhookRegistrations.length);
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
    console.log('   Has Consumer Key:', !!twitterApp.consumerKey);
    console.log('   Has Consumer Secret:', !!twitterApp.consumerSecret);
    console.log('');

    // 3. Test current bearer token
    console.log('3️⃣ Testing current bearer token...');

    if (!twitterApp.bearerToken) {
      console.log('❌ No bearer token configured');
      console.log('   Need to generate one using consumer key/secret');
    } else {
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
        console.log('');
        console.log('   Need to refresh the bearer token');
      }
    }
    console.log('');

    // 4. Test webhook list with bearer token
    if (twitterApp.bearerToken) {
      console.log('4️⃣ Listing webhooks using Twitter API v2...');

      const listUrl = 'https://api.twitter.com/2/webhooks';
      const listResponse = await fetch(listUrl, {
        headers: {
          'Authorization': `Bearer ${twitterApp.bearerToken}`
        }
      });

      if (listResponse.ok) {
        const data = await listResponse.json();
        const webhooks = data.data || [];
        console.log(`✅ Successfully listed webhooks: ${webhooks.length} found`);

        webhooks.forEach(w => {
          console.log(`   - ID: ${w.id}`);
          console.log(`     URL: ${w.url}`);
          console.log(`     Valid: ${w.valid}`);
        });
      } else {
        const error = await listResponse.text();
        console.log('❌ Failed to list webhooks via v2:', error);
        console.log('   Status:', listResponse.status);
      }
      console.log('');
    }

    // 5. Try OAuth 1.0a webhook registration
    console.log('5️⃣ Testing OAuth 1.0a webhook registration...');

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

    const webhookUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://hive.pepes.dog'}/api/webhooks/twitter/${twitterApp.id}`;
    console.log('   Webhook URL:', webhookUrl);

    const webhookEnv = twitterApp.webhookEnv || 'production';
    const registerUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/webhooks.json`;

    const registerData = {
      url: registerUrl,
      method: 'POST'
    };

    const registerHeaders = oauth.toHeader(oauth.authorize(registerData));

    console.log('   Making registration request to Twitter API v1.1...');
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
      console.log('   Webhook URL:', webhook.url);

      // Save to database
      const existing = await prisma.webhookRegistration.findFirst({
        where: {
          projectId: projectId,
          webhookId: webhook.id
        }
      });

      if (!existing) {
        await prisma.webhookRegistration.create({
          data: {
            projectId: projectId,
            webhookId: webhook.id,
            url: webhookUrl,
            subscribed: false
          }
        });
        console.log('✅ Saved to database');
      }
    } else {
      const error = await registerResponse.text();
      console.log('❌ Failed to register webhook');
      console.log('   Status:', registerResponse.status);
      console.log('   Error:', error);

      // Parse error
      try {
        const errorObj = JSON.parse(error);
        if (errorObj.errors && errorObj.errors[0]) {
          console.log('   Error code:', errorObj.errors[0].code);
          console.log('   Error message:', errorObj.errors[0].message);

          if (errorObj.errors[0].code === 214) {
            console.log('   ℹ️  This means the webhook URL is already registered');
          } else if (errorObj.errors[0].code === 89) {
            console.log('   ℹ️  Invalid or expired token - need to refresh credentials');
          }
        }
      } catch (e) {}
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
testWebhook();