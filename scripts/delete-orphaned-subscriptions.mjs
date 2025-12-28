/**
 * Delete Orphaned Twitter Webhook Subscriptions
 *
 * This script deletes specific webhook subscriptions by user ID
 * to clean up orphaned subscriptions from deleted bots.
 *
 * USAGE:
 *   node scripts/delete-orphaned-subscriptions.mjs <user_id>
 *
 * EXAMPLE:
 *   node scripts/delete-orphaned-subscriptions.mjs 1460606890392629248
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

// Get user ID from command line
const targetUserId = process.argv[2];

if (!targetUserId) {
  console.error('');
  console.error('❌ Error: No user ID provided');
  console.error('');
  console.error('Usage: node scripts/delete-orphaned-subscriptions.mjs <user_id>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/delete-orphaned-subscriptions.mjs 1460606890392629248');
  console.error('');
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

async function deleteSubscription(webhookId, userId) {
  console.log(`🗑️  Attempting to delete subscription for user ${userId}...`);
  console.log('   Using Bearer Token authentication');

  // Correct endpoint according to official docs: includes /all at the end
  const url = `https://api.twitter.com/2/account_activity/webhooks/${webhookId}/subscriptions/${userId}/all`;

  console.log('   Making DELETE request to:', url);

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
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

  // Successful deletion may return 204 No Content or 200 OK
  let data = {};
  if (response.status !== 204) {
    try {
      data = await response.json();
    } catch (e) {
      // Some DELETE requests return empty body
    }
  }

  console.log('   ✅ Success! Subscription deleted');
  return { success: true, data };
}

async function main() {
  try {
    console.log('');
    console.log('=================================================================');
    console.log('   DELETE ORPHANED WEBHOOK SUBSCRIPTION');
    console.log('=================================================================');
    console.log('   Target User ID:', targetUserId);
    console.log('   Timestamp:', new Date().toISOString());
    console.log('=================================================================');
    console.log('');

    // List webhooks
    console.log('📡 Fetching webhooks from Twitter API v2...');
    const webhooks = await listWebhooks();
    console.log(`   ✅ Found ${webhooks.length} webhook(s)`);
    console.log('');

    if (webhooks.length === 0) {
      console.log('❌ No webhooks registered');
      return;
    }

    // For each webhook, try to delete the subscription
    for (const webhook of webhooks) {
      console.log('=================================================================');
      console.log(`   WEBHOOK: ${webhook.id}`);
      console.log('=================================================================');
      console.log('   URL:', webhook.url);
      console.log('   Valid:', webhook.valid);
      console.log('');

      const result = await deleteSubscription(webhook.id, targetUserId);
      console.log('');

      if (result.success) {
        console.log('   ✅ DELETED SUCCESSFULLY');
        console.log('   The orphaned subscription has been removed');
      } else {
        console.log('   ⚠️  Failed to delete subscription');
        console.log('   Status:', result.status);

        if (result.status === 404) {
          console.log('   This user ID may not have an active subscription on this webhook');
        } else if (result.status === 403) {
          console.log('   Permission denied - may need different authentication method');
        }
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
