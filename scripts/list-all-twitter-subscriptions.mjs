/**
 * List ALL Twitter Webhook Subscriptions
 *
 * This script queries Twitter's Account Activity API to list ALL active subscriptions,
 * not just the ones we know about in our database.
 */

import dotenv from 'dotenv';
import crypto from 'crypto';

// Load production environment variables
dotenv.config({ path: '.env.production.local' });

const BEARER_TOKEN = process.env.X_API_BEARER_TOKEN;
const CONSUMER_KEY = process.env.TWITTER_OAUTH_API_KEY;
const CONSUMER_SECRET = process.env.TWITTER_OAUTH_API_SECRET;

if (!BEARER_TOKEN || !CONSUMER_KEY || !CONSUMER_SECRET) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

/**
 * List all webhooks from Twitter API v2
 */
async function listWebhooks() {
  console.log('📡 Fetching all webhooks from Twitter API v2...');

  const response = await fetch('https://api.twitter.com/2/webhooks', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Error:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to list webhooks: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Get subscription count for a webhook using Account Activity API
 * This requires checking the subscriptions endpoint
 */
async function getWebhookSubscriptionCount(webhookId) {
  console.log(`   Checking subscriptions for webhook ${webhookId}...`);

  // Note: Twitter's API v2 doesn't have a direct endpoint to list all subscriptions
  // without bot credentials. We need to use the Account Activity API v1.1

  // Try the v2 endpoint (may not work without specific credentials)
  const url = `https://api.twitter.com/2/webhooks/${webhookId}/subscriptions`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let error;
    try {
      error = JSON.parse(errorText);
    } catch (e) {
      error = { status: response.status, message: errorText };
    }

    // 404 might mean no subscriptions, not an error
    if (response.status === 404) {
      return { count: 0, subscriptions: [], note: 'No subscriptions or endpoint not available' };
    }

    return {
      count: null,
      subscriptions: [],
      error: error,
      note: 'Unable to fetch subscriptions (may need OAuth 1.0a credentials)'
    };
  }

  const data = await response.json();
  return {
    count: data.data?.length || 0,
    subscriptions: data.data || [],
    note: 'Success'
  };
}

/**
 * Try to get subscription count using Account Activity API v1.1
 * This endpoint might give us more information
 */
async function tryAccountActivityAPI() {
  console.log('');
  console.log('📡 Trying Account Activity API v1.1...');

  // The v1.1 endpoint: /1.1/account_activity/all/:env_name/webhooks.json
  // This requires knowing the environment name
  const envName = process.env.TWITTER_WEBHOOK_ENV || 'production';
  const url = `https://api.twitter.com/1.1/account_activity/all/${envName}/webhooks.json`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log('   ⚠️  v1.1 API not accessible with Bearer token');
    console.log('   This is expected - v1.1 Account Activity requires OAuth 1.0a');
    return null;
  }

  const data = await response.json();
  return data;
}

async function main() {
  try {
    console.log('');
    console.log('=================================================================');
    console.log('   TWITTER WEBHOOK SUBSCRIPTIONS AUDIT');
    console.log('=================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   Using Bearer Token for API v2');
    console.log('=================================================================');
    console.log('');

    // List all webhooks
    const webhooks = await listWebhooks();
    console.log(`   ✅ Found ${webhooks.length} webhook(s)`);
    console.log('');

    if (webhooks.length === 0) {
      console.log('✅ No webhooks registered');
      console.log('');
      return;
    }

    // Check each webhook
    console.log('=================================================================');
    console.log('   WEBHOOK DETAILS');
    console.log('=================================================================');
    console.log('');

    let totalKnownSubscriptions = 0;

    for (let i = 0; i < webhooks.length; i++) {
      const wh = webhooks[i];
      console.log(`Webhook ${i + 1}/${webhooks.length}:`);
      console.log('  ID:', wh.id);
      console.log('  URL:', wh.url);
      console.log('  Valid:', wh.valid);
      console.log('  Created:', wh.created_timestamp || 'Unknown');
      console.log('');

      // Try to get subscriptions
      const subInfo = await getWebhookSubscriptionCount(wh.id);

      if (subInfo.count !== null) {
        console.log('  ✅ Subscriptions:', subInfo.count);
        totalKnownSubscriptions += subInfo.count;

        if (subInfo.subscriptions.length > 0) {
          subInfo.subscriptions.forEach((sub, idx) => {
            console.log(`     ${idx + 1}. User ID:`, sub.user_id || sub.id);
          });
        }
      } else {
        console.log('  ⚠️  Subscription count: Unknown');
        console.log('     Reason:', subInfo.note);
        if (subInfo.error) {
          console.log('     Error:', subInfo.error.detail || subInfo.error.title || 'Unknown');
        }
      }

      console.log('');
    }

    // Try v1.1 API for more info
    const v11Data = await tryAccountActivityAPI();

    console.log('=================================================================');
    console.log('   SUMMARY');
    console.log('=================================================================');
    console.log('   Total webhooks registered:', webhooks.length);
    console.log('   Total subscriptions counted:', totalKnownSubscriptions > 0 ? totalKnownSubscriptions : 'Unknown (API access limited)');
    console.log('');

    if (totalKnownSubscriptions === 0 && webhooks.length > 0) {
      console.log('⚠️  IMPORTANT:');
      console.log('   Unable to count active subscriptions using API v2 Bearer Token.');
      console.log('   This is a Twitter API limitation - subscription counts require');
      console.log('   OAuth 1.0a credentials with specific bot access.');
      console.log('');
      console.log('   However, the error "subscription limit exceeded" suggests that');
      console.log('   there ARE active subscriptions that are hitting Twitter\'s limit.');
      console.log('');
      console.log('   RECOMMENDATION:');
      console.log('   1. Check the Twitter Developer Portal for active subscriptions');
      console.log('   2. Delete old/unused webhook subscriptions manually');
      console.log('   3. Or disconnect the current bot to free up a subscription slot');
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
