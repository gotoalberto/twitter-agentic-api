import crypto from 'crypto';
import { retryWithBackoff } from '@/lib/utils/retry';

/**
 * Twitter Webhooks Management Service
 * Based on xbot implementation
 *
 * Handles registration, subscription, and unsubscription of Twitter webhooks
 * using Twitter's Account Activity API
 *
 * Features:
 * - Automatic retries with exponential backoff for transient failures
 * - Detailed logging for debugging and monitoring
 * - Proper error handling and reporting
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
 *
 * This function includes automatic retries with exponential backoff
 * to handle transient network failures or rate limits.
 *
 * @throws Error if registration fails after all retries
 */
export async function registerWebhook(
  webhookUrl: string,
  bearerToken: string
): Promise<{ webhookId: string; url: string }> {
  console.log('');
  console.log('================================================================================');
  console.log('🔧 REGISTERING WEBHOOK WITH TWITTER API');
  console.log('================================================================================');
  console.log('   URL:', webhookUrl);
  console.log('   Bearer token present:', !!bearerToken);
  console.log('   Timestamp:', new Date().toISOString());
  console.log('');

  return await retryWithBackoff(
    async () => {
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
          const errorMsg = `Twitter API error: ${response.status} ${response.statusText}`;

          // Log detailed error for debugging
          console.error('   Request URL:', 'https://api.twitter.com/2/webhooks');
          console.error('   Request Method: POST');
          console.error('   Response Status:', response.status);
          console.error('   Response Status Text:', response.statusText);

          throw new Error(errorMsg);
        }

        console.error('❌ Twitter API Error Response:');
        console.error('   Status:', response.status);
        console.error('   Error:', JSON.stringify(error, null, 2));

        const errorMessage = error.errors?.[0]?.message || error.detail || response.statusText;
        throw new Error(`Twitter API error: ${errorMessage}`);
      }

      const result = await response.json();
      console.log('📦 Twitter API Response Body:', JSON.stringify(result, null, 2));

      const webhookId = result.data?.id;

      if (!webhookId) {
        console.error('❌ No webhook ID in response. Full response:', JSON.stringify(result, null, 2));
        throw new Error('Webhook registered but no ID returned by Twitter API');
      }

      console.log('');
      console.log('✅ WEBHOOK REGISTERED SUCCESSFULLY');
      console.log('   Webhook ID:', webhookId);
      console.log('   URL:', webhookUrl);
      console.log('   Timestamp:', new Date().toISOString());
      console.log('================================================================================');
      console.log('');

      return {
        webhookId: webhookId,
        url: webhookUrl,
      };
    },
    {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 8000,
      backoffMultiplier: 2,
      onRetry: (error, attempt, delay) => {
        console.log('');
        console.log('⚠️  WEBHOOK REGISTRATION RETRY');
        console.log('   Attempt:', attempt, '/ 3');
        console.log('   Error:', error.message);
        console.log('   Next retry in:', delay, 'ms');
        console.log('');
      },
    }
  );
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
 *
 * This function includes automatic retries with exponential backoff
 * to handle transient network failures or rate limits.
 *
 * If subscription already exists, it will be deleted and recreated to ensure it's active.
 *
 * @throws Error if subscription fails after all retries
 */
