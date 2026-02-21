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
 * Register OR find existing webhook
 *
 * IMPORTANT: Most apps don't have TAAS v1.1 access for webhook registration.
 * This function will:
 * 1. First try to find an existing webhook using v2 API (Bearer Token)
 * 2. Only attempt registration if no webhook exists AND bearerToken is provided
 * 3. Return error if registration fails (likely due to no TAAS access)
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
  console.log('🔍 FINDING OR REGISTERING WEBHOOK');
  console.log('================================================================================');
  console.log('   URL:', webhookUrl);
  console.log('   Env:', webhookEnv);
  console.log('   Timestamp:', new Date().toISOString());
  console.log('');

  // Step 1: Try to list existing webhooks if we have a bearer token
  if (bearerToken) {
    console.log('📋 Step 1: Checking for existing webhooks using v2 API...');
    console.log('   Bearer Token:', `${bearerToken.substring(0, 20)}...`);

    try {
      const existingWebhooks = await listWebhooks(bearerToken, webhookEnv);
      console.log(`   Found ${existingWebhooks.length} existing webhook(s)`);

      // Check if our webhook URL already exists
      const matchingWebhook = existingWebhooks.find(w => w.url === webhookUrl);

      if (matchingWebhook) {
        console.log('✅ Found existing webhook with matching URL!');
        console.log('   Webhook ID:', matchingWebhook.id);
        console.log('   URL:', matchingWebhook.url);
        console.log('');
        console.log('================================================================================');
        console.log('✅ USING EXISTING WEBHOOK (no registration needed)');
        console.log('================================================================================');
        console.log('');

        return {
          webhookId: matchingWebhook.id,
          url: matchingWebhook.url
        };
      }

      // If any webhook exists, use it (even if URL doesn't match exactly)
      if (existingWebhooks.length > 0) {
        const firstWebhook = existingWebhooks[0];
        console.log('⚠️  No exact URL match, but found existing webhook:');
        console.log('   Webhook ID:', firstWebhook.id);
        console.log('   Existing URL:', firstWebhook.url);
        console.log('   Requested URL:', webhookUrl);
        console.log('');
        console.log('   Using existing webhook (URL mismatch will be handled by routing)');
        console.log('');

        return {
          webhookId: firstWebhook.id,
          url: firstWebhook.url
        };
      }
    } catch (listError: any) {
      console.error('⚠️  Failed to list existing webhooks:', listError.message);
      console.log('   Will attempt to register new webhook...');
    }
  } else {
    console.log('⚠️  No Bearer Token provided - cannot check for existing webhooks');
    console.log('   Will attempt to register new webhook directly...');
  }

  // Step 2: No existing webhook found - attempt registration (will likely fail without TAAS)
  console.log('');
  console.log('📋 Step 2: No existing webhook found - attempting registration...');
  console.log('   ⚠️  WARNING: Registration requires TAAS v1.1 access');
  console.log('   ⚠️  Most new apps do NOT have this access');
  console.log('');

  console.log('📋 Credentials check:');
  console.log('   Consumer Key:', consumerKey ? `${consumerKey.substring(0, 10)}...` : '❌ MISSING');
  console.log('   Consumer Secret:', consumerSecret ? '✅ Present' : '❌ MISSING');
  console.log('');

  // Try v1.1 registration (requires TAAS access)
  console.log('📡 Attempting Account Activity API v1.1 registration...');
  console.log('   API: Account Activity API v1.1');
  console.log('   Auth: OAuth 1.0a');
  console.log('   Note: This will fail with 403 if app lacks TAAS access');
  console.log('');

  try {
    const result = await registerWebhookV1(webhookUrl, consumerKey, consumerSecret, webhookEnv);
    console.log('✅ Webhook registered successfully!');
    return result;
  } catch (error: any) {
    console.error('❌ Webhook registration failed:', error.message);

    if (error.message?.includes('403')) {
      console.error('');
      console.error('   📌 This app does not have TAAS v1.1 access for webhook registration');
      console.error('   📌 Solution: Use a pre-registered webhook or manual configuration');
      console.error('');
      throw new Error('No TAAS access for webhook registration. Please use existing webhook or configure manually.');
    }

    throw error;
  }
}

