# Bitso Twitter API - OAuth & Webhook Registration Analysis

## Executive Summary

The codebase implements a **dual-OAuth architecture** to manage Twitter webhooks and bot authentication:
- **OAuth 1.0a** for bot account authentication and webhook subscription
- **OAuth 2.0** (Bearer Token) for app-level administrative operations
- **Mixed API versions** (v1.1 and v2) due to Twitter API limitations

### Key Finding: Why Webhook Registration Fails

**Root Cause**: The bearer token used for webhook registration may be **expired or invalid**. The recent refactoring (commit 639201c) removed environment variable credentials and moved everything to the TwitterApp database model, but this introduced a critical vulnerability to expired bearer tokens.

---

## 1. OAuth Version Usage Analysis

### 1.1 OAuth 1.0a - User-Level Authentication

**Purpose**: Authenticate individual bot accounts with Twitter

**Usage**: 
- Bot account connection via `TwitterApi` library OAuth 1.0a flow
- Webhook subscription using bot's user-level tokens
- Tweet publishing on behalf of the bot

**Files**:
- `/src/app/api/projects/[id]/bot/authorize/route.ts` - Initiates OAuth 1.0a flow
- `/src/app/api/auth/bot-twitter/callback/route.ts` - Completes OAuth 1.0a handshake, saves bot tokens

**Code Example**:
```typescript
// From /src/app/api/projects/[id]/bot/authorize/route.ts (lines 58-66)
const client = new TwitterApi({
  appKey: apiKey,          // Consumer Key
  appSecret: apiSecret,    // Consumer Secret
});

// Generate auth link (OAuth 1.0a User Login flow)
const authLink = await client.generateAuthLink(callbackUrl, {
  linkMode: 'authorize',
});
```

**Token Storage**: 
- Bot tokens encrypted and stored in PostgreSQL `Bot` table
- Fields: `accessToken`, `accessTokenSecret`
- Encryption: AES-256-GCM via utility in `/src/lib/utils/encryption`

---

### 1.2 OAuth 2.0 - App-Level Authentication

**Purpose**: Administrative operations at the app level (Bearer Token auth)

**Usage**:
- Listing existing webhooks via v2 API
- Verifying bearer token validity
- Creating/revoking bearer tokens

**Bearer Token Types**:
1. **Generated per TwitterApp**: Stored in `TwitterApp.bearerToken` (encrypted in DB)
2. **Utility Functions**: `/src/lib/twitter/bearer-token.ts` provides:
   - `createBearerToken()` - Creates new bearer token from consumer credentials
   - `verifyBearerToken()` - Validates token by making test request
   - `revokeBearerToken()` - Invalidates a token

**Code Example**:
```typescript
// From /src/lib/twitter/bearer-token.ts (lines 12-44)
export async function createBearerToken(
  consumerKey: string,
  consumerSecret: string
): Promise<string> {
  const credentials = Buffer.from(
    `${encodeURIComponent(consumerKey)}:${encodeURIComponent(consumerSecret)}`
  ).toString('base64');

  const response = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: 'grant_type=client_credentials',
  });
  // ... returns bearer token
}
```

---

## 2. Webhook Registration Flow - Detailed Analysis

### 2.1 Architecture Overview

The webhook registration uses a **mixed API approach**:

```
┌─────────────────────────────────────────────────────────┐
│         Webhook Registration Flow (Bot Connection)      │
└─────────────────────────────────────────────────────────┘

1. Bot OAuth 1.0a Flow
   │
   └─→ Exchange temporary tokens for permanent bot tokens
       (OAuth 1.0a User-Level)

2. Webhook Discovery/Registration
   │
   ├─→ LIST WEBHOOKS (v2, Bearer Token) ← OAuth 2.0, App-Level
   │   GET /2/webhooks
   │
   ├─→ If not found: REGISTER WEBHOOK (v1.1, OAuth 1.0a, App-Level) ← OAuth 1.0a
   │   POST /1.1/account_activity/all/{env}/webhooks.json?url={webhookUrl}
   │
   └─→ SUBSCRIBE BOT (v2, User-Level) ← OAuth 1.0a, User-Level
       POST /2/account_activity/webhooks/{webhookId}/subscriptions/all
```

### 2.2 API Endpoints Used

**Source**: `/src/lib/twitter/webhooks.ts` (lines 10-24)

