import crypto from 'crypto';

/**
 * Twitter Webhooks Management Service
 * Based on xbot implementation
 *
 * Handles registration, subscription, and unsubscription of Twitter webhooks
 * using Twitter's Account Activity API
 */

/**
 * Generate OAuth 1.0a signature for Twitter API requests
 * Required for subscription/unsubscription endpoints
 */
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret?: string
): string {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  // Create signature base string
  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret || '')}`;

  // Generate signature
  const hmac = crypto.createHmac('sha1', signingKey);
  hmac.update(signatureBase);
  return hmac.digest('base64');
}

/**
 * Generate OAuth 1.0a authorization header
 */
function generateOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken?: string,
  accessSecret?: string
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(32).toString('base64').replace(/\W/g, '');

  const oauthParams: Record<string, string> = {
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
 * Register a new webhook with Twitter's API v2
 * Uses Bearer Token (OAuth 2.0)
 */
export async function registerWebhook(
  webhookUrl: string,
  bearerToken: string
): Promise<{ webhookId: string; url: string }> {
  console.log('🔧 Registering webhook with Twitter API v2...');
  console.log('   URL:', webhookUrl);
  console.log('   Bearer token present:', !!bearerToken);

  const response = await fetch(
    'https://api.twitter.com/2/webhooks',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: webhookUrl }),
    }
  );

  console.log('📡 Twitter API Response:', response.status, response.statusText);

  if (!response.ok) {
    let error: any;
    try {
      error = await response.json();
    } catch (jsonError) {
      console.error('❌ Twitter API Error (no JSON body):', response.status, response.statusText);
      throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
    }
    console.error('❌ Twitter API Error:', error);
    throw new Error(
      `Twitter API error: ${error.errors?.[0]?.message || error.detail || response.statusText}`
    );
  }

  const result = await response.json();
  console.log('📦 Twitter API Response Body:', JSON.stringify(result));

  const webhookId = result.data?.id;

  if (!webhookId) {
    console.error('❌ No webhook ID in response. Full response:', result);
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
 * Delete a webhook from Twitter's API v2
 * Uses Bearer Token (OAuth 2.0)
 */
export async function deleteWebhook(
  webhookId: string,
  bearerToken: string
): Promise<void> {
  console.log('🗑️  Deleting webhook from Twitter API v2...');
  console.log('   Webhook ID:', webhookId);

  const response = await fetch(
    `https://api.twitter.com/2/webhooks/${webhookId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
      },
    }
  );

  if (!response.ok) {
    let error: any;
    try {
      error = await response.json();
    } catch (jsonError) {
      console.error('❌ Twitter API Error (no JSON body):', response.status, response.statusText);
      throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
    }
    console.error('❌ Twitter API Error:', error);
    throw new Error(
      `Twitter API error: ${error.errors?.[0]?.message || error.detail || response.statusText}`
    );
  }

  console.log('✅ Webhook deleted successfully');
}

/**
 * Subscribe a bot account to the webhook (API v2)
 * Uses OAuth 1.0a with bot's access tokens
 */
export async function subscribeWebhook(
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessSecret: string,
  webhookId: string
): Promise<void> {
  console.log('📌 Subscribing bot to webhook (API v2)...');
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
    let error: any;
    try {
      error = await response.json();
    } catch (jsonError) {
      console.error('❌ Twitter API Error (no JSON body):', response.status, response.statusText);
      throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
    }

    // "Subscription already exists" is not an error
    if (error.detail?.includes('Subscription already exists') || response.status === 409) {
      console.log('✅ Subscription already exists (OK)');
      return;
    }

    console.error('❌ Twitter API Error:', error);
    throw new Error(
      `Twitter API error: ${error.errors?.[0]?.message || error.detail || response.statusText}`
    );
  }

  const data = await response.json();
  console.log('📦 Subscription response:', JSON.stringify(data));

  if (data.data?.subscribed) {
    console.log('✅ Bot subscribed successfully');
  } else {
    console.log('✅ Bot subscription completed');
  }
}

/**
 * Unsubscribe a bot account from the webhook (API v2)
 * Uses OAuth 1.0a with bot's access tokens
 */
export async function unsubscribeWebhook(
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessSecret: string,
  webhookId: string
): Promise<void> {
  console.log('📍 Unsubscribing bot from webhook (API v2)...');
  console.log('   Webhook ID:', webhookId);

  const url = `https://api.twitter.com/2/account_activity/webhooks/${webhookId}/subscriptions/all`;

  const authHeader = generateOAuthHeader(
    'DELETE',
    url,
    consumerKey,
    consumerSecret,
    accessToken,
    accessSecret
  );

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    let error: any;
    try {
      error = await response.json();
    } catch (jsonError) {
      console.error('❌ Twitter API Error (no JSON body):', response.status, response.statusText);
      throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
    }
    console.error('❌ Twitter API Error:', error);
    throw new Error(
      `Twitter API error: ${error.errors?.[0]?.message || error.detail || response.statusText}`
    );
  }

  console.log('✅ Bot unsubscribed from webhook successfully');
}

/**
 * List all registered webhooks (API v2)
 * Uses Bearer Token (OAuth 2.0)
 */
export async function listWebhooks(bearerToken: string): Promise<Array<{ id: string; url: string }>> {
  const response = await fetch(
    'https://api.twitter.com/2/webhooks',
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
      },
    }
  );

  if (!response.ok) {
    let error: any;
    try {
      error = await response.json();
    } catch (jsonError) {
      console.error('❌ Twitter API Error (no JSON body):', response.status, response.statusText);
      throw new Error(`Failed to list webhooks: ${response.status} ${response.statusText}`);
    }
    throw new Error(`Failed to list webhooks: ${response.status} ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  // API v2 returns { data: [{ id, url, ... }] }
  return data.data || [];
}
