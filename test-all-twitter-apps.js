// Test all TwitterApps to find one with valid credentials
const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function createBearerToken(consumerKey, consumerSecret) {
  const credentials = Buffer.from(
    `${encodeURIComponent(consumerKey)}:${encodeURIComponent(consumerSecret)}`
  ).toString('base64');

  const response = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function testAllTwitterApps() {
  console.log('================================================================================');
  console.log('🔍 TESTING ALL TWITTER APPS');
  console.log('================================================================================');
  console.log('');

  try {
    // Get all TwitterApps
    const twitterApps = await prisma.twitterApp.findMany({
      include: {
        projects: true
      }
    });

    console.log(`Found ${twitterApps.length} TwitterApp(s) in database`);
    console.log('');

    for (const app of twitterApps) {
      console.log(`📱 Testing: ${app.name}`);
      console.log(`   ID: ${app.id}`);
      console.log(`   Projects: ${app.projects?.map(p => p.name).join(', ') || 'None'}`);
      console.log(`   Consumer Key: ${app.consumerKey.substring(0, 5)}...`);

      // Test bearer token
      if (app.bearerToken) {
        console.log('   Testing existing bearer token...');
        const testResponse = await fetch('https://api.twitter.com/2/users/by/username/twitter', {
          headers: {
            'Authorization': `Bearer ${app.bearerToken}`
          }
        });

        if (testResponse.ok) {
          console.log('   ✅ Bearer token is VALID');
        } else {
          console.log(`   ❌ Bearer token is INVALID (${testResponse.status})`);
        }
      } else {
        console.log('   ⚠️  No bearer token configured');
      }

      // Try to generate new bearer token
      console.log('   Testing consumer credentials...');
      try {
        const newToken = await createBearerToken(app.consumerKey, app.consumerSecret);
        console.log('   ✅ Consumer credentials are VALID - can generate bearer token');

        // Update token in database
        await prisma.twitterApp.update({
          where: { id: app.id },
          data: { bearerToken: newToken }
        });
        console.log('   ✅ Bearer token updated in database');

        // Test OAuth 1.0a for webhook registration
        console.log('   Testing OAuth 1.0a webhook registration...');
        const OAuth = require('oauth-1.0a');
        const crypto = require('crypto');

        const oauth = new OAuth({
          consumer: {
            key: app.consumerKey,
            secret: app.consumerSecret
          },
          signature_method: 'HMAC-SHA1',
          hash_function(base_string, key) {
            return crypto.createHmac('sha1', key).update(base_string).digest('base64');
          }
        });

        const webhookEnv = app.webhookEnv || 'production';
        const testUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/webhooks.json`;

        const testData = {
          url: testUrl,
          method: 'GET'
        };

        const testHeaders = oauth.toHeader(oauth.authorize(testData));

        const webhookTestResponse = await fetch(testUrl, {
          headers: testHeaders
        });

        if (webhookTestResponse.ok) {
          console.log('   ✅ OAuth 1.0a works - CAN register webhooks!');
          const webhooks = await webhookTestResponse.json();
          console.log(`   📌 Current webhooks: ${webhooks.length}`);
          webhooks.forEach(w => {
            console.log(`      - ${w.id}: ${w.url}`);
          });
        } else {
          console.log(`   ❌ OAuth 1.0a failed (${webhookTestResponse.status})`);
          const error = await webhookTestResponse.text();
          try {
            const errorObj = JSON.parse(error);
            console.log(`      Error: ${errorObj.errors?.[0]?.message || error}`);
          } catch {
            console.log(`      Error: ${error}`);
          }
        }

      } catch (error) {
        console.log('   ❌ Consumer credentials are INVALID');
        console.log(`      Error: ${error.message}`);
      }

      console.log('');
    }

    // Summary
    console.log('================================================================================');
    console.log('📊 SUMMARY');
    console.log('================================================================================');

    const validApps = [];
    for (const app of twitterApps) {
      try {
        await createBearerToken(app.consumerKey, app.consumerSecret);
        validApps.push(app);
      } catch {}
    }

    if (validApps.length > 0) {
      console.log(`✅ Found ${validApps.length} TwitterApp(s) with valid credentials:`);
      validApps.forEach(app => {
        console.log(`   - ${app.name} (ID: ${app.id})`);
        if (app.projects && app.projects.length > 0) {
          console.log(`     Projects: ${app.projects.map(p => p.name).join(', ')}`);
        }
      });
    } else {
      console.log('❌ No TwitterApps with valid credentials found');
      console.log('');
      console.log('⚠️  IMPORTANT: The TwitterApp credentials appear to be revoked or invalid.');
      console.log('   You need to:');
      console.log('   1. Check if the Twitter/X app still exists in the developer portal');
      console.log('   2. Regenerate the consumer key/secret if the app exists');
      console.log('   3. Update the TwitterApp record in the database with new credentials');
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

// Run
testAllTwitterApps();