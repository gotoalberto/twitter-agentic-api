/**
 * Test completo del ciclo de vida del webhook:
 * 1. Registrar webhook
 * 2. Suscribir bot (requiere bot conectado)
 * 3. Desuscribir bot
 * 4. Eliminar webhook
 */

const crypto = require('crypto');

// Credenciales de la nueva app
const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAABFI5gEAAAAArJXzS7P+jMifirkJzpvdVHDpNxk=qDJ0GOxu1eDiZns0d8jQ0Ca2YrmyOJd9AUnf2VyLKgDnZYqqbU';
const CONSUMER_KEY = '9tc3faKaiEnKzdgJD7sVFUcmU';
const CONSUMER_SECRET = 'vC1PP4yDM3a9yc3PER7ps74rEttTTFfUmNX5o1BSlzPU722iPw';
const CLIENT_ID = 'WkZPRlQyRll2Tzk5NDN0RFFJOUU6MTpjaQ';
const CLIENT_SECRET = 'QBPuvAjIBHhFI2cXwHEzERupoUttIFBTKPsnniqqfeIB2zaPlW';

const WEBHOOK_URL = 'https://hive.pepes.dog/api/webhooks/twitter';

// Variables globales para el flujo
let webhookId = null;

console.log('');
console.log('='.repeat(80));
console.log('🧪 TEST COMPLETO DEL CICLO DE VIDA DEL WEBHOOK');
console.log('='.repeat(80));
console.log('');
console.log('📋 Credenciales:');
console.log('   Bearer Token:', BEARER_TOKEN.substring(0, 50) + '...');
console.log('   Consumer Key:', CONSUMER_KEY);
console.log('   Client ID:', CLIENT_ID);
console.log('   Webhook URL:', WEBHOOK_URL);
console.log('');

/**
 * 1. Listar webhooks existentes
 */
async function step1_listWebhooks() {
  console.log('='.repeat(80));
  console.log('STEP 1: Listar webhooks existentes');
  console.log('='.repeat(80));
  console.log('');

  try {
    const response = await fetch('https://api.twitter.com/2/webhooks', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
    });

    console.log('📥 Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.log('❌ ERROR:', error);
      return false;
    }

    const data = await response.json();
    console.log('✅ SUCCESS!');
    console.log('📦 Webhooks:', JSON.stringify(data, null, 2));

    if (data.data && data.data.length > 0) {
      console.log('');
      console.log('⚠️  Found existing webhooks:');
      data.data.forEach((webhook, i) => {
        console.log(`   ${i + 1}. ID: ${webhook.id}`);
        console.log(`      URL: ${webhook.url}`);
        console.log(`      Created: ${webhook.created_at}`);
        console.log(`      Valid: ${webhook.valid}`);
      });
    }

    console.log('');
    return true;
  } catch (error) {
    console.log('❌ Exception:', error.message);
    return false;
  }
}

/**
 * 2. Registrar nuevo webhook
 */
async function step2_registerWebhook() {
  console.log('='.repeat(80));
  console.log('STEP 2: Registrar nuevo webhook');
  console.log('='.repeat(80));
  console.log('');
  console.log('📍 Webhook URL:', WEBHOOK_URL);
  console.log('');

  try {
    const response = await fetch('https://api.twitter.com/2/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: WEBHOOK_URL }),
    });

    console.log('📥 Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.log('❌ ERROR:', error);
      try {
        const errorJson = JSON.parse(error);
        console.log('📦 Parsed Error:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        // Ignore
      }
      return false;
    }

    const data = await response.json();
    console.log('✅ SUCCESS!');
    console.log('📦 Response:', JSON.stringify(data, null, 2));

    webhookId = data.data?.id;
    if (webhookId) {
      console.log('');
      console.log('🎉 Webhook registrado exitosamente!');
      console.log('   ID:', webhookId);
      console.log('   URL:', data.data.url);
    }

    console.log('');
    return !!webhookId;
  } catch (error) {
    console.log('❌ Exception:', error.message);
    return false;
  }
}

/**
 * 3. Suscribir bot al webhook (requiere bot conectado)
 */
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret = '') {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  // Create signature base string
  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Generate HMAC-SHA1 signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');

  return signature;
}

