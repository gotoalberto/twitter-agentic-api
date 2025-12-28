/**
 * Manual Webhook Registration Script for pepesdogbot
 *
 * This script manually registers a webhook with Twitter's API
 * and subscribes the bot to it.
 */

import { PrismaClient } from '../src/generated/prisma/index.js';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

const PROJECT_ID = 'cmjn22f3o0000lb04a8801vy9'; // pepesdogbot

/**
 * Generate OAuth 1.0a signature
 */
function generateOAuthSignature(
  method,
  url,
  params,
  consumerSecret,
  tokenSecret = ''
) {
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
 * Generate OAuth 1.0a authorization header
 */
function generateOAuthHeader(
  method,
  url,
  consumerKey,
  consumerSecret,
  accessToken,
  accessSecret
) {
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

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    consumerSecret,
    accessSecret
  );

  oauthParams.oauth_signature = signature;

  const authHeader = Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${authHeader}`;
}

/**
 * Register webhook with Twitter API v2
 */
async function registerWebhook(webhookUrl, bearerToken) {
  console.log('🔧 Registering webhook with Twitter API v2...');
  console.log('   URL:', webhookUrl);

  const response = await fetch('https://api.twitter.com/2/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: webhookUrl }),
  });

  console.log('📡 Twitter API Response:', response.status, response.statusText);

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Twitter API Error:', error);
    throw new Error(`Twitter API error: ${error.errors?.[0]?.message || error.detail || response.statusText}`);
  }

  const result = await response.json();
  console.log('📦 Twitter API Response Body:', JSON.stringify(result, null, 2));

  const webhookId = result.data?.id;

  if (!webhookId) {
    console.error('❌ No webhook ID in response');
    throw new Error('Webhook registered but no ID returned');
  }

  console.log('✅ Webhook registered successfully');
  console.log('   Webhook ID:', webhookId);

  return {
    webhookId: webhookId,
    url: webhookUrl,
  };
}

/**
 * Subscribe bot to webhook
 */
async function subscribeWebhook(
  consumerKey,
  consumerSecret,
  accessToken,
  accessSecret,
  webhookId
) {
  console.log('📌 Subscribing bot to webhook...');
  console.log('   Webhook ID:', webhookId);

  const url = `https://api.twitter.com/2/account_activity/webhooks/${webhookId}/subscriptions/all`;

  const authHeader = generateOAuthHeader(
    'POST',
    url,
    consumerKey,
    consumerSecret,
    accessToken,
    accessSecret
  );

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();

    // "Subscription already exists" is OK
    if (error.detail?.includes('Subscription already exists') || response.status === 409) {
      console.log('✅ Subscription already exists (OK)');
      return;
    }

    console.error('❌ Twitter API Error:', error);
    throw new Error(`Twitter API error: ${error.errors?.[0]?.message || error.detail || response.statusText}`);
  }

  const data = await response.json();
  console.log('📦 Subscription response:', JSON.stringify(data, null, 2));

  console.log('✅ Bot subscribed successfully');
}

/**
 * List existing webhooks
 */
