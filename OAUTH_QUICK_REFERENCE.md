# OAuth & Webhook Registration - Quick Reference

## TL;DR - OAuth Versions in This Project

| Component | OAuth Version | Purpose | Token Type |
|-----------|---------------|---------|-----------|
| Bot Connection | OAuth 1.0a | User authenticates bot account | Consumer + User Tokens |
| Webhook Registration | OAuth 1.0a + OAuth 2.0 | List/register webhooks | Consumer Tokens + Bearer |
| Webhook Subscription | OAuth 1.0a | Bot subscribes to webhook | User Tokens |
| Admin Operations | OAuth 2.0 | Bearer token for app-level ops | Bearer Token Only |

---

## OAuth 1.0a vs OAuth 2.0

### OAuth 1.0a (User-Level)
```
FOR: Authenticating users and acting on their behalf
USED IN: Bot connections, webhook subscriptions
TOKENS: 4 pieces needed:
  - Consumer Key (from Twitter App)
  - Consumer Secret (from Twitter App)
  - Access Token (user-specific)
  - Access Token Secret (user-specific)

SIGNATURE: Required
  - HMAC-SHA1 signing of requests
  - Signature includes all request parameters

EXAMPLE: Connecting a bot account
  GET /api/projects/{id}/bot/authorize
  → Twitter OAuth 1.0a login
  → User clicks "Authorize"
  → GET /api/auth/bot-twitter/callback?oauth_token=...&oauth_verifier=...
  → Exchange for permanent bot tokens
  → Save to database
```

### OAuth 2.0 (App-Level Bearer Token)
```
FOR: App-level administrative operations
USED IN: Listing webhooks, managing bearer tokens
TOKENS: 1 piece needed:
  - Bearer Token (generated from Consumer Key + Secret)

SIGNATURE: Not needed
  - Just include: Authorization: Bearer {token}
  - No signing involved

EXAMPLE: Listing webhooks during bot connection
  GET /2/webhooks
  Header: Authorization: Bearer AAAABBBBCCCCDDDD...
  → Returns list of webhooks
```

---

## Bot Connection Flow - Step by Step

```
1. USER INITIATES BOT CONNECTION
   GET /api/projects/{projectId}/bot/authorize
   ↓
   [Loads TwitterApp from database]
   [Gets Consumer Key + Secret]
   
2. OAUTH 1.0a LOGIN FLOW
   ├─ Initialize TwitterApi with Consumer Key/Secret
   ├─ Generate auth link
   ├─ Redirect to Twitter login
   └─ User authorizes app
   
3. TWITTER CALLBACK
   GET /api/auth/bot-twitter/callback?oauth_token=...&oauth_verifier=...
   ↓
   [Get temporary tokens from cookies]
   [Exchange for permanent bot tokens]
   
4. SAVE BOT TOKENS
   ├─ Store: accessToken (encrypted)
   ├─ Store: accessTokenSecret (encrypted)
   └─ Save to Bot table in PostgreSQL
   
5. WEBHOOK DISCOVERY/REGISTRATION
   GET /2/webhooks (Using Bearer Token ← OAuth 2.0)
   ├─ If exists: Use existing webhook ID
   └─ If not: Register new webhook (OAuth 1.0a)
   
6. WEBHOOK SUBSCRIPTION
   POST /2/account_activity/webhooks/{id}/subscriptions/all
   ├─ Using: Bot's OAuth 1.0a tokens
   ├─ Consumer: From TwitterApp
   └─ User tokens: Just obtained from bot auth
   
7. SUCCESS
   ✅ Bot connected
   ✅ Webhook registered
   ✅ Bot subscribed to receive events
```

---

## Where Are OAuth Credentials Stored?

### Bot OAuth 1.0a Tokens
```
Table: Bot
Columns: accessToken (encrypted), accessTokenSecret (encrypted)
Storage: PostgreSQL
Encryption: AES-256-GCM
Scope: Per-bot (one bot per project)
File: /src/lib/db/bots.ts
```

### TwitterApp Credentials
```
Table: TwitterApp
Columns:
  - consumerKey (encrypted) ← OAuth 1.0a
  - consumerSecret (encrypted) ← OAuth 1.0a
  - bearerToken (encrypted) ← OAuth 2.0
  - webhookEnv: "production" or custom
Storage: PostgreSQL
Encryption: AES-256-GCM
Scope: Shared by multiple projects
File: /src/lib/db/twitter-apps.ts
```

---

## Why Webhook Registration Fails - Troubleshooting

