/**
 * List Webhook Subscriptions - Using Correct API Endpoint
 *
 * Based on official Twitter documentation:
 * https://docs.x.com/x-api/account-activity/get-subscriptions
 *
 * Endpoint: GET /2/account_activity/webhooks/{webhook_id}/subscriptions/all/list
 * Auth: Bearer Token
 */

import dotenv from 'dotenv';

dotenv.config({ path: '.env.production.local' });

const BEARER_TOKEN = process.env.X_API_BEARER_TOKEN;

if (!BEARER_TOKEN) {
  console.error('❌ X_API_BEARER_TOKEN not found');
  process.exit(1);
}

async function listWebhooks() {
  console.log('📡 Fetching webhooks from Twitter API v2...');

  const response = await fetch('https://api.twitter.com/2/webhooks', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
    },
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

  // CORRECT endpoint according to official docs
  const url = `https://api.twitter.com/2/account_activity/webhooks/${webhookId}/subscriptions/all/list`;

  console.log('   Endpoint:', url);
  console.log('   Auth: Bearer Token');
  console.log('');

  const response = await fetch(url, {
    method: 'GET',
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

    console.log('   ❌ Error Response:');
    console.log(JSON.stringify(error, null, 2));
    return { success: false, status: response.status, error };
  }

  const data = await response.json();
  return { success: true, data };
}

async function main() {
  try {
    console.log('');
    console.log('=================================================================');
    console.log('   TWITTER WEBHOOK SUBSCRIPTIONS REPORT');
    console.log('=================================================================');
    console.log('   Using: Bearer Token Authentication');
    console.log('   Endpoint: /2/account_activity/webhooks/{id}/subscriptions/all/list');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('=================================================================');
    console.log('');

    // List webhooks
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
        console.log('✅ SUCCESS - Subscription Data Retrieved');
        console.log('');
        console.log('📊 FULL RESPONSE:');
        console.log(JSON.stringify(result.data, null, 2));
        console.log('');

        // Extract subscription information
        const subscriptions = result.data.data?.subscriptions || [];
        const appId = result.data.data?.application_id;
        const webhookUrl = result.data.data?.webhook_url;

        console.log('=================================================================');
        console.log('   SUMMARY');
        console.log('=================================================================');
        console.log('   Application ID:', appId || 'Unknown');
        console.log('   Webhook URL:', webhookUrl || 'Unknown');
        console.log('   Total Active Subscriptions:', subscriptions.length);
        console.log('');

        if (subscriptions.length > 0) {
          console.log('   📋 Active Subscriptions:');
          subscriptions.forEach((sub, idx) => {
            console.log(`     ${idx + 1}. User ID: ${sub.user_id}`);
          });
          console.log('');
        } else {
          console.log('   ⚠️  No active subscriptions found');
          console.log('');
        }

        // Analysis
        console.log('=================================================================');
        console.log('   ANALYSIS');
        console.log('=================================================================');

        if (subscriptions.length === 0) {
          console.log('   🔍 No subscriptions found, but you\'re getting "subscription limit exceeded"?');
          console.log('   ');
          console.log('   Possible explanations:');
          console.log('   1. There may be orphaned subscriptions not visible via API');
          console.log('   2. Twitter may be counting deleted-but-not-cleaned subscriptions');
          console.log('   3. The limit might be on a different level (account-wide, not webhook-specific)');
          console.log('');
          console.log('   💡 Recommended actions:');
          console.log('   1. Check Twitter Developer Portal manually');
          console.log('   2. Try deleting and re-creating the webhook');
          console.log('   3. Contact Twitter support to clean up orphaned subscriptions');
        } else if (subscriptions.length >= 15) {
          console.log('   ⚠️  You have', subscriptions.length, 'subscriptions');
          console.log('   This is at or near the typical Twitter limit (15 per webhook)');
          console.log('');
          console.log('   💡 To add a new subscription:');
          console.log('   1. Unsubscribe one of the existing users');
          console.log('   2. Or delete unused subscriptions');
        } else {
          console.log('   ✅ You have', subscriptions.length, 'subscription(s)');
          console.log('   You should have room for more (typical limit: 15)');
        }

        console.log('');

      } else {
        console.log('❌ FAILED - Could Not Retrieve Subscriptions');
        console.log('');
        console.log('   Status:', result.status);
        console.log('   This might indicate:');
        console.log('   - API permissions issue');
        console.log('   - Incorrect bearer token');
        console.log('   - Webhook ID no longer valid');
        console.log('');
      }

      console.log('=================================================================');
      console.log('');
    }

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
