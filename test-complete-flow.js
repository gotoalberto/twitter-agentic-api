// Complete test flow for webhook registration issue
const { PrismaClient } = require('./src/generated/prisma');
const { decrypt } = require('./src/lib/utils/encryption');
const crypto = require('crypto');
const OAuth = require('oauth-1.0a');

const prisma = new PrismaClient();

// Test configuration
const PROJECT_ID = 'cmj4h4o5y0000gy04oss0g3o9';

async function testCompleteFlow() {
  console.log('================================================================================');
  console.log('🔍 COMPLETE WEBHOOK REGISTRATION TEST FLOW');
  console.log('================================================================================');
  console.log('');

  try {
    // Step 1: Get project and TwitterApp
    console.log('1️⃣ FETCHING PROJECT AND TWITTERAPP');
    console.log('────────────────────────────────────');

    const project = await prisma.project.findUnique({
      where: { id: PROJECT_ID },
      include: {
        twitterApp: true,
        bot: true,
        webhookRegistrations: true
      }
    });

    if (!project) {
      console.log('❌ Project not found');
      return;
    }

    console.log('✅ Project found:', project.name);
    console.log('   ID:', project.id);

    if (!project.twitterApp) {
      console.log('❌ No TwitterApp associated with this project');
      return;
    }

    console.log('✅ TwitterApp found:', project.twitterApp.name);
    console.log('   App ID:', project.twitterApp.id);
    console.log('');

    // Step 2: Test credential decryption
    console.log('2️⃣ TESTING CREDENTIAL DECRYPTION');
    console.log('────────────────────────────────────');

    const twitterApp = project.twitterApp;

    // Check raw stored values
    console.log('📦 Raw stored values:');
    console.log('   Consumer Key (encrypted):', twitterApp.consumerKey.substring(0, 50) + '...');
    console.log('   Length:', twitterApp.consumerKey.length);
    console.log('   Contains colons:', twitterApp.consumerKey.includes(':') ? 'YES' : 'NO');

    // Try to decrypt
    let decryptedKey, decryptedSecret, decryptedBearer;

    try {
      decryptedKey = decrypt(twitterApp.consumerKey);
      console.log('✅ Consumer Key decrypted successfully');
      console.log('   Decrypted:', decryptedKey);
      console.log('   Length:', decryptedKey.length);
    } catch (error) {
      console.log('❌ Failed to decrypt Consumer Key:', error.message);
      return;
    }

    try {
      decryptedSecret = decrypt(twitterApp.consumerSecret);
      console.log('✅ Consumer Secret decrypted successfully');
      console.log('   Length:', decryptedSecret.length);
    } catch (error) {
      console.log('❌ Failed to decrypt Consumer Secret:', error.message);
      return;
    }

    try {
      decryptedBearer = decrypt(twitterApp.bearerToken);
      console.log('✅ Bearer Token decrypted successfully');
      console.log('   Token:', decryptedBearer.substring(0, 30) + '...');
    } catch (error) {
      console.log('❌ Failed to decrypt Bearer Token:', error.message);
      return;
    }
    console.log('');

    // Step 3: Test Bearer Token with basic API call
    console.log('3️⃣ TESTING BEARER TOKEN WITH TWITTER API');
    console.log('────────────────────────────────────────');

    const testResponse = await fetch('https://api.twitter.com/2/users/by/username/twitter', {
      headers: {
        'Authorization': `Bearer ${decryptedBearer}`
      }
    });

    console.log('Response status:', testResponse.status);

    if (testResponse.ok) {
      const data = await testResponse.json();
      console.log('✅ Bearer token is VALID!');
      console.log('   Twitter user ID:', data.data.id);
    } else {
      console.log('❌ Bearer token is INVALID');
      const error = await testResponse.text();
      console.log('   Error:', error);

      // Try to regenerate bearer token
      console.log('');
      console.log('   Attempting to regenerate bearer token...');

      const credentials = Buffer.from(
        `${encodeURIComponent(decryptedKey)}:${encodeURIComponent(decryptedSecret)}`
      ).toString('base64');

      const tokenResponse = await fetch('https://api.twitter.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: 'grant_type=client_credentials',
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        decryptedBearer = tokenData.access_token;
        console.log('✅ New bearer token generated successfully');

        // Update in database (encrypted)
        const { encrypt } = require('./src/lib/utils/encryption');
        await prisma.twitterApp.update({
          where: { id: twitterApp.id },
          data: { bearerToken: encrypt(decryptedBearer) }
        });
        console.log('✅ Bearer token updated in database');
      } else {
        const tokenError = await tokenResponse.text();
        console.log('❌ Failed to regenerate bearer token:', tokenError);
        console.log('');
        console.log('⚠️  The Consumer Key/Secret appear to be invalid');
        return;
      }
    }
    console.log('');

    // Step 4: Test OAuth 1.0a for webhook registration
    console.log('4️⃣ TESTING OAUTH 1.0A WEBHOOK REGISTRATION');
    console.log('────────────────────────────────────────');

    const oauth = new OAuth({
      consumer: {
        key: decryptedKey,
        secret: decryptedSecret
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
      }
    });

    const webhookEnv = twitterApp.webhookEnv || 'production';
    const listUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/webhooks.json`;

    console.log('Webhook environment:', webhookEnv);
    console.log('List webhooks URL:', listUrl);

    const listRequest = {
      url: listUrl,
      method: 'GET'
    };

    const listHeaders = oauth.toHeader(oauth.authorize(listRequest));

    const listResponse = await fetch(listUrl, {
      headers: listHeaders
    });

    console.log('List webhooks response:', listResponse.status);

    if (listResponse.ok) {
      const webhooks = await listResponse.json();
      console.log('✅ OAuth 1.0a authentication WORKS!');
      console.log('   Existing webhooks:', webhooks.length);

      webhooks.forEach(w => {
        console.log(`   - ID: ${w.id}`);
        console.log(`     URL: ${w.url}`);
        console.log(`     Valid: ${w.valid}`);
      });
    } else {
      console.log('❌ OAuth 1.0a authentication FAILED');
      const error = await listResponse.text();

      try {
        const errorObj = JSON.parse(error);
        if (errorObj.errors) {
          errorObj.errors.forEach(e => {
            console.log(`   Error ${e.code}: ${e.message}`);
          });
        }
      } catch {
        console.log('   Error:', error);
      }
    }
    console.log('');

    // Step 5: Try to register a webhook
    console.log('5️⃣ ATTEMPTING TO REGISTER WEBHOOK');
    console.log('────────────────────────────────────');

    const webhookUrl = `https://bitso-twitter-api.vercel.app/api/webhooks/twitter/${twitterApp.id}`;
    console.log('Webhook URL:', webhookUrl);

    const registerUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/webhooks.json`;

    const registerRequest = {
      url: registerUrl,
      method: 'POST',
      data: {
        url: webhookUrl
      }
    };

    const registerHeaders = oauth.toHeader(oauth.authorize(registerRequest, null));

    const registerResponse = await fetch(registerUrl + `?url=${encodeURIComponent(webhookUrl)}`, {
      method: 'POST',
      headers: registerHeaders
    });

    console.log('Register webhook response:', registerResponse.status);

    if (registerResponse.ok) {
      const webhook = await registerResponse.json();
      console.log('✅ Webhook registered successfully!');
      console.log('   Webhook ID:', webhook.id);
      console.log('   Webhook URL:', webhook.url);
    } else {
      console.log('❌ Failed to register webhook');
      const error = await registerResponse.text();

      try {
        const errorObj = JSON.parse(error);
        if (errorObj.errors) {
          errorObj.errors.forEach(e => {
            console.log(`   Error ${e.code}: ${e.message}`);

            // Specific error explanations
            if (e.code === 214) {
              console.log('     → Webhook URL already registered');
            } else if (e.code === 32) {
              console.log('     → Authentication failed - check credentials');
            } else if (e.code === 34) {
              console.log('     → URL does not exist or is not accessible');
            } else if (e.code === 99) {
              console.log('     → Unable to verify credentials');
            } else if (e.code === 416) {
              console.log('     → Invalid webhook URL or app suspended');
            }
          });
        }
      } catch {
        console.log('   Error:', error);
      }
    }
    console.log('');

    // Step 6: Check bot status
    if (project.bot) {
      console.log('6️⃣ BOT STATUS CHECK');
      console.log('────────────────────────────────────');
      console.log('✅ Bot connected');
      console.log('   User ID:', project.bot.userId);
      console.log('   Username:', project.bot.username);
      console.log('   Has Access Token:', !!project.bot.accessToken);
      console.log('   Has Access Secret:', !!project.bot.accessTokenSecret);
    } else {
      console.log('6️⃣ BOT STATUS CHECK');
      console.log('────────────────────────────────────');
      console.log('❌ No bot connected to this project');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error(error.stack);
  } finally {
    console.log('');
    console.log('================================================================================');
    console.log('END OF TEST');
    console.log('================================================================================');
    await prisma.$disconnect();
  }
}

// Run the test
testCompleteFlow();