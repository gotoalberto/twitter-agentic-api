import crypto from 'crypto';
import { retryWithBackoff } from '@/lib/utils/retry';
export { createBearerToken } from '@/lib/twitter/bearer-token';

/**
 * Twitter Webhooks Management Service
 *
 * Uses a mix of Twitter API endpoints:
 *
 * - listWebhooks:      GET  /2/webhooks  (v2, Bearer Token) — works with this app
 * - subscribeWebhook:  POST /2/account_activity/webhooks/{id}/subscriptions/all  (v2, User OAuth 1.0a)
 * - unsubscribeWebhook: DELETE /2/account_activity/webhooks/{id}/subscriptions/{userId}/all (v2, Bearer)
 * - registerWebhook:   POST /1.1/account_activity/all/{env}/webhooks.json  (v1.1, App OAuth 1.0a)
 * - deleteWebhook:     DELETE /1.1/account_activity/all/{env}/webhooks/{id}.json  (v1.1, App OAuth 1.0a)
 *
 * WHY MIXED:
 *   v1.1 management (list/register/delete) returns 403 for this app — no TAAS v1.1 management access.
 *   v2 list + subscription endpoints WORK because the app originally registered the webhook via v2
 *   and subscription/unsubscription via v2 does not require the same "Project attachment" that
 *   v2 webhook REGISTRATION requires.
 *
 *   The main webhook (id=1999190094972911617) is already registered at Twitter.
 *   v2 list finds it, and v2 subscription adds bots to it.
 */

/**
 * Generate OAuth 1.0a signature for Twitter API requests
 */
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret?: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret || '')}`;

  const hmac = crypto.createHmac('sha1', signingKey);
  hmac.update(signatureBase);
  return hmac.digest('base64');
}

/**
 * Generate OAuth 1.0a Authorization header.
 * additionalParams: extra query/body params that must be included in the signature
 * (e.g. the `url` param for webhook registration).
 */
function generateOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken?: string,
  accessSecret?: string,
  additionalParams?: Record<string, string>
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

  // Include additional request params (query/body) in signature as required by OAuth 1.0a spec
  const allSignatureParams = { ...oauthParams, ...(additionalParams || {}) };

  const signature = generateOAuthSignature(
    method,
    url,
    allSignatureParams,
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
 * Register a new webhook with Twitter API v2
 * Auth: Bearer Token (app-level)
 * POST https://api.x.com/2/webhooks
 *
 * This uses the new v2 API endpoint for webhook registration.
 * v1.1 API is deprecated and no longer available.
 */
export async function registerWebhook(
  webhookUrl: string,
  consumerKey: string,
  consumerSecret: string,
  webhookEnv: string,
  bearerToken?: string
): Promise<{ webhookId: string; url: string }> {
  console.log('');
  console.log('================================================================================');
  console.log('🔧 REGISTERING WEBHOOK WITH TWITTER API v2');
  console.log('================================================================================');
  console.log('   URL:', webhookUrl);
  console.log('   Env:', webhookEnv);
  console.log('   Timestamp:', new Date().toISOString());
  console.log('');

  console.log('📋 Credentials check:');
  console.log('   Consumer Key:', consumerKey ? `${consumerKey.substring(0, 10)}...` : '❌ MISSING');
  console.log('   Consumer Secret:', consumerSecret ? '✅ Present' : '❌ MISSING');
  console.log('   Bearer Token:', bearerToken ? `${bearerToken.substring(0, 20)}...` : '❌ MISSING');
  console.log('');

  // v2 API is required - v1.1 is no longer available
  if (!bearerToken) {
    console.error('❌ FATAL: Bearer token is missing!');
    console.error('   v1.1 API is no longer available on X/Twitter');
    console.error('   Bearer token is REQUIRED for v2 API webhook registration');
    throw new Error('Bearer token is required for webhook registration. v1.1 API is no longer available.');
  }

  console.log('📡 Calling registerWebhookV2 with X API v2...');
  console.log('   API Version: v2 (only supported version)');
  return await registerWebhookV2(webhookUrl, bearerToken);
}

/**
 * Register webhook using Twitter API v2
 * POST https://api.x.com/2/webhooks
 */
async function registerWebhookV2(
  webhookUrl: string,
  bearerToken: string
): Promise<{ webhookId: string; url: string }> {
  const apiUrl = 'https://api.x.com/2/webhooks';

  console.log('📦 registerWebhookV2 called with:');
  console.log('   API URL:', apiUrl);
  console.log('   Webhook URL:', webhookUrl);
  console.log('   Bearer Token:', bearerToken ? `${bearerToken.substring(0, 20)}...` : '❌ MISSING');
  console.log('');

  return await retryWithBackoff(
    async () => {
      const requestBody = JSON.stringify({ url: webhookUrl });
      const requestHeaders = {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      };

      console.log('🌐 Making HTTP request to X API v2:');
      console.log('   Method: POST');
      console.log('   URL:', apiUrl);
      console.log('   Headers:');
      console.log('     Authorization:', requestHeaders.Authorization.substring(0, 30) + '...');
      console.log('     Content-Type:', requestHeaders['Content-Type']);
      console.log('   Body:', requestBody);
      console.log('');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
      });

      console.log('📡 Twitter API v2 Response:', response.status, response.statusText);
      console.log('   Response Headers:');
      response.headers.forEach((value, key) => {
        if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('limit')) {
          console.log(`     ${key}: ${value}`);
        }
      });
      console.log('');

      if (!response.ok) {
        let error: any;
        let errorText: string = '';
        try {
          errorText = await response.text();
          error = JSON.parse(errorText);
        } catch {
          console.error('❌ Failed to parse error response as JSON:');
          console.error('   Raw response:', errorText || `${response.status} ${response.statusText}`);
          throw new Error(`Twitter API v2 error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        console.error('❌ Twitter API v2 Error Response:');
        console.error('   Status Code:', response.status);
        console.error('   Status Text:', response.statusText);
        console.error('   Error Body:', JSON.stringify(error, null, 2));

        // Log specific error details
        if (error.errors && Array.isArray(error.errors)) {
          console.error('   Error Details:');
          error.errors.forEach((e: any, i: number) => {
            console.error(`     [${i}] Message: ${e.message || 'N/A'}`);
            console.error(`     [${i}] Type: ${e.type || 'N/A'}`);
            console.error(`     [${i}] Parameter: ${e.parameter || 'N/A'}`);
          });
        }

        const errorMessage = error.errors?.[0]?.message || error.detail || error.title || response.statusText;
        throw new Error(`Twitter API v2 error: ${errorMessage}`);
      }

      const result = await response.json();
      console.log('📦 Twitter API v2 Success Response:', JSON.stringify(result, null, 2));

      const webhookId = result.id || result.data?.id;
      const url = result.url || result.data?.url || webhookUrl;

      if (!webhookId) {
        console.error('❌ Webhook response missing ID!');
        console.error('   Full response:', JSON.stringify(result, null, 2));
        throw new Error('Webhook registered but no ID returned by Twitter API v2');
      }

      console.log('');
      console.log('✅ WEBHOOK REGISTERED SUCCESSFULLY (v2)');
      console.log('   Webhook ID:', webhookId);
      console.log('   URL:', url);
      console.log('================================================================================');
      console.log('');

      return { webhookId, url };
    },
    {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 8000,
      backoffMultiplier: 2,
      onRetry: (error: Error, attempt: number, delay: number) => {
        console.log(`⚠️  WEBHOOK REGISTRATION V2 RETRY — attempt ${attempt}/3 — error: ${error.message} — next in ${delay}ms`);
      },
    }
  );
}

