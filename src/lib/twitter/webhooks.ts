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
 * If v2 fails, we can fall back to trying v1.1 (which may have permission issues).
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
  console.log('🔧 REGISTERING WEBHOOK WITH TWITTER API');
  console.log('================================================================================');
  console.log('   URL:', webhookUrl);
  console.log('   Env:', webhookEnv);
  console.log('   Timestamp:', new Date().toISOString());
  console.log('');

  // Try v2 API first if bearer token is available
  if (bearerToken) {
    console.log('📡 Attempting webhook registration with v2 API...');
    try {
      return await registerWebhookV2(webhookUrl, bearerToken);
    } catch (v2Error: any) {
      console.log(`⚠️  V2 API failed: ${v2Error.message}`);
      console.log('   Falling back to v1.1 API...');
    }
  }

  // Fall back to v1.1 API
  console.log('📡 Attempting webhook registration with v1.1 API...');
  return await registerWebhookV1(webhookUrl, consumerKey, consumerSecret, webhookEnv);
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

  return await retryWithBackoff(
    async () => {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: webhookUrl }),
      });

      console.log('📡 Twitter API v2 Response:', response.status, response.statusText);

      if (!response.ok) {
        let error: any;
        try {
          error = await response.json();
        } catch {
          throw new Error(`Twitter API v2 error: ${response.status} ${response.statusText}`);
        }
        console.error('❌ Twitter API v2 Error:', JSON.stringify(error, null, 2));
        const errorMessage = error.errors?.[0]?.message || error.detail || error.title || response.statusText;
        throw new Error(`Twitter API v2 error: ${errorMessage}`);
      }

      const result = await response.json();
      console.log('📦 Twitter API v2 Response Body:', JSON.stringify(result, null, 2));

      const webhookId = result.id || result.data?.id;
      const url = result.url || result.data?.url || webhookUrl;

      if (!webhookId) {
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

/**
 * Register webhook using Twitter API v1.1 (fallback)
 * POST /1.1/account_activity/all/{env}/webhooks.json?url={webhookUrl}
 */
async function registerWebhookV1(
  webhookUrl: string,
  consumerKey: string,
  consumerSecret: string,
  webhookEnv: string
): Promise<{ webhookId: string; url: string }> {
  const apiUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/webhooks.json`;

  return await retryWithBackoff(
    async () => {
      // The 'url' query param must be included in the OAuth signature
      const authHeader = generateOAuthHeader(
        'POST',
        apiUrl,
        consumerKey,
        consumerSecret,
        undefined,
        undefined,
        { url: webhookUrl }
      );

      const response = await fetch(
        `${apiUrl}?url=${encodeURIComponent(webhookUrl)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
          },
        }
      );

      console.log('📡 Twitter API v1.1 Response:', response.status, response.statusText);

      if (!response.ok) {
        let error: any;
        try {
          error = await response.json();
        } catch {
          throw new Error(`Twitter API v1.1 error: ${response.status} ${response.statusText}`);
        }
        console.error('❌ Twitter API v1.1 Error:', JSON.stringify(error, null, 2));
        const errorMessage = error.errors?.[0]?.message || error.detail || response.statusText;
        throw new Error(`Twitter API v1.1 error: ${errorMessage}`);
      }

      // v1.1 returns {id, url, valid, created_at} directly (no data wrapper)
      const result = await response.json();
      console.log('📦 Twitter API v1.1 Response Body:', JSON.stringify(result, null, 2));

      const webhookId = result.id;

      if (!webhookId) {
        throw new Error('Webhook registered but no ID returned by Twitter API v1.1');
      }

      console.log('');
      console.log('✅ WEBHOOK REGISTERED SUCCESSFULLY (v1.1)');
      console.log('   Webhook ID:', webhookId);
      console.log('   URL:', result.url);
      console.log('================================================================================');
      console.log('');

      return { webhookId, url: result.url };
    },
    {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 8000,
      backoffMultiplier: 2,
      onRetry: (error: Error, attempt: number, delay: number) => {
        console.log(`⚠️  WEBHOOK REGISTRATION V1.1 RETRY — attempt ${attempt}/3 — error: ${error.message} — next in ${delay}ms`);
      },
    }
  );
}

/**
 * Delete a webhook from Twitter Account Activity API v1.1
 * Auth: App-level OAuth 1.0a
 * DELETE /1.1/account_activity/all/{env}/webhooks/{webhookId}.json
 *
 * NOTE: May fail with 403 if the app does not have TAAS v1.1 management access.
 * This is non-fatal in most caller contexts (wrapped in try-catch).
 */
export async function deleteWebhook(
  webhookId: string,
  consumerKey: string,
  consumerSecret: string,
  webhookEnv: string
): Promise<void> {
  console.log('🗑️  Deleting webhook from Twitter API v1.1...');
  console.log('   Webhook ID:', webhookId);
  console.log('   Env:', webhookEnv);

  const url = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/webhooks/${webhookId}.json`;

  const authHeader = generateOAuthHeader('DELETE', url, consumerKey, consumerSecret);

  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': authHeader },
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
