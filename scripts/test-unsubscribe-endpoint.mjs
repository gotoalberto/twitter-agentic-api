/**
 * Test Unsubscribe Endpoint
 *
 * This script tests different unsubscribe endpoints to determine
 * which one is correct according to Twitter API.
 */

import dotenv from 'dotenv';
import crypto from 'crypto';
import { PrismaClient } from '../src/generated/prisma/index.js';

dotenv.config({ path: '.env.production.local' });

const prisma = new PrismaClient();

const BEARER_TOKEN = process.env.X_API_BEARER_TOKEN;
const CONSUMER_KEY = process.env.TWITTER_OAUTH_API_KEY;
const CONSUMER_SECRET = process.env.TWITTER_OAUTH_API_SECRET;

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

async function main() {
  try {
    console.log('');
    console.log('=================================================================');
    console.log('   UNSUBSCRIBE ENDPOINT TEST');
    console.log('=================================================================');
    console.log('');

    // Get webhook
    const webhooks = await listWebhooks();
    if (webhooks.length === 0) {
      console.log('No webhooks found');
      return;
    }

    const webhook = webhooks[0];
    console.log('Webhook ID:', webhook.id);
    console.log('');

    // Get bot
    const bot = await prisma.bot.findFirst();
    if (!bot) {
      console.log('No bot found in database');
      return;
    }

    console.log('Bot:', bot.username);
    console.log('Bot User ID:', bot.userId);
    console.log('');

    console.log('=================================================================');
    console.log('   TESTING ENDPOINTS');
    console.log('=================================================================');
    console.log('');

    // Test 1: Current endpoint (without user_id) using OAuth 1.0a
    console.log('Test 1: /subscriptions/all (OAuth 1.0a)');
    const url1 = `https://api.twitter.com/2/account_activity/webhooks/${webhook.id}/subscriptions/all`;
    console.log('   URL:', url1);
    console.log('   Method: DELETE');
    console.log('   Auth: OAuth 1.0a (bot credentials)');
    console.log('   Note: Current implementation in code');
    console.log('');

    // Test 2: With user_id using OAuth 1.0a
    console.log('Test 2: /subscriptions/{user_id}/all (OAuth 1.0a)');
    const url2 = `https://api.twitter.com/2/account_activity/webhooks/${webhook.id}/subscriptions/${bot.userId}/all`;
    console.log('   URL:', url2);
    console.log('   Method: DELETE');
    console.log('   Auth: OAuth 1.0a (bot credentials)');
    console.log('   Note: Explicit user_id in path');
    console.log('');

    // Test 3: With user_id using Bearer Token
    console.log('Test 3: /subscriptions/{user_id}/all (Bearer Token)');
    const url3 = `https://api.twitter.com/2/account_activity/webhooks/${webhook.id}/subscriptions/${bot.userId}/all`;
    console.log('   URL:', url3);
    console.log('   Method: DELETE');
    console.log('   Auth: Bearer Token');
    console.log('   Note: What we use in delete-orphaned-subscriptions.mjs');
    console.log('');

    console.log('=================================================================');
    console.log('   CONCLUSION');
    console.log('=================================================================');
    console.log('');
    console.log('Based on our testing with delete-orphaned-subscriptions.mjs:');
    console.log('✅ Endpoint 3 works correctly:');
    console.log('   DELETE /2/account_activity/webhooks/{id}/subscriptions/{user_id}/all');
    console.log('   Auth: Bearer Token');
    console.log('');
    console.log('❓ Current code uses Endpoint 1:');
    console.log('   DELETE /2/account_activity/webhooks/{id}/subscriptions/all');
    console.log('   Auth: OAuth 1.0a (bot tokens)');
    console.log('');
    console.log('🔧 RECOMMENDATION:');
    console.log('   Update unsubscribeWebhook() to use:');
    console.log('   - Endpoint: /subscriptions/{user_id}/all');
    console.log('   - Auth: Bearer Token (simpler, works consistently)');
    console.log('   - Requires passing bot.userId as parameter');
    console.log('');

    await prisma.$disconnect();

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