export async function subscribeWebhook(
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessSecret: string,
  webhookId: string,
  userId: string,
  bearerToken: string
): Promise<void> {
  console.log('');
  console.log('================================================================================');
  console.log('📌 SUBSCRIBING BOT TO WEBHOOK');
  console.log('================================================================================');
  console.log('   Webhook ID:', webhookId);
  console.log('   Timestamp:', new Date().toISOString());
  console.log('');

  await retryWithBackoff(
    async () => {
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

      console.log('📡 Twitter API Response:', response.status, response.statusText);

      if (!response.ok) {
        let error: any;
        try {
          error = await response.json();
        } catch (jsonError) {
          console.error('❌ Twitter API Error (no JSON body):', response.status, response.statusText);
          const errorMsg = `Twitter API error: ${response.status} ${response.statusText}`;

          // Log detailed error for debugging
          console.error('   Request URL:', url);
          console.error('   Request Method: POST');
          console.error('   Response Status:', response.status);
          console.error('   Response Status Text:', response.statusText);

          throw new Error(errorMsg);
        }

        // Check if subscription already exists
        const isDuplicateSubscription =
          error.detail?.includes('Subscription already exists') ||
          error.errors?.[0]?.message?.includes('Subscription already exists') ||
          error.errors?.[0]?.message?.includes('DuplicateSubscriptionFailed') ||
          response.status === 409;

        if (isDuplicateSubscription) {
          console.log('');
          console.log('⚠️  SUBSCRIPTION ALREADY EXISTS - RECREATING');
          console.log('   Webhook ID:', webhookId);
          console.log('   User ID:', userId);
          console.log('   Timestamp:', new Date().toISOString());
          console.log('');

          // Delete existing subscription
          console.log('🗑️  Deleting existing subscription...');
          try {
            await unsubscribeWebhook(webhookId, userId, bearerToken);
            console.log('   ✅ Existing subscription deleted successfully');
          } catch (unsubscribeError: any) {
            console.error('   ⚠️  Failed to delete existing subscription:', unsubscribeError.message);
            console.error('   Continuing with subscription attempt...');
          }

          console.log('');
          console.log('🔄 Retrying subscription after deletion...');
          console.log('');

          // Retry subscription (throw error to trigger retry mechanism)
          throw new Error('Subscription existed and was deleted - retrying subscription');
        }

        console.error('❌ Twitter API Error Response:');
        console.error('   Status:', response.status);
        console.error('   Error:', JSON.stringify(error, null, 2));

        const errorMessage = error.errors?.[0]?.message || error.detail || response.statusText;
        throw new Error(`Twitter API error: ${errorMessage}`);
      }

      const data = await response.json();
      console.log('📦 Subscription Response:', JSON.stringify(data, null, 2));

      console.log('');
      console.log('✅ BOT SUBSCRIBED SUCCESSFULLY');
      console.log('   Webhook ID:', webhookId);
      console.log('   Subscription Status:', data.data?.subscribed ? 'Subscribed' : 'Completed');
      console.log('   Timestamp:', new Date().toISOString());
      console.log('================================================================================');
      console.log('');
    },
    {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 8000,
      backoffMultiplier: 2,
      onRetry: (error, attempt, delay) => {
        console.log('');
        console.log('⚠️  WEBHOOK SUBSCRIPTION RETRY');
        console.log('   Attempt:', attempt, '/ 3');
        console.log('   Error:', error.message);
        console.log('   Next retry in:', delay, 'ms');
        console.log('');
      },
    }
  );
}

/**
 * Unsubscribe a bot account from the webhook (API v2)
 * Uses Bearer Token (simpler and more reliable than OAuth 1.0a)
 *
 * Updated to use correct endpoint: /subscriptions/{user_id}/all
 * This prevents orphaned subscriptions when bots are disconnected or projects deleted.
 *
 * @param webhookId - Twitter webhook ID
 * @param userId - Twitter user ID of the bot to unsubscribe
 * @param bearerToken - Twitter API Bearer Token (app-level authentication)
 */
export async function unsubscribeWebhook(
  webhookId: string,
  userId: string,
  bearerToken: string
): Promise<void> {
  console.log('');
  console.log('================================================================================');
  console.log('🔌 UNSUBSCRIBING BOT FROM WEBHOOK');
  console.log('================================================================================');
  console.log('   Webhook ID:', webhookId);
  console.log('   User ID:', userId);
  console.log('   Timestamp:', new Date().toISOString());
  console.log('');

  // Correct endpoint according to official Twitter API documentation
  const url = `https://api.twitter.com/2/account_activity/webhooks/${webhookId}/subscriptions/${userId}/all`;

  console.log('📡 Making DELETE request...');
  console.log('   URL:', url);
  console.log('   Auth: Bearer Token');
  console.log('');

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
    },
  });

  console.log('📡 Twitter API Response:', response.status, response.statusText);

  if (!response.ok) {
    let error: any;
    try {
      error = await response.json();
    } catch (jsonError) {
      console.error('');
      console.error('❌ UNSUBSCRIBE FAILED (no JSON body)');
      console.error('   Status:', response.status, response.statusText);
      console.error('   URL:', url);
      console.error('   User ID:', userId);
      console.error('   Webhook ID:', webhookId);
      console.error('');
      throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
    }

    console.error('');
    console.error('❌ UNSUBSCRIBE FAILED');
    console.error('   Status:', response.status);
    console.error('   Error:', JSON.stringify(error, null, 2));
    console.error('   URL:', url);
    console.error('   User ID:', userId);
    console.error('   Webhook ID:', webhookId);
    console.error('');

    const errorMessage = error.errors?.[0]?.message || error.detail || response.statusText;
    throw new Error(`Twitter API error: ${errorMessage}`);
  }

  console.log('');
  console.log('✅ BOT UNSUBSCRIBED SUCCESSFULLY');
  console.log('   User ID:', userId);
  console.log('   Webhook ID:', webhookId);
  console.log('   Timestamp:', new Date().toISOString());
  console.log('================================================================================');
  console.log('');
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
