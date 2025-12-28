/**
 * Check Webhook Subscriptions
 *
 * Uses OAuth 1.0a credentials from connected bots to check
 * how many subscriptions are active on the webhook.
 */

import dotenv from 'dotenv';
import crypto from 'crypto';
import { PrismaClient } from '../src/generated/prisma/index.js';

dotenv.config({ path: '.env.production.local' });

const prisma = new PrismaClient();

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

function generateOAuthHeader(method, url, accessToken, accessSecret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(32).toString('base64').replace(/\W/g, '');

  const oauthParams = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
    oauth_token: accessToken,
  };

  const signature = generateOAuthSignature(method, url, oauthParams, CONSUMER_SECRET, accessSecret);
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
    throw new Error(`Failed to list webhooks: ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}

async function listSubscriptionsForWebhook(webhookId, accessToken, accessSecret) {
  const url = `https://api.twitter.com/2/account_activity/webhooks/${webhookId}/subscriptions/all`;

  const authHeader = generateOAuthHeader('GET', url, accessToken, accessSecret);

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': authHeader },
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, status: response.status, error };
  }

  const data = await response.json();
  return { success: true, data };
}

async function main() {
  try {
    console.log('');
    console.log('=================================================================');
    console.log('   WEBHOOK SUBSCRIPTIONS CHECKER');
    console.log('=================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('=================================================================');
    console.log('');

    // Get webhooks from Twitter
    console.log('📡 Fetching webhooks from Twitter...');
    const webhooks = await listWebhooks();
    console.log(`   Found ${webhooks.length} webhook(s)`);
    console.log('');

    if (webhooks.length === 0) {
      console.log('✅ No webhooks registered');
      return;
    }

    // Get bots from database
    console.log('💾 Fetching bots from database...');
    const bots = await prisma.bot.findMany({
      include: { project: true },
    });
    console.log(`   Found ${bots.length} bot(s) in database`);
    console.log('');

    // Check subscriptions for each webhook
    for (const webhook of webhooks) {
      console.log('=================================================================');
      console.log(`   WEBHOOK: ${webhook.id}`);
      console.log('=================================================================');
      console.log('   URL:', webhook.url);
      console.log('   Valid:', webhook.valid);
      console.log('');

      // Try to get subscriptions using each bot's credentials
      for (const bot of bots) {
        console.log(`📍 Checking subscriptions using bot @${bot.username}...`);

        const result = await listSubscriptionsForWebhook(
          webhook.id,
          bot.accessToken,
          bot.accessTokenSecret
        );

        if (result.success) {
          console.log('   ✅ Success!');
          console.log('');
          console.log('   📊 SUBSCRIPTION DATA:');
          console.log(JSON.stringify(result.data, null, 2));
          console.log('');

          // Count subscriptions
          const subscriptions = result.data.data?.subscriptions || result.data.subscriptions || [];
          console.log('   📈 Total active subscriptions:', subscriptions.length);

          if (subscriptions.length > 0) {
            console.log('');
            console.log('   Active subscriptions:');
            subscriptions.forEach((sub, idx) => {
              console.log(`     ${idx + 1}. User ID: ${sub.user_id || sub.id || 'Unknown'}`);
            });
          }

          console.log('');
          break; // One successful result is enough
        } else {
          console.log(`   ❌ Failed (${result.status}):`, result.error.substring(0, 100));
          console.log('');
        }
      }
    }

    console.log('=================================================================');
    console.log('');

    await prisma.$disconnect();

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
