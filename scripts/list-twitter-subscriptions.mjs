/**
 * List Twitter Webhook Subscriptions
 *
 * This script lists all webhooks and their active subscriptions
 * to help diagnose "subscription limit exceeded" errors.
 */

import dotenv from 'dotenv';
import crypto from 'crypto';
import { PrismaClient } from '../src/generated/prisma/index.js';

// Load production environment variables
dotenv.config({ path: '.env.production.local' });

const prisma = new PrismaClient();

const BEARER_TOKEN = process.env.X_API_BEARER_TOKEN;
const CONSUMER_KEY = process.env.TWITTER_OAUTH_API_KEY;
const CONSUMER_SECRET = process.env.TWITTER_OAUTH_API_SECRET;

if (!BEARER_TOKEN || !CONSUMER_KEY || !CONSUMER_SECRET) {
  console.error('❌ Missing required environment variables');
  console.error('   X_API_BEARER_TOKEN:', BEARER_TOKEN ? '✅' : '❌');
  console.error('   TWITTER_OAUTH_API_KEY:', CONSUMER_KEY ? '✅' : '❌');
  console.error('   TWITTER_OAUTH_API_SECRET:', CONSUMER_SECRET ? '✅' : '❌');
  process.exit(1);
}

/**
 * Generate OAuth 1.0a signature
 */
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

/**
 * Generate OAuth 1.0a header
 */
async function generateOAuthHeader(method, url, consumerKey, consumerSecret, accessToken, accessSecret) {
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

  const authHeader = Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${authHeader}`;
}

/**
 * List all webhooks
 */
async function listWebhooks() {
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

/**
 * List subscriptions for a webhook (requires bot credentials)
 */
async function listSubscriptions(webhookId, accessToken, accessSecret) {
  const url = `https://api.twitter.com/2/account_activity/webhooks/${webhookId}/subscriptions/all`;

  const authHeader = await generateOAuthHeader(
    'GET',
    url,
    CONSUMER_KEY,
    CONSUMER_SECRET,
    accessToken,
    accessSecret
  );

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    return { error: error, status: response.status };
  }

  const data = await response.json();
  return data;
}

async function main() {
  try {
    console.log('');
    console.log('=================================================================');
    console.log('   TWITTER WEBHOOK SUBSCRIPTIONS REPORT');
    console.log('=================================================================');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('=================================================================');
    console.log('');

    // List all webhooks from Twitter
    console.log('📡 Fetching webhooks from Twitter API...');
    const webhooks = await listWebhooks();
    console.log(`   Found ${webhooks.length} webhook(s)`);
    console.log('');

    if (webhooks.length === 0) {
      console.log('✅ No webhooks registered in Twitter');
      console.log('   You can register a new webhook by connecting a bot.');
      console.log('');
      return;
    }

    // Get all bots from database
    console.log('💾 Fetching bots from database...');
    const bots = await prisma.bot.findMany({
      include: {
        project: {
          include: {
            webhookRegistrations: true,
          },
        },
      },
    });
    console.log(`   Found ${bots.length} bot(s) in database`);
    console.log('');

    // Display webhooks and their subscriptions
    console.log('=================================================================');
    console.log('   WEBHOOK DETAILS');
    console.log('=================================================================');
    console.log('');

    let totalSubscriptions = 0;

    for (let i = 0; i < webhooks.length; i++) {
      const wh = webhooks[i];
      console.log(`Webhook ${i + 1}/${webhooks.length}:`);
      console.log('  ID:', wh.id);
      console.log('  URL:', wh.url);
      console.log('  Valid:', wh.valid);
      console.log('  Created:', wh.created_timestamp);
      console.log('');

      // Find matching bot for this webhook
      const matchingBot = bots.find(bot =>
        bot.project.webhookRegistrations.some(reg => reg.webhookId === wh.id)
      );

      if (matchingBot) {
        console.log('  Bot:', `@${matchingBot.username} (${matchingBot.project.name})`);
        console.log('  Checking subscriptions...');

        const subResult = await listSubscriptions(
          wh.id,
          matchingBot.accessToken,
          matchingBot.accessTokenSecret
        );

        if (subResult.error) {
          console.log('  ⚠️  Could not fetch subscriptions:', subResult.error.detail || subResult.error);
          console.log('  Status:', subResult.status);
        } else {
          const subscriptions = subResult.data?.subscriptions || [];
          console.log('  ✅ Active subscriptions:', subscriptions.length);
          totalSubscriptions += subscriptions.length;

          if (subscriptions.length > 0) {
            subscriptions.forEach((sub, idx) => {
              console.log(`     ${idx + 1}. User ID: ${sub.user_id}`);
            });
          }
        }
      } else {
        console.log('  ⚠️  No matching bot found in database');
        console.log('  This webhook may be orphaned or from another app');
      }

      console.log('');
    }

    console.log('=================================================================');
    console.log('   SUMMARY');
    console.log('=================================================================');
    console.log('   Total webhooks:', webhooks.length);
    console.log('   Total bots in DB:', bots.length);
    console.log('   Total subscriptions counted:', totalSubscriptions);
    console.log('');

    if (webhooks.length > bots.length) {
      console.log('⚠️  WARNING: More webhooks in Twitter than bots in database');
      console.log('   Some webhooks may be orphaned or from old deployments');
      console.log('   Consider cleaning them up with:');
      console.log('   node scripts/list-and-cleanup-webhooks.mjs');
      console.log('');
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
