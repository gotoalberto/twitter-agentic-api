// Test webhook registration with Hivemind user
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function testWebhookWithHivemind() {
  console.log('================================================================================');
  console.log('🧪 TESTING WEBHOOK REGISTRATION WITH HIVEMIND USER');
  console.log('================================================================================');
  console.log('');

  try {
    // 1. Get a Hivemind user
    console.log('1️⃣ Fetching Hivemind user...');
    const hivemindUser = await prisma.hivemindUser.findFirst();

    if (!hivemindUser) {
      console.log('❌ No Hivemind users found in database');
      return;
    }

    console.log(`✅ Found Hivemind user: @${hivemindUser.username}`);
    console.log(`   User ID: ${hivemindUser.userId}`);
    console.log('');

    // 2. Get a TwitterApp to use for testing
    console.log('2️⃣ Fetching TwitterApp...');
    const twitterApp = await prisma.twitterApp.findFirst();

    if (!twitterApp) {
      console.log('❌ No TwitterApp found in database');
      return;
    }

    console.log(`✅ Found TwitterApp: ${twitterApp.name}`);
    console.log(`   App ID: ${twitterApp.id}`);
    console.log('');

    // 3. Check what webhooks are currently registered
    console.log('3️⃣ Checking current webhooks for this app...');

    const OAuth = require('oauth-1.0a');
    const crypto = require('crypto');

    // Create OAuth 1.0a instance
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

    // List webhooks
    const webhookEnv = process.env.TWITTER_WEBHOOK_ENV || 'production';
    const listUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/webhooks.json`;

    const listResponse = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${twitterApp.bearerToken}`
      }
    });

    if (!listResponse.ok) {
      const error = await listResponse.text();
      console.log('❌ Failed to list webhooks:', error);
      console.log('   Status:', listResponse.status);
      console.log('');
    } else {
      const webhooks = await listResponse.json();
      console.log(`✅ Found ${webhooks.length} webhook(s) registered:`);
      webhooks.forEach(w => {
        console.log(`   - ID: ${w.id}`);
        console.log(`     URL: ${w.url}`);
        console.log(`     Valid: ${w.valid}`);
      });
      console.log('');
    }

    // 4. Try to register a new webhook
    console.log('4️⃣ Attempting to register test webhook...');
    const webhookUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twitter/${twitterApp.id}`;
    console.log(`   Webhook URL: ${webhookUrl}`);

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

    if (!registerResponse.ok) {
      const error = await registerResponse.text();
      console.log('❌ Failed to register webhook:', error);
      console.log('   Status:', registerResponse.status);

      // Parse error if JSON
      try {
        const errorObj = JSON.parse(error);
        if (errorObj.errors) {
          console.log('   Error details:', errorObj.errors[0]);
        }
      } catch (e) {}
      console.log('');
    } else {
      const webhook = await registerResponse.json();
      console.log('✅ Webhook registered successfully!');
      console.log(`   Webhook ID: ${webhook.id}`);
      console.log('');

      // 5. Try to subscribe the Hivemind user
      console.log('5️⃣ Attempting to subscribe Hivemind user to webhook...');

      // Decrypt tokens
      const { decrypt } = require('./src/lib/utils/encryption');
      const accessToken = decrypt(hivemindUser.accessToken);
      const accessTokenSecret = decrypt(hivemindUser.accessTokenSecret);

      const subscribeUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/subscriptions.json`;

      const subscribeData = {
        url: subscribeUrl,
        method: 'POST'
      };

      const token = {
        key: accessToken,
        secret: accessTokenSecret
      };

      const subscribeHeaders = oauth.toHeader(oauth.authorize(subscribeData, token));

      const subscribeResponse = await fetch(subscribeUrl, {
        method: 'POST',
        headers: {
          ...subscribeHeaders,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!subscribeResponse.ok) {
        const error = await subscribeResponse.text();
        console.log('❌ Failed to subscribe user:', error);
        console.log('   Status:', subscribeResponse.status);
      } else {
        console.log('✅ User subscribed successfully!');
      }
    }

    // 6. Check subscription status
    console.log('');
    console.log('6️⃣ Checking subscription status...');

    const checkUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/subscriptions/list.json`;

    const checkResponse = await fetch(checkUrl, {
      headers: {
        'Authorization': `Bearer ${twitterApp.bearerToken}`
      }
    });

    if (!checkResponse.ok) {
      const error = await checkResponse.text();
      console.log('❌ Failed to list subscriptions:', error);
    } else {
      const subscriptions = await checkResponse.json();
      console.log(`✅ Found ${subscriptions.subscriptions.length} subscription(s)`);
      if (subscriptions.subscriptions.includes(hivemindUser.userId)) {
        console.log(`   ✅ Hivemind user ${hivemindUser.username} is subscribed!`);
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
testWebhookWithHivemind();