### Problem: Bearer Token Invalid
```
What happens:
  listWebhooks(bearerToken) fails
  → Cannot determine if webhook exists
  → Cannot continue registration

Evidence: 401 or 403 error from Twitter API

Solution:
  1. POST /api/twitter-apps/{appId}/refresh-token
  2. Creates new bearer token
  3. Updates TwitterApp in database
  4. Retry bot connection
```

### Problem: Consumer Key/Secret Invalid
```
What happens:
  OAuth 1.0a flow fails at signature generation
  → Cannot authenticate with Twitter

Evidence: 401 error, signature verification failed

Solution:
  1. Update TwitterApp with correct Consumer Key/Secret
  2. Verify in Twitter Developer Portal
  3. Retry bot connection
```

### Problem: Bot Already Subscribed
```
What happens:
  subscribeWebhook() returns 409 Conflict
  → Bot is already subscribed

Evidence: 409 status code

Solution:
  - This is actually OK - treated as success
  - Bot already receiving events
  - Check webhook registration status in database
```

---

## Key API Endpoints for OAuth/Webhooks

### Bot Authorization (OAuth 1.0a)
```
GET /api/projects/{id}/bot/authorize
  → Initiates OAuth 1.0a flow
  → Redirects to Twitter login

GET /api/auth/bot-twitter/callback
  → Callback from Twitter
  → Exchanges tokens
  → Registers webhook
  → Subscribes bot
```

### Webhook Management
```
GET /api/projects/{id}/webhooks
  → List webhooks for project

POST /api/projects/{id}/register-webhook
  → Manually register webhook

POST /api/projects/{id}/force-webhook-subscription
  → Force subscribe bot if mismatch
  → Multiple fallback methods
```

### TwitterApp Management
```
GET /api/twitter-apps
  → List all Twitter Apps

POST /api/twitter-apps
  → Create new Twitter App

POST /api/twitter-apps/{id}/refresh-token
  → Refresh bearer token ← CRITICAL FOR FAILURES
```

---

## OAuth 1.0a Signature Generation (Technical)

The code manually generates HMAC-SHA1 signatures for OAuth 1.0a requests:

```typescript
// From /src/lib/twitter/webhooks.ts

function generateOAuthSignature(
  method: string,              // "POST", "DELETE", etc.
  url: string,                 // API endpoint URL
  params: Record<string, string>,  // ALL request parameters
  consumerSecret: string,      // From TwitterApp
  tokenSecret?: string         // From Bot (if user-level)
): string {
  // 1. Sort parameters alphabetically
  // 2. Create signature base string:
  //    METHOD&URL&PARAMS
  // 3. Create signing key:
  //    consumerSecret&tokenSecret (or just consumerSecret&)
  // 4. Generate HMAC-SHA1(base_string, signing_key)
  // 5. Return as base64
}
```

This is why we need BOTH:
- Consumer Secret (app-level)
- Token Secret (user-level) - for bot auth

---

## Database Schema Relationships

```
TwitterApp (Shared credentials)
  ├── consumerKey (encrypted)
  ├── consumerSecret (encrypted)
  ├── bearerToken (encrypted) ← OAuth 2.0
  └── webhookEnv

Project
  ├── twitterAppId (references TwitterApp)
  ├── Bot (one-to-one)
  │   ├── accessToken (encrypted) ← OAuth 1.0a user token
  │   └── accessTokenSecret (encrypted) ← OAuth 1.0a user token
  └── WebhookRegistration (one-to-many)
      ├── webhookId
      ├── url
      └── subscribed (boolean)
```

---

## Bearer Token Refresh Flow

When Bearer Token is invalid or expires:

```
1. Call: POST /api/twitter-apps/{appId}/refresh-token
   
2. Endpoint creates new bearer token:
   - Gets Consumer Key/Secret from TwitterApp
   - Calls Twitter OAuth 2.0 endpoint
   - Twitter returns new Bearer Token
   
3. Update database:
   - TwitterApp.bearerToken = newBearerToken
   
4. Next bot connection uses new token:
   - listWebhooks() succeeds
   - Webhook registration can proceed
   - Bot subscription succeeds
```

---

## References

- OAuth 1.0a Spec: https://oauth.net/core/1.0a/
- OAuth 2.0 Spec: https://oauth.net/2/
- Twitter API OAuth: https://developer.twitter.com/en/docs/authentication/oauth-1-0a
- Twitter Account Activity API: https://developer.twitter.com/en/docs/twitter-api/enterprise/account-activity-api/

---

Last Updated: 2026-02-21
