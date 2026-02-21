#!/usr/bin/env node

/**
 * Test script for webhook registration with project cmj4h4o5y0000gy04oss0g3o9
 * This will test the exact flow and show what's failing
 */

const crypto = require('crypto');

// Direct database connection details
const DATABASE_URL = 'postgresql://bitsoapi:r46nLFKQxU38awBMdCfX@bitso-twitter.c8fvb2vdmdgp.us-east-1.rds.amazonaws.com:5432/twitterbot?schema=public';

// Function to generate OAuth signature
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

// Function to generate OAuth header
function generateOAuthHeader(method, url, consumerKey, consumerSecret, accessToken = null, accessSecret = null, additionalParams = {}) {
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

  const allSignatureParams = { ...oauthParams, ...additionalParams };
  const signature = generateOAuthSignature(method, url, allSignatureParams, consumerSecret, accessSecret || '');
  oauthParams.oauth_signature = signature;

  const authHeader = Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  return `OAuth ${authHeader}`;
}

async function getProjectCredentials() {
  console.log('📚 Fetching project credentials from database...\n');

  const { Client } = require('pg');
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();

    // Get project details with TwitterApp and Bot
    const result = await client.query(`
      SELECT
        p.id as project_id,
        p.name as project_name,
        p."apiEnabled",
        p."twitterAppId",
        ta.id as twitter_app_id,
        ta.name as twitter_app_name,
        ta."consumerKey",
        ta."consumerSecret",
        ta."bearerToken",
        ta."webhookEnv",
        b.username as bot_username,
        b."userId" as bot_user_id,
        b."accessToken" as bot_access_token,
        b."accessTokenSecret" as bot_access_secret
      FROM "Project" p
      LEFT JOIN "TwitterApp" ta ON p."twitterAppId" = ta.id
      LEFT JOIN "Bot" b ON p.id = b."projectId"
      WHERE p.id = 'cmj4h4o5y0000gy04oss0g3o9'
    `);

    if (result.rows.length === 0) {
      throw new Error('Project not found');
    }

    const project = result.rows[0];

    console.log('✅ Project found:', project.project_name);
    console.log('   TwitterApp:', project.twitter_app_name || 'NONE');
    console.log('   Bot:', project.bot_username || 'NONE');
    console.log('   API Enabled:', project.apiEnabled);
    console.log('');

    if (!project.consumerKey) {
      throw new Error('No TwitterApp configured for this project');
    }

    if (!project.bot_username) {
      throw new Error('No Bot connected to this project');
    }

    // Show credential status (first 10 chars only for security)
    console.log('📋 Credentials Status:');
    console.log('   Consumer Key:', project.consumerKey?.substring(0, 10) + '...');
    console.log('   Consumer Secret:', project.consumerSecret ? '✓ Present' : '✗ Missing');
    console.log('   Bearer Token:', project.bearerToken ? '✓ Present' : '✗ Missing');
    console.log('   Bot Access Token:', project.bot_access_token?.substring(0, 10) + '...');
    console.log('   Bot Access Secret:', project.bot_access_secret ? '✓ Present' : '✗ Missing');
    console.log('');

    return project;
  } finally {
    await client.end();
  }
}

async function testListWebhooks(bearerToken) {
  console.log('🔍 Testing: List existing webhooks (v2 API)...\n');

  try {
    const response = await fetch('https://api.twitter.com/2/webhooks', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${bearerToken}` }
    });

    console.log('   Status:', response.status, response.statusText);
    const data = await response.json();
    console.log('   Response:', JSON.stringify(data, null, 2));
    console.log('');

    return data.data || [];
  } catch (error) {
    console.error('❌ Error listing webhooks:', error.message);
    return [];
  }
}

async function testWebhookRegistration(project) {
  console.log('🔧 Testing: Register webhook (v1.1 API)...\n');

  const webhookUrl = `https://bitso-twitter-api.vercel.app/api/webhooks/twitter/${project.twitter_app_id}`;
  const webhookEnv = project.webhookEnv || 'production';
  const apiUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/webhooks.json`;

  console.log('   Webhook URL:', webhookUrl);
  console.log('   Environment:', webhookEnv);
  console.log('   API URL:', apiUrl);
  console.log('');

  try {
    // Generate OAuth header for app-only auth
    const authHeader = generateOAuthHeader(
      'POST',
      apiUrl,
      project.consumerKey,
      project.consumerSecret,
      null,
      null,
      { url: webhookUrl }
    );

    console.log('   Auth Header:', authHeader.substring(0, 50) + '...');
    console.log('');

    const response = await fetch(
      `${apiUrl}?url=${encodeURIComponent(webhookUrl)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
        }
      }
    );

    console.log('   Response Status:', response.status, response.statusText);

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    console.log('   Response Body:', JSON.stringify(data, null, 2));
    console.log('');

    if (response.status === 403) {
      console.log('⚠️  403 Forbidden - Possible issues:');
      console.log('   - App does not have Account Activity API v1.1 management access');
      console.log('   - Incorrect consumer key/secret');
      console.log('   - OAuth signature calculation issue');
      console.log('');
    }

    return { success: response.ok, data, status: response.status };
  } catch (error) {
    console.error('❌ Error registering webhook:', error.message);
    return { success: false, error: error.message };
  }
}

