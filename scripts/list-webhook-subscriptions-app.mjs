/**
 * List Webhook Subscriptions using App Credentials
 *
 * Uses OAuth 1.0a with ONLY app credentials (no user tokens)
 * to list all subscriptions on the webhook.
 */

import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.production.local' });

const BEARER_TOKEN = process.env.X_API_BEARER_TOKEN;
const CONSUMER_KEY = process.env.TWITTER_OAUTH_API_KEY;
const CONSUMER_SECRET = process.env.TWITTER_OAUTH_API_SECRET;

if (!BEARER_TOKEN || !CONSUMER_KEY || !CONSUMER_SECRET) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret = '') {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  const hmac = crypto.createHmac('sha1', signingKey);
  hmac.update(signatureBase);
  return hmac.digest('base64');
}

function generateAppOnlyOAuthHeader(method, url) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(32).toString('base64').replace(/\W/g, '');

  // App-only OAuth 1.0a (no oauth_token)
  const oauthParams = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(method, url, oauthParams, CONSUMER_SECRET, '');
  oauthParams.oauth_signature = signature;

  const authHeader = Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${authHeader}`;
}

async function listWebhooks() {
  const response = await fetch('https://api.twitter.com/2/webhooks', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${BEARER_TOKEN}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to list webhooks: ${response.status} ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.data || [];
}

async function listSubscriptions(webhookId) {
  console.log(`📍 Listing subscriptions for webhook ${webhookId}...`);
  console.log('   Using app-only OAuth 1.0a credentials');

  const url = `https://api.twitter.com/2/account_activity/webhooks/${webhookId}/subscriptions/all`;

  const authHeader = generateAppOnlyOAuthHeader('GET', url);

  console.log('   Making request to:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  console.log('   Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    let error;
    try {
      error = JSON.parse(errorText);
    } catch (e) {
      error = { raw: errorText };
    }

    console.log('   ❌ Error:', JSON.stringify(error, null, 2));
    return { success: false, status: response.status, error };
  }

  const data = await response.json();
  console.log('   ✅ Success!');
  return { success: true, data };
}

async function main() {
  try {
    console.log('');
    console.log('=================================================================');
    console.log('   WEBHOOK SUBSCRIPTIONS REPORT');
    console.log('=================================================================');
    console.log('   Using: App-only OAuth 1.0a');
    console.log('   Consumer Key:', CONSUMER_KEY ? CONSUMER_KEY.substring(0, 10) + '...' : 'Not found');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('=================================================================');
    console.log('');

    // List webhooks
    console.log('📡 Fetching webhooks from Twitter API v2...');
    const webhooks = await listWebhooks();
    console.log(`   ✅ Found ${webhooks.length} webhook(s)`);
    console.log('');

    if (webhooks.length === 0) {
      console.log('No webhooks registered.');
      return;
    }

    // Check subscriptions for each webhook
    for (const webhook of webhooks) {
      console.log('=================================================================');
      console.log(`   WEBHOOK: ${webhook.id}`);
      console.log('=================================================================');
      console.log('   URL:', webhook.url);
      console.log('   Valid:', webhook.valid);
      console.log('');

      const result = await listSubscriptions(webhook.id);
      console.log('');

      if (result.success) {
        console.log('   📊 SUBSCRIPTION DATA:');
        console.log(JSON.stringify(result.data, null, 2));
        console.log('');

        // Try to count subscriptions from different possible response formats
        const subscriptions =
          result.data.data?.subscriptions ||
          result.data.subscriptions ||
          result.data.data ||
          [];

        const count = Array.isArray(subscriptions) ? subscriptions.length : 0;

        console.log('   📈 Total active subscriptions:', count);

        if (count > 0) {
          console.log('');
          console.log('   Active subscriptions:');
          subscriptions.forEach((sub, idx) => {
            console.log(`     ${idx + 1}. User ID: ${sub.user_id || sub.id || 'Unknown'}`);
          });
        }
      } else {
        console.log('   ⚠️  Could not retrieve subscriptions');
        console.log('   Status:', result.status);
        console.log('   This might be a permissions issue or API limitation');
      }

      console.log('');
    }

    console.log('=================================================================');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('=================================================================');
    console.error('   ERROR');
    console.error('=================================================================');
    console.error('');
    console.error(error);
    console.error('');
    process.exit(1);
  }
}

main();