// v1.1 API has been removed - X/Twitter no longer supports v1.1 endpoints

/**
 * Delete a webhook from Twitter API v2
 * Auth: Bearer Token (app-level)
 * DELETE https://api.x.com/2/webhooks/{webhookId}
 *
 * NOTE: v1.1 API is no longer available. Using v2 API.
 */
export async function deleteWebhook(
  webhookId: string,
  consumerKey: string,
  consumerSecret: string,
  webhookEnv: string,
  bearerToken?: string
): Promise<void> {
  console.log('🗑️  Deleting webhook from Twitter API v2...');
  console.log('   Webhook ID:', webhookId);
  console.log('   Env:', webhookEnv);

  if (!bearerToken) {
    throw new Error('Bearer token is required for webhook deletion. v1.1 API is no longer available.');
  }

  const url = `https://api.x.com/2/webhooks/${webhookId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
    },
  });

  if (response.status === 204 || response.ok) {
    console.log('✅ Webhook deleted successfully');
    return;
  }

  let error: any;
  try {
    error = await response.json();
  } catch {
    throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
  }
  console.error('❌ Twitter API Error:', error);
  throw new Error(
    `Twitter API error: ${error.errors?.[0]?.message || error.detail || response.statusText}`
  );
}

/**
 * Subscribe a bot account to the webhook (Account Activity API v2)
 * Auth: User-level OAuth 1.0a (bot's access tokens)
 * POST /2/account_activity/webhooks/{webhookId}/subscriptions/all
 *
 * Uses v2 endpoint because:
 * - The app's webhook was registered via v2 originally
 * - v2 subscription does NOT require Project attachment (only v2 webhook REGISTRATION does)
 * - v1.1 subscription endpoint returns 403 for this app (no TAAS v1.1 management access)
 */
export async function subscribeWebhook(
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessSecret: string,
  webhookId: string,
  userId: string,
  bearerToken: string,
  webhookEnv: string
): Promise<void> {
  console.log('');
  console.log('================================================================================');
  console.log('📌 SUBSCRIBING BOT TO WEBHOOK (v2)');
  console.log('================================================================================');
  console.log('   Webhook ID:', webhookId);
  console.log('   User ID:', userId);
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

      // v2 subscription returns 200 with JSON body on success (or 204 No Content)
      if (response.ok || response.status === 204) {
        let data: any = {};
        if (response.status !== 204) {
          try { data = await response.json(); } catch { /* ignore */ }
        }
        console.log('');
        console.log('✅ BOT SUBSCRIBED SUCCESSFULLY');
        console.log('   Webhook ID:', webhookId);
        console.log('   User ID:', userId);
        if (data?.data?.subscribed !== undefined) {
          console.log('   Subscribed:', data.data.subscribed);
        }
        console.log('================================================================================');
        console.log('');
        return;
      }

      let error: any;
      try {
        error = await response.json();
      } catch {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      console.error('❌ Twitter API Error Response:');
      console.error('   Status:', response.status);
      console.error('   Error:', JSON.stringify(error, null, 2));

      // Duplicate subscription: conflict (409) or "Subscription already exists" message
      const isDuplicateSubscription =
        response.status === 409 ||
        error.detail?.includes('already') ||
        error.errors?.[0]?.message?.includes('already') ||
        error.errors?.[0]?.message?.includes('DuplicateSubscription');

      if (isDuplicateSubscription) {
        console.log('⚠️  SUBSCRIPTION ALREADY EXISTS - RECREATING...');
        try {
          await unsubscribeWebhook(webhookId, userId, bearerToken, webhookEnv);
          console.log('   ✅ Existing subscription deleted');
        } catch (unsubErr: any) {
          console.error('   ⚠️  Failed to delete existing subscription:', unsubErr.message);
        }
        throw new Error('Subscription existed and was deleted - retrying subscription');
      }

      const errorMessage = error.errors?.[0]?.message || error.detail || response.statusText;
      throw new Error(`Twitter API error: ${errorMessage}`);
    },
    {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 8000,
      backoffMultiplier: 2,
      onRetry: (error: Error, attempt: number, delay: number) => {
        console.log(`⚠️  WEBHOOK SUBSCRIPTION RETRY — attempt ${attempt}/3 — error: ${error.message} — next in ${delay}ms`);
      },
    }
  );
}

/**
 * Unsubscribe a bot account from the webhook (Account Activity API v2)
 * Auth: Bearer Token (app-level)
 * DELETE /2/account_activity/webhooks/{webhookId}/subscriptions/{userId}/all
 *
 * Uses v2 endpoint to match how subscriptions were created.
 */
export async function unsubscribeWebhook(
  webhookId: string,
  userId: string,
  bearerToken: string,
  webhookEnv: string
): Promise<void> {
  console.log('');
  console.log('================================================================================');
  console.log('🔌 UNSUBSCRIBING BOT FROM WEBHOOK (v2)');
  console.log('================================================================================');
  console.log('   Webhook ID:', webhookId);
  console.log('   User ID:', userId);
  console.log('   Timestamp:', new Date().toISOString());
  console.log('');

  const url = `https://api.twitter.com/2/account_activity/webhooks/${webhookId}/subscriptions/${userId}/all`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${bearerToken}` },
  });

  console.log('📡 Twitter API Response:', response.status, response.statusText);

  if (response.status === 204 || response.ok) {
    console.log('✅ BOT UNSUBSCRIBED SUCCESSFULLY');
    console.log('================================================================================');
    console.log('');
    return;
  }

  let error: any;
  try {
    error = await response.json();
  } catch {
    throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
  }

  console.error('❌ UNSUBSCRIBE FAILED:', JSON.stringify(error, null, 2));
  const errorMessage = error.errors?.[0]?.message || error.detail || response.statusText;
  throw new Error(`Twitter API error: ${errorMessage}`);
}

/**
 * List all registered webhooks (Account Activity API v2)
 * Auth: Bearer Token
 * GET /2/webhooks
 *
 * Uses v2 because v1.1 list returns 403 for this app.
 * v2 list returns the webhook registered for this app (id=1999190094972911617).
 */
export async function listWebhooks(
  bearerToken: string,
  webhookEnv?: string
): Promise<Array<{ id: string; url: string }>> {
  const url = 'https://api.twitter.com/2/webhooks';

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${bearerToken}` },
  });

  if (!response.ok) {
    let error: any;
    try {
      error = await response.json();
    } catch {
      throw new Error(`Failed to list webhooks: ${response.status} ${response.statusText}`);
    }
    throw new Error(`Failed to list webhooks: ${response.status} ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  // v2 returns { data: [{ id, url, valid, created_at }], meta: { result_count } }
  return data.data || [];
}