| Operation | Endpoint | API Version | Auth Method | Auth Level |
|-----------|----------|-------------|------------|-----------|
| List Webhooks | `GET /2/webhooks` | v2 | Bearer Token | App-Level |
| Register Webhook | `POST /1.1/account_activity/all/{env}/webhooks.json` | v1.1 | OAuth 1.0a | App-Level |
| Delete Webhook | `DELETE /1.1/account_activity/all/{env}/webhooks/{id}.json` | v1.1 | OAuth 1.0a | App-Level |
| Subscribe Bot | `POST /2/account_activity/webhooks/{id}/subscriptions/all` | v2 | OAuth 1.0a | User-Level |
| Unsubscribe Bot | `DELETE /2/account_activity/webhooks/{id}/subscriptions/{userId}/all` | v2 | Bearer Token | App-Level |

### 2.3 Why Mixed API Versions?

**From code comments** (`/src/lib/twitter/webhooks.ts`, lines 16-24):

> v1.1 management (list/register/delete) returns 403 for this app — no TAAS v1.1 management access.
> v2 list + subscription endpoints WORK because the app originally registered the webhook via v2
> and subscription/unsubscription via v2 does not require the same "Project attachment" that
> v2 webhook REGISTRATION requires.

**Translation**: 
- The Twitter App has **v2 API access** but **NOT v1.1 management access**
- v2 subscription endpoints don't require Project attachment
- Existing webhook (ID: `1999190094972911617`) is the shared webhook for all bots

---

## 3. Critical Issue: Bearer Token Expiration

### 3.1 The Problem

**Bearer tokens issued via OAuth 2.0 do NOT expire by default**, but they can become invalid if:
1. The token was manually revoked in Twitter Developer Portal
2. The consumer key/secret were rotated
3. The token was invalidated due to security concerns
4. The Twitter App's OAuth 2.0 access was revoked

**Evidence of Recent Fixes**:

Commit `fc4de1b` (latest) - "feat: add bearer token refresh functionality for TwitterApps":
- Added `createBearerToken()` to generate new bearer tokens
- Added `/api/twitter-apps/[id]/refresh-token` endpoint
- **Comment**: "This solves the issue where projects couldn't connect bots due to expired/invalid bearer tokens"

### 3.2 Where Bearer Token Is Used

```typescript
// From /src/app/api/auth/bot-twitter/callback/route.ts (line 56)
const bearerToken = twitterApp.bearerToken;

// Used in listWebhooks() call (line 162)
const twitterWebhooks = await listWebhooks(bearerToken, webhookEnv);

// Used in subscribeWebhook() call (line 215)
await subscribeWebhook(
  apiKey,
  apiSecret,
  accessToken,
  accessSecret,
  webhookId,
  user.data.id,
  bearerToken,  // ← Passed here
  webhookEnv
);
```

### 3.3 Bearer Token Refresh Endpoint

**File**: `/src/app/api/twitter-apps/[id]/refresh-token/route.ts`

Creates a new bearer token and updates the TwitterApp:
```typescript
const newBearerToken = await createBearerToken(
  decryptedApp.consumerKey,
  decryptedApp.consumerSecret
);

await updateTwitterApp(id, {
  bearerToken: newBearerToken,
});
```

---

## 4. Recent Architecture Changes

### 4.1 Timeline of Refactoring

| Commit | Change | Impact |
|--------|--------|--------|
| `639201c` | Remove all Twitter env vars, use TwitterApp from DB | Centralized credential management |
| `6d75ee3` | Manual webhook registration & status display | User can force-register webhooks |
| `adba034` | Handle shared webhook subscription with TwitterApp | Bot connection uses TwitterApp creds |
| `feda34f` | Handle OAuth token mismatch for shared webhook | Fallback to env-var credentials |
| `fc4de1b` | Add bearer token refresh functionality | Fix expired bearer tokens |

### 4.2 Migration Impact

**Before** (Environment Variable Era):
```
OAuth Creds → Environment Variables → Webhook Registration
             (TWITTER_OAUTH_API_KEY, etc.)
```

**After** (TwitterApp Database Model):
```
OAuth Creds → TwitterApp Table (Encrypted) → Webhook Registration
```

**Risk**: If TwitterApp's bearer token becomes invalid, webhook registration fails for ALL projects using that app.

---

## 5. OAuth 1.0a vs OAuth 2.0 - Technical Details

