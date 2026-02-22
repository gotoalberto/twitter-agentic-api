/**
 * Test bearer token con API v2 de Twitter
 */

const fs = require('fs');
const path = require('path');

// Cargar .env.production
function loadEnv() {
  const envPath = path.join(__dirname, '.env.production');
  const envContent = fs.readFileSync(envPath, 'utf-8');

  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2];

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  });
}

loadEnv();

const bearerToken = process.env.X_API_BEARER_TOKEN;

console.log('');
console.log('='.repeat(80));
console.log('🔍 TEST BEARER TOKEN CON API V2');
console.log('='.repeat(80));
console.log('');

console.log('📋 Bearer Token Info:');
console.log('   Length:', bearerToken?.length);
console.log('   First 50 chars:', bearerToken?.substring(0, 50));
console.log('   Last 20 chars:', bearerToken?.substring(bearerToken.length - 20));
console.log('');

// Verificar últimos caracteres
console.log('🔎 Last 5 characters (bytes):');
const lastChars = bearerToken?.substring(bearerToken.length - 5);
for (let i = 0; i < (lastChars?.length || 0); i++) {
  const char = lastChars[i];
  const code = char.charCodeAt(0);
  console.log(`   [${i}] '${char}' (code: ${code}, hex: 0x${code.toString(16)})`);
}
console.log('');

async function testListWebhooks() {
  console.log('='.repeat(80));
  console.log('🧪 TEST: List Webhooks (GET /2/webhooks)');
  console.log('='.repeat(80));
  console.log('');

  try {
    console.log('📡 Calling Twitter API v2...');
    console.log('   URL: https://api.twitter.com/2/webhooks');
    console.log('   Method: GET');
    console.log('   Authorization: Bearer ' + bearerToken.substring(0, 30) + '...');
    console.log('');

    const response = await fetch('https://api.twitter.com/2/webhooks', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
      },
    });

    console.log('📥 Response Status:', response.status, response.statusText);
    console.log('');

    if (!response.ok) {
      const error = await response.text();
      console.log('❌ ERROR Response Body:');
      console.log(error);
      console.log('');

      // Try to parse as JSON
      try {
        const errorJson = JSON.parse(error);
        console.log('📦 Parsed Error:');
        console.log(JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.log('⚠️  Could not parse error as JSON');
      }
    } else {
      const data = await response.json();
      console.log('✅ SUCCESS!');
      console.log('📦 Response Body:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
    console.log(error);
  }

  console.log('');
  console.log('='.repeat(80));
}

async function testRegisterWebhook() {
  console.log('🧪 TEST: Register Webhook (POST /2/webhooks)');
  console.log('='.repeat(80));
  console.log('');

  const webhookUrl = 'https://hive.pepes.dog/api/webhooks/twitter';

  try {
    console.log('📡 Calling Twitter API v2...');
    console.log('   URL: https://api.twitter.com/2/webhooks');
    console.log('   Method: POST');
    console.log('   Webhook URL:', webhookUrl);
    console.log('');

    const response = await fetch('https://api.twitter.com/2/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: webhookUrl }),
    });

    console.log('📥 Response Status:', response.status, response.statusText);
    console.log('');

    if (!response.ok) {
      const error = await response.text();
      console.log('❌ ERROR Response Body:');
      console.log(error);
      console.log('');

      // Try to parse as JSON
      try {
        const errorJson = JSON.parse(error);
        console.log('📦 Parsed Error:');
        console.log(JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.log('⚠️  Could not parse error as JSON');
      }
    } else {
      const data = await response.json();
      console.log('✅ SUCCESS!');
      console.log('📦 Response Body:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
    console.log(error);
  }

  console.log('');
  console.log('='.repeat(80));
}

(async () => {
  await testListWebhooks();
  await testRegisterWebhook();

  console.log('');
  console.log('✅ TESTS COMPLETADOS');
  console.log('');
})();