async function listWebhooks(bearerToken) {
  console.log('🔍 Listing existing webhooks...');

  const response = await fetch('https://api.twitter.com/2/webhooks', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to list webhooks: ${response.status} ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  const webhooks = data.data || [];

  console.log(`   Found ${webhooks.length} webhook(s)`);
  webhooks.forEach((wh, i) => {
    console.log(`   ${i + 1}. ID: ${wh.id}`);
    console.log(`      URL: ${wh.url}`);
  });

  return webhooks;
}

async function main() {
  console.log('');
  console.log('=================================================================');
  console.log('   WEBHOOK REGISTRATION FOR PEPESDOGBOT');
  console.log('=================================================================');
  console.log('');

  // Check environment variables
  const bearerToken = process.env.X_API_BEARER_TOKEN;
  const consumerKey = process.env.TWITTER_OAUTH_API_KEY;
  const consumerSecret = process.env.TWITTER_OAUTH_API_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bitso-twitter-api.vercel.app';

  if (!bearerToken || !consumerKey || !consumerSecret) {
    console.error('❌ Missing required environment variables:');
    console.error('   X_API_BEARER_TOKEN:', bearerToken ? '✅' : '❌');
    console.error('   TWITTER_OAUTH_API_KEY:', consumerKey ? '✅' : '❌');
    console.error('   TWITTER_OAUTH_API_SECRET:', consumerSecret ? '✅' : '❌');
    process.exit(1);
  }

  // Get project and bot from database
  console.log('📦 Loading project from database...');
  const project = await prisma.project.findUnique({
    where: { id: PROJECT_ID },
    include: {
      bot: true,
      webhookRegistrations: true,
    },
  });

  if (!project) {
    console.error('❌ Project not found:', PROJECT_ID);
    process.exit(1);
  }

  console.log('   ✅ Project:', project.name);

  if (!project.bot) {
    console.error('❌ No bot configured for this project');
    console.error('   Please connect a bot first via the dashboard');
    process.exit(1);
  }

  console.log('   ✅ Bot: @' + project.bot.username);
  console.log('   Bot User ID:', project.bot.userId);
  console.log('');

  // Check existing registrations
  if (project.webhookRegistrations.length > 0) {
    console.log('⚠️  WARNING: Found existing webhook registrations in database:');
    project.webhookRegistrations.forEach((reg, i) => {
      console.log(`   ${i + 1}. Webhook ID: ${reg.webhookId}`);
      console.log(`      URL: ${reg.url}`);
      console.log(`      Subscribed: ${reg.subscribed}`);
    });
    console.log('');
    console.log('   This script will create a NEW registration.');
    console.log('');
  }

  // Construct webhook URL
  const webhookUrl = `${appUrl}/api/webhooks/twitter`;
  console.log('📍 Webhook URL:', webhookUrl);
  console.log('');

  // List existing webhooks in Twitter
  try {
    const existingWebhooks = await listWebhooks(bearerToken);
    const matchingWebhook = existingWebhooks.find(w => w.url === webhookUrl);

    if (matchingWebhook) {
      console.log('');
      console.log('✅ Webhook already exists in Twitter!');
      console.log('   Webhook ID:', matchingWebhook.id);
      console.log('   Will use this webhook and subscribe the bot to it.');
      console.log('');

      // Subscribe bot
      await subscribeWebhook(
        consumerKey,
        consumerSecret,
        project.bot.accessToken,
        project.bot.accessTokenSecret,
        matchingWebhook.id
      );

      // Save to database
      console.log('💾 Saving webhook registration to database...');
      await prisma.webhookRegistration.upsert({
        where: { webhookId: matchingWebhook.id },
        create: {
          projectId: project.id,
          webhookId: matchingWebhook.id,
          url: webhookUrl,
          subscribed: true,
        },
        update: {
          subscribed: true,
        },
      });

      console.log('   ✅ Saved to database');
      console.log('');
      console.log('=================================================================');
      console.log('   ✅ WEBHOOK REGISTRATION COMPLETE');
      console.log('=================================================================');
      console.log('');
      console.log('The bot @' + project.bot.username + ' is now subscribed to webhooks.');
      console.log('Twitter will send events to:', webhookUrl);
      console.log('');

      await prisma.$disconnect();
      return;
    }
  } catch (error) {
    console.error('⚠️  Error listing webhooks:', error.message);
    console.log('   Will attempt to register new webhook');
    console.log('');
  }

  // Register new webhook
  const result = await registerWebhook(webhookUrl, bearerToken);
  console.log('');

  // Subscribe bot
  await subscribeWebhook(
    consumerKey,
    consumerSecret,
    project.bot.accessToken,
    project.bot.accessTokenSecret,
    result.webhookId
  );
  console.log('');

  // Save to database
  console.log('💾 Saving webhook registration to database...');
  await prisma.webhookRegistration.upsert({
    where: { webhookId: result.webhookId },
    create: {
      projectId: project.id,
      webhookId: result.webhookId,
      url: webhookUrl,
      subscribed: true,
    },
    update: {
      subscribed: true,
    },
  });

  console.log('   ✅ Saved to database');
  console.log('');
  console.log('=================================================================');
  console.log('   ✅ WEBHOOK REGISTRATION COMPLETE');
  console.log('=================================================================');
  console.log('');
  console.log('The bot @' + project.bot.username + ' is now subscribed to webhooks.');
  console.log('Twitter will send events to:', webhookUrl);
  console.log('');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('');
  console.error('=================================================================');
  console.error('   ❌ ERROR');
  console.error('=================================================================');
  console.error('');
  console.error(e);
  console.error('');
  process.exit(1);
});