### 5.1 OAuth 1.0a (User-Level)

**Used for**: Bot account authentication

**Flow**:
```
1. App generates temporary request token
2. User approves on Twitter
3. Twitter redirects with oauth_token + oauth_verifier
4. App exchanges for access_token + access_token_secret
5. App uses these tokens to act on behalf of the user
```

**Signature Method**: HMAC-SHA1
**Tokens Needed**: Consumer Key, Consumer Secret, Access Token, Access Token Secret

**Example OAuth Header**:
```
OAuth oauth_consumer_key="...",
      oauth_token="...",
      oauth_signature_method="HMAC-SHA1",
      oauth_timestamp="...",
      oauth_nonce="...",
      oauth_version="1.0",
      oauth_signature="..."
```

**Code Implementation** (`/src/lib/twitter/webhooks.ts`, lines 59-102):
```typescript
function generateOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken?: string,
  accessSecret?: string,
  additionalParams?: Record<string, string>
): string {
  // Generates OAuth 1.0a Authorization header with HMAC-SHA1 signature
}
```

### 5.2 OAuth 2.0 (App-Level Bearer Token)

**Used for**: Administrative operations

**Flow**:
```
1. App authenticates with Consumer Key + Consumer Secret
2. Twitter returns Bearer Token (access_token)
3. App uses Bearer Token in Authorization header
```

**Authentication**: HTTP Basic Auth (Base64 encoded Consumer Key:Secret)
**Token Type**: Bearer Token (does not expire by default)
**No Signature Required**: Just include `Authorization: Bearer {token}`

**Example Bearer Header**:
```
Authorization: Bearer AAAABBBBCCCCDDDD...
```

---

## 6. Current Flow Analysis - Bot Connection

### 6.1 Complete Flow Diagram

```
USER CLICKS "CONNECT BOT" IN DASHBOARD
  │
  ├─→ GET /api/projects/[id]/bot/authorize
      │
      ├─ Get TwitterApp from DB (with credentials)
      ├─ Initialize TwitterApi with Consumer Key/Secret
      ├─ Generate OAuth 1.0a auth link (OAuth 1.0a)
      ├─ Store temporary OAuth state in cookies
      └─ Redirect to Twitter login page

USER AUTHORIZES ON TWITTER
  │
  ├─→ GET /api/auth/bot-twitter/callback
      │
      ├─ Get oauth_token + oauth_verifier from URL
      ├─ Get oauth_token_secret from cookie
      │
      ├─→ EXCHANGE TEMPORARY TOKENS
      │   ├─ Use OAuth 1.0a to exchange for permanent bot tokens
      │   ├─ Bot now has: accessToken + accessTokenSecret
      │   └─ Save encrypted bot tokens to PostgreSQL
      │
      ├─→ REGISTER/FIND WEBHOOK
      │   ├─ Get TwitterApp from DB
      │   ├─ bearerToken = TwitterApp.bearerToken (OAuth 2.0)
      │   ├─ List webhooks: GET /2/webhooks (Bearer Token)
      │   │  └─ If not found: register new webhook
      │   └─ Update webhook registration in DB
      │
      ├─→ SUBSCRIBE BOT TO WEBHOOK
      │   ├─ Use bot's OAuth 1.0a tokens (accessToken, accessTokenSecret)
      │   ├─ Use TwitterApp Consumer Key/Secret
      │   ├─ Subscribe: POST /2/account_activity/webhooks/{id}/subscriptions/all
      │   └─ Update subscription status in DB
      │
      └─ Redirect to dashboard with success message
```

### 6.2 Failure Point Analysis

**If webhook registration fails**, the flow breaks at step 4:

**Possible Causes** (in order of likelihood):
1. **Bearer Token Invalid** (most likely)
   - TwitterApp.bearerToken is expired/revoked
   - Solution: Call `/api/twitter-apps/[id]/refresh-token` endpoint

2. **Consumer Key/Secret Invalid** (likely)
   - TwitterApp.consumerKey or consumerSecret wrong/rotated
   - Solution: Update TwitterApp with correct credentials

3. **Bearer Token Verification Failed** (possible)
   - `listWebhooks()` call fails due to invalid bearer token
   - Solution: Refresh bearer token

4. **Bot OAuth Token Mismatch** (handled with fallback)
   - Bot was connected with one TwitterApp, webhook with another
   - Solution: Force webhook subscription endpoint handles this

