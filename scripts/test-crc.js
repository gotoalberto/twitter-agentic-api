const crypto = require('crypto');
const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function testCRC(twitterAppName) {
  try {
    console.log('================================================================================');
    console.log('TESTING CRC VALIDATION');
    console.log('================================================================================\n');

    // Get TwitterApp
    const app = await prisma.twitterApp.findUnique({
      where: { name: twitterAppName }
    });

    if (!app) {
      console.log('❌ TwitterApp not found:', twitterAppName);
      return;
    }

    console.log('🔑 TwitterApp:', app.name);
    console.log('   ID:', app.id);
    console.log('   Consumer Secret:', app.consumerSecret ? '✅ Set' : '❌ Missing');
    console.log('');

    if (!app.consumerSecret) {
      console.log('❌ Cannot test CRC - consumer secret is missing');
      return;
    }

    // Test CRC token (example from Twitter)
    const testCrcToken = 'test_crc_token_123456789';

    console.log('📋 Test 1: Local CRC calculation');
    console.log('   CRC Token:', testCrcToken);

    // Calculate HMAC-SHA256
    const hmac = crypto
      .createHmac('sha256', app.consumerSecret)
      .update(testCrcToken)
      .digest('base64');

    const responseToken = `sha256=${hmac}`;
    console.log('   Response Token:', responseToken);
    console.log('');

    // Test the actual webhook URL
    const webhookUrl = `https://bitso-twitter-api.vercel.app/api/webhooks/twitter/${app.id}`;
    console.log('📋 Test 2: Testing actual webhook endpoint');
    console.log('   Webhook URL:', webhookUrl);
    console.log('');

    // Make a test CRC request
    const crcUrl = `${webhookUrl}?crc_token=${encodeURIComponent(testCrcToken)}`;
    console.log('   Making GET request to:', crcUrl);
    console.log('');

    try {
      const response = await fetch(crcUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      console.log('   Response Status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('   Response Body:', JSON.stringify(data, null, 2));

        if (data.response_token === responseToken) {
          console.log('   ✅ CRC validation PASSED - response token matches expected value');
        } else {
          console.log('   ❌ CRC validation FAILED - response token mismatch');
          console.log('      Expected:', responseToken);
          console.log('      Received:', data.response_token);
        }
      } else {
        const error = await response.text();
        console.log('   ❌ Error Response:', error);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }

    console.log('');
    console.log('================================================================================');
    console.log('WEBHOOK URL FOR MANUAL REGISTRATION');
    console.log('================================================================================');
    console.log('');
    console.log('Use this URL when registering the webhook in Twitter Developer Portal:');
    console.log('');
    console.log('   ' + webhookUrl);
    console.log('');
    console.log('This URL includes the TwitterApp ID which is needed for CRC validation.');
    console.log('');
    console.log('Note: If you get "Invalid response_token" error, check:');
    console.log('1. The consumer secret is correct for this app');
    console.log('2. The app ID in the URL matches the app you\'re using');
    console.log('3. The endpoint is accessible from Twitter (not blocked by firewall)');
    console.log('');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get TwitterApp name from command line
const appName = process.argv[2];
if (!appName) {
  console.log('Usage: node test-crc.js <twitter-app-name>');
  console.log('Example: node test-crc.js goodboy-new');
  process.exit(1);
}

testCRC(appName);