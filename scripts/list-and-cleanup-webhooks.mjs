/**
 * List and Clean Up Twitter Webhooks
 *
 * This script lists all webhooks registered with Twitter
 * and optionally deletes old/unused ones to free up subscription slots.
 *
 * Twitter has limits on:
 * - Number of webhooks per app
 * - Number of subscriptions per account
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BEARER_TOKEN = process.env.X_API_BEARER_TOKEN;

if (!BEARER_TOKEN) {
  console.error('❌ X_API_BEARER_TOKEN not found in environment variables');
  process.exit(1);
}

/**
 * List all webhooks registered with Twitter
 */
async function listWebhooks() {
  console.log('');
  console.log('=================================================================');
  console.log('   LISTING ALL WEBHOOKS');
  console.log('=================================================================');
  console.log('');

  const response = await fetch('https://api.twitter.com/2/webhooks', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Failed to list webhooks');
    console.error('   Status:', response.status);
    console.error('   Error:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to list webhooks: ${response.status}`);
  }

  const data = await response.json();
  const webhooks = data.data || [];

  console.log('📊 Total webhooks found:', webhooks.length);
  console.log('');

  if (webhooks.length === 0) {
    console.log('✅ No webhooks registered');
    console.log('');
    return [];
  }

  webhooks.forEach((wh, index) => {
    console.log(`Webhook ${index + 1}:`);
    console.log('  ID:', wh.id);
    console.log('  URL:', wh.url);
    console.log('  Valid:', wh.valid);
    console.log('  Created:', wh.created_timestamp);
    console.log('');
  });

  return webhooks;
}

/**
 * Delete a specific webhook
 */
async function deleteWebhook(webhookId) {
  console.log('🗑️  Deleting webhook:', webhookId);

  const response = await fetch(`https://api.twitter.com/2/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Failed to delete webhook');
    console.error('   Status:', response.status);
    console.error('   Error:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to delete webhook: ${response.status}`);
  }

  console.log('   ✅ Webhook deleted successfully');
  console.log('');
}

/**
 * Get subscription count for a webhook
 */
async function getSubscriptions(webhookId, accessToken, accessSecret) {
  const consumerKey = process.env.TWITTER_OAUTH_API_KEY;
  const consumerSecret = process.env.TWITTER_OAUTH_API_SECRET;

  if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) {
    console.log('   ⚠️  Cannot check subscriptions - OAuth credentials not provided');
    return null;
  }

  // This would require OAuth 1.0a signing which is complex
  // For now, just skip this
  return null;
}

async function main() {
  try {
    const webhooks = await listWebhooks();

    if (webhooks.length === 0) {
      console.log('=================================================================');
      console.log('   NO ACTION NEEDED');
      console.log('=================================================================');
      console.log('');
      return;
    }

    console.log('=================================================================');
    console.log('   CLEANUP OPTIONS');
    console.log('=================================================================');
    console.log('');
    console.log('To delete a webhook, use:');
    console.log('');
    webhooks.forEach((wh, index) => {
      console.log(`  # Delete webhook ${index + 1} (${wh.url}):`);
      console.log(`  node scripts/delete-webhook.mjs ${wh.id}`);
      console.log('');
    });

    console.log('Or delete ALL webhooks (use with caution):');
    console.log('  node scripts/delete-all-webhooks.mjs');
    console.log('');
    console.log('=================================================================');
    console.log('');

    // Current app URL
    const currentUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app';
    const currentWebhookUrl = `${currentUrl}/api/webhooks/twitter`;

    const currentWebhook = webhooks.find(wh => wh.url === currentWebhookUrl);
    const otherWebhooks = webhooks.filter(wh => wh.url !== currentWebhookUrl);

    if (currentWebhook) {
      console.log('✅ Current webhook found:');
      console.log('   ID:', currentWebhook.id);
      console.log('   URL:', currentWebhook.url);
      console.log('');
    }

    if (otherWebhooks.length > 0) {
      console.log('⚠️  Other webhooks found (possibly old/unused):');
      otherWebhooks.forEach((wh, index) => {
        console.log(`   ${index + 1}. ${wh.url}`);
        console.log(`      ID: ${wh.id}`);
      });
      console.log('');
      console.log('   Consider deleting these if they are no longer needed.');
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