async function testSubscribeWebhook(project, webhookId) {
  console.log('📌 Testing: Subscribe bot to webhook (v2 API)...\n');

  const url = `https://api.twitter.com/2/account_activity/webhooks/${webhookId}/subscriptions/all`;

  console.log('   Webhook ID:', webhookId);
  console.log('   Bot User ID:', project.bot_user_id);
  console.log('   API URL:', url);
  console.log('');

  try {
    const authHeader = generateOAuthHeader(
      'POST',
      url,
      project.consumerKey,
      project.consumerSecret,
      project.bot_access_token,
      project.bot_access_secret
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      }
    });

    console.log('   Response Status:', response.status, response.statusText);

    if (response.status !== 204) {
      const data = await response.json();
      console.log('   Response Body:', JSON.stringify(data, null, 2));
    } else {
      console.log('   Response: No content (success)');
    }
    console.log('');

    return { success: response.ok || response.status === 204, status: response.status };
  } catch (error) {
    console.error('❌ Error subscribing to webhook:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('');
  console.log('================================================================================');
  console.log('🧪 WEBHOOK REGISTRATION TEST FOR PROJECT cmj4h4o5y0000gy04oss0g3o9');
  console.log('================================================================================');
  console.log('');

  try {
    // Step 1: Get project credentials from database
    const project = await getProjectCredentials();

    // Step 2: List existing webhooks
    console.log('────────────────────────────────────────────────────────────────────────────────');
    const webhooks = await testListWebhooks(project.bearerToken);

    // Step 3: Try to register webhook
    console.log('────────────────────────────────────────────────────────────────────────────────');
    const registrationResult = await testWebhookRegistration(project);

    // Step 4: If we have a webhook ID (either from registration or existing), try subscription
    let webhookId = null;

    if (registrationResult.success && registrationResult.data?.id) {
      webhookId = registrationResult.data.id;
      console.log('✅ Using newly registered webhook:', webhookId);
    } else if (webhooks.length > 0) {
      // Find webhook for this TwitterApp
      const appWebhookUrl = `https://bitso-twitter-api.vercel.app/api/webhooks/twitter/${project.twitter_app_id}`;
      const matchingWebhook = webhooks.find(w => w.url === appWebhookUrl);

      if (matchingWebhook) {
        webhookId = matchingWebhook.id;
        console.log('✅ Using existing matching webhook:', webhookId);
      } else if (webhooks[0]) {
        webhookId = webhooks[0].id;
        console.log('⚠️  Using first available webhook (no exact match):', webhookId);
      }
    }

    if (webhookId) {
      console.log('────────────────────────────────────────────────────────────────────────────────');
      await testSubscribeWebhook(project, webhookId);
    } else {
      console.log('❌ No webhook available for subscription testing');
    }

    console.log('================================================================================');
    console.log('📊 SUMMARY');
    console.log('================================================================================');
    console.log('   List webhooks:', webhooks.length > 0 ? `✅ Found ${webhooks.length} webhook(s)` : '❌ No webhooks');
    console.log('   Register webhook:', registrationResult.success ? '✅ Success' : `❌ Failed (${registrationResult.status || 'error'})`);
    console.log('   Webhook ID:', webhookId || 'None');
    console.log('');

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
main().then(() => {
  console.log('✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});