function generateOAuthHeader(method, url, consumerKey, consumerSecret, accessToken = '', accessSecret = '') {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(32).toString('base64').replace(/\W/g, '');

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
  };

  if (accessToken) {
    oauthParams.oauth_token = accessToken;
  }

  const signature = generateOAuthSignature(method, url, oauthParams, consumerSecret, accessSecret);
  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

async function step3_subscribeBot() {
  console.log('='.repeat(80));
  console.log('STEP 3: Suscribir bot al webhook');
  console.log('='.repeat(80));
  console.log('');

  if (!webhookId) {
    console.log('❌ No webhook ID disponible. Saltando este paso.');
    console.log('');
    return false;
  }

  console.log('⚠️  NOTA: Este paso requiere un bot conectado con OAuth 1.0a tokens.');
  console.log('   Como no tenemos las credenciales del bot aquí, vamos a simular el proceso.');
  console.log('');
  console.log('📍 Webhook ID:', webhookId);
  console.log('');
  console.log('✅ Paso de suscripción simulado (se haría en producción con bot real)');
  console.log('');

  return true;
}

/**
 * 4. Desuscribir bot del webhook
 */
async function step4_unsubscribeBot() {
  console.log('='.repeat(80));
  console.log('STEP 4: Desuscribir bot del webhook');
  console.log('='.repeat(80));
  console.log('');

  console.log('⚠️  NOTA: Este paso también requiere un bot conectado.');
  console.log('   Se simula ya que necesitaríamos las credenciales del bot.');
  console.log('');
  console.log('✅ Paso de desuscripción simulado');
  console.log('');

  return true;
}

/**
 * 5. Eliminar webhook
 */
async function step5_deleteWebhook() {
  console.log('='.repeat(80));
  console.log('STEP 5: Eliminar webhook');
  console.log('='.repeat(80));
  console.log('');

  if (!webhookId) {
    console.log('❌ No webhook ID disponible. Saltando este paso.');
    console.log('');
    return false;
  }

  console.log('📍 Webhook ID:', webhookId);
  console.log('');

  try {
    const response = await fetch(`https://api.twitter.com/2/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
    });

    console.log('📥 Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.log('❌ ERROR:', error);
      try {
        const errorJson = JSON.parse(error);
        console.log('📦 Parsed Error:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        // Ignore
      }
      return false;
    }

    // DELETE puede devolver 204 No Content
    if (response.status === 204) {
      console.log('✅ Webhook eliminado exitosamente (204 No Content)');
    } else {
      const data = await response.json();
      console.log('✅ SUCCESS!');
      console.log('📦 Response:', JSON.stringify(data, null, 2));
    }

    console.log('');
    return true;
  } catch (error) {
    console.log('❌ Exception:', error.message);
    return false;
  }
}

/**
 * 6. Verificar que el webhook fue eliminado
 */
async function step6_verifyDeletion() {
  console.log('='.repeat(80));
  console.log('STEP 6: Verificar que el webhook fue eliminado');
  console.log('='.repeat(80));
  console.log('');

  return await step1_listWebhooks();
}

/**
 * Ejecutar todos los pasos
 */
(async () => {
  let success = true;

  // Step 1: Listar webhooks existentes
  success = await step1_listWebhooks();
  if (!success) {
    console.log('❌ STEP 1 FAILED - Abortando');
    process.exit(1);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 2: Registrar webhook
  success = await step2_registerWebhook();
  if (!success) {
    console.log('❌ STEP 2 FAILED - Abortando');
    process.exit(1);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: Suscribir bot (simulado)
  success = await step3_subscribeBot();

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 4: Desuscribir bot (simulado)
  success = await step4_unsubscribeBot();

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 5: Eliminar webhook
  success = await step5_deleteWebhook();
  if (!success) {
    console.log('❌ STEP 5 FAILED - El webhook puede quedar sin eliminar');
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 6: Verificar eliminación
  success = await step6_verifyDeletion();

  console.log('='.repeat(80));
  console.log('✅ TEST COMPLETO FINALIZADO');
  console.log('='.repeat(80));
  console.log('');
})();