/**
 * Register webhook using Twitter Account Activity API v1.1
 * POST https://api.twitter.com/1.1/account_activity/all/:env_name/webhooks.json
 */
async function registerWebhookV1(
  webhookUrl: string,
  consumerKey: string,
  consumerSecret: string,
  webhookEnv: string
): Promise<{ webhookId: string; url: string }> {
  const apiUrl = `https://api.twitter.com/1.1/account_activity/all/${webhookEnv}/webhooks.json`;

  console.log('📦 registerWebhookV1 called with Account Activity API:');
  console.log('   API URL:', apiUrl);
  console.log('   Webhook URL:', webhookUrl);
  console.log('   Environment:', webhookEnv);
  console.log('   Auth Method: OAuth 1.0a');
  console.log('');

  return await retryWithBackoff(
    async () => {
      // Create OAuth 1.0a signature for app-only auth (no user tokens)
      const oauthParams = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: generateNonce(),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_version: '1.0',
      };

      // Build signature base string
      const params = { ...oauthParams, url: webhookUrl };
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');

      const signatureBase = [
        'POST',
        encodeURIComponent(apiUrl),
        encodeURIComponent(sortedParams),
      ].join('&');

      // Generate signature using consumer secret only (no token secret for app-only)
      const signingKey = `${encodeURIComponent(consumerSecret)}&`;
      const signature = crypto
        .createHmac('sha1', signingKey)
        .update(signatureBase)
        .digest('base64');

      // Build OAuth header
      const authHeader = 'OAuth ' + Object.keys(oauthParams)
        .concat(['oauth_signature'])
        .sort()
        .map(key => {
          const value = key === 'oauth_signature' ? signature : oauthParams[key];
          return `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`;
        })
        .join(', ');

      console.log('🌐 Making HTTP request to Account Activity API v1.1:');
      console.log('   Method: POST');
      console.log('   URL:', apiUrl);
      console.log('   Auth Header:', authHeader.substring(0, 50) + '...');
      console.log('');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `url=${encodeURIComponent(webhookUrl)}`,
      });

      console.log('📡 Twitter Account Activity API Response:', response.status, response.statusText);

      if (!response.ok) {
        let errorText: string = '';
        try {
          errorText = await response.text();
          const error = JSON.parse(errorText);
          console.error('❌ Account Activity API Error Response:');
          console.error('   Status Code:', response.status);
          console.error('   Error Body:', JSON.stringify(error, null, 2));

          if (error.errors && Array.isArray(error.errors)) {
            console.error('   Error Details:');
            error.errors.forEach((e: any, i: number) => {
              console.error(`     [${i}] Code: ${e.code || 'N/A'}`);
              console.error(`     [${i}] Message: ${e.message || 'N/A'}`);
            });
          }

          const errorMessage = error.errors?.[0]?.message || error.error || response.statusText;
          throw new Error(`Account Activity API error: ${errorMessage}`);
        } catch (parseError) {
          console.error('❌ Failed to parse error response:');
          console.error('   Raw response:', errorText || `${response.status} ${response.statusText}`);
          throw new Error(`Account Activity API error: ${response.status} ${response.statusText}`);
        }
      }

      const result = await response.json();
      console.log('📦 Account Activity API Success Response:', JSON.stringify(result, null, 2));

      const webhookId = result.id;
      const url = result.url || webhookUrl;

      if (!webhookId) {
        console.error('❌ Webhook response missing ID!');
        console.error('   Full response:', JSON.stringify(result, null, 2));
        throw new Error('Webhook registered but no ID returned');
      }

      console.log('');
      console.log('✅ WEBHOOK REGISTERED SUCCESSFULLY (Account Activity API v1.1)');
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
    }
  );
}

/**
 * Register webhook using Twitter API v2
 * POST https://api.x.com/2/webhooks
 *
 * NOTE: This endpoint does not exist in the X/Twitter API.
 * This function is kept for reference but should not be used.
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