---

## 7. Fallback & Recovery Mechanisms

### 7.1 Force Webhook Subscription Endpoint

**File**: `/src/app/api/projects/[id]/force-webhook-subscription/route.ts`

**Purpose**: Fix webhook subscription issues when there's a token mismatch

**Flow**:
```typescript
if (isSharedWebhook) {
  // For shared webhook (ID: 1999190094972911617)
  // Try multiple subscription methods:
  
  1. OAuth 1.0a hybrid approach
     - Use env-var consumer credentials
     - Use bot's existing tokens
  
  2. Bearer token fallback
     - Try OAuth 2.0 bearer token subscription
  
  3. Success if either works or returns 409 (already subscribed)
}
```

### 7.2 Rollback on Failure

**From `/src/app/api/auth/bot-twitter/callback/route.ts` (lines 236-258)**:

If webhook registration fails:
```typescript
try {
  // ... webhook registration
} catch (webhookError: any) {
  // ROLLBACK: Delete the bot to maintain consistency
  await deleteBotByProjectId(project.id);
  throw new Error(`Webhook registration failed: ${webhookErrorMessage}`);
}
```

---

## 8. Recommendations

### 8.1 Immediate Actions

1. **Check Bearer Token Validity**
   ```bash
   # Call verification endpoint
   GET /api/twitter-apps/{appId}/verify-bearer
   ```

2. **If Bearer Token Invalid - Refresh It**
   ```bash
   # Endpoint to create new bearer token
   POST /api/twitter-apps/{appId}/refresh-token
   ```

3. **Verify Consumer Credentials**
   - Ensure `ConsumerKey` and `ConsumerSecret` match Twitter Developer Portal
   - Check if OAuth 1.0a is enabled for the app

4. **Enable Detailed Logging**
   - The code already has extensive logging
   - Check server logs for specific Twitter API error messages
   - Look for 401/403/404 responses from Twitter

### 8.2 Long-Term Improvements

1. **Automatic Bearer Token Refresh**
   - Implement token validation on bot connection start
   - Auto-refresh if invalid before attempting webhook registration

2. **Webhook Availability Monitoring**
   - Periodic health checks on webhook configuration
   - Alert if webhook becomes unregistered

3. **Credential Validation UI**
   - Add status indicators in dashboard showing:
     - Is bearer token valid?
     - Is webhook registered?
     - Is bot subscribed?
     - Last activity timestamp

4. **Better Error Messages**
   - Provide specific instructions when bearer token refresh needed
   - Show which credentials need updating

---

## 9. Key Code Files Summary

| File | Purpose | OAuth Version | Key Functions |
|------|---------|---------------|---------------|
| `/src/lib/twitter/webhooks.ts` | Webhook operations | OAuth 1.0a + Bearer | registerWebhook, subscribeWebhook, listWebhooks |
| `/src/lib/twitter/bearer-token.ts` | Bearer token management | OAuth 2.0 | createBearerToken, revokeBearerToken, verifyBearerToken |
| `/src/app/api/projects/[id]/bot/authorize/route.ts` | Bot OAuth flow start | OAuth 1.0a | Initiates OAuth 1.0a user login |
| `/src/app/api/auth/bot-twitter/callback/route.ts` | Bot OAuth completion | OAuth 1.0a | Exchanges temp tokens, registers webhook |
| `/src/lib/db/bots.ts` | Bot token encryption/storage | - | Encrypts OAuth 1.0a tokens in DB |
| `/src/lib/db/twitter-apps.ts` | TwitterApp CRUD | - | Manages encrypted Bearer tokens in DB |
| `/src/app/api/projects/[id]/force-webhook-subscription/route.ts` | Recovery mechanism | OAuth 1.0a + Bearer | Force subscribes bot with fallback methods |

---

## 10. Conclusion

The codebase implements a sophisticated dual-OAuth system:

1. **OAuth 1.0a** (User-Level): Bot authentication & webhook subscription
2. **OAuth 2.0** (App-Level): Bearer Token for administrative operations

**The primary reason webhook registration fails** is **invalid or expired Bearer Token** stored in the TwitterApp configuration. The recent refactoring centralized credentials in the database, making the system more flexible but dependent on token validity.

**Solution**: Regular bearer token validation and refresh, which has been implemented in the latest commit (`fc4de1b`).

