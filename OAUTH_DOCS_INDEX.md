# OAuth & Webhook Documentation Index

This directory contains comprehensive documentation about the OAuth and webhook implementation in the Bitso Twitter API project.

## Documents Overview

### 1. **OAuth_Webhook_Analysis.md** (Comprehensive)
**Length**: 16 KB | **Complexity**: Advanced | **Audience**: Developers

Complete technical analysis of the dual-OAuth architecture:
- OAuth 1.0a vs OAuth 2.0 detailed comparison
- Webhook registration flow analysis
- Why webhook registration fails (bearer token issues)
- Architecture changes and refactoring history
- Complete code flow diagrams
- Key file references

**When to read**: Need deep understanding of how OAuth works in this codebase

---

### 2. **OAUTH_QUICK_REFERENCE.md** (Quick Reference)
**Length**: 7.6 KB | **Complexity**: Intermediate | **Audience**: Developers

Quick lookup guide for OAuth implementation:
- TL;DR table of OAuth versions
- OAuth 1.0a vs OAuth 2.0 at a glance
- Bot connection flow (step-by-step)
- Token storage locations
- Troubleshooting quick reference
- Database schema relationships
- Bearer token refresh flow

**When to read**: Need quick answers or remind yourself of the implementation

---

### 3. **WEBHOOK_FAILURE_DIAGNOSIS.md** (Troubleshooting)
**Length**: 8.2 KB | **Complexity**: Intermediate | **Audience**: Support/Developers

Practical troubleshooting guide for when things break:
- Quick diagnosis checklist
- Bearer token invalidation scenarios
- Step-by-step debugging process
- API endpoints for testing
- Common error messages and solutions
- Testing verification steps
- Prevention and monitoring best practices
- When to escalate to Twitter Support

**When to read**: A bot connection is failing and you need to fix it NOW

---

## OAuth Implementation Summary

### The Dual-OAuth Architecture

This project uses **two different OAuth versions** for different purposes:

```
OAuth 1.0a (User-Level)           OAuth 2.0 (App-Level)
│                                  │
├─ Bot Account Authentication      ├─ Bearer Token for Admin Ops
├─ Webhook Subscription            ├─ List Webhooks
├─ Tweet Publishing                └─ Manage Bearer Tokens
└─ Uses: 4 tokens
   (Consumer Key/Secret + User Token/Secret)
                                    └─ Uses: 1 token
                                       (Bearer Token only)
```

### Key Insight: Why Webhooks Fail

The most common cause of webhook registration failure is an **invalid or expired Bearer Token** stored in the `TwitterApp.bearerToken` field.

**Solution**: Call `POST /api/twitter-apps/{appId}/refresh-token` to generate a new bearer token.

---

## Quick Navigation

### I need to...

**Understand how OAuth works in this project**
→ Read: `OAuth_Webhook_Analysis.md` (full deep-dive)
→ Or: `OAUTH_QUICK_REFERENCE.md` (quick overview)

**Fix a webhook registration failure**
→ Read: `WEBHOOK_FAILURE_DIAGNOSIS.md`
→ Quick steps:
  1. Check if bearer token is invalid (401 error)
  2. If yes: `POST /api/twitter-apps/{appId}/refresh-token`
  3. Retry bot connection

**Understand the database schema**
→ See: `OAUTH_QUICK_REFERENCE.md` → "Database Schema Relationships"
→ Or: `prisma/schema.prisma` (actual schema file)

**Debug an OAuth error**
→ Read: `WEBHOOK_FAILURE_DIAGNOSIS.md` → "Common Error Messages & Solutions"
→ Check logs for specific error codes

**Implement a new OAuth feature**
→ Read: `OAuth_Webhook_Analysis.md` → "Current Flow Analysis"
→ Study the relevant files:
  - `/src/lib/twitter/webhooks.ts` (webhook operations)
  - `/src/lib/twitter/bearer-token.ts` (bearer token management)
  - `/src/app/api/auth/bot-twitter/callback/route.ts` (OAuth flow)

**Monitor OAuth health**
→ Read: `WEBHOOK_FAILURE_DIAGNOSIS.md` → "Prevention & Monitoring"
→ Run SQL queries to find issues

---

## File Reference Map

### Core OAuth Implementation Files

| File | Purpose | OAuth Version | Key Functions |
|------|---------|---------------|---------------|
| `/src/lib/twitter/webhooks.ts` | Webhook operations | 1.0a + 2.0 | registerWebhook, subscribeWebhook, listWebhooks |
| `/src/lib/twitter/bearer-token.ts` | Bearer token mgmt | 2.0 | createBearerToken, revokeBearerToken, verifyBearerToken |
| `/src/app/api/projects/[id]/bot/authorize/route.ts` | OAuth start | 1.0a | Initiates OAuth 1.0a user login flow |
| `/src/app/api/auth/bot-twitter/callback/route.ts` | OAuth callback | 1.0a | Exchanges temp tokens, registers webhook, subscribes bot |
| `/src/lib/db/bots.ts` | Bot token storage | - | Encrypts and stores OAuth 1.0a user tokens |
| `/src/lib/db/twitter-apps.ts` | TwitterApp CRUD | - | Manages encrypted Bearer tokens and Consumer credentials |
| `/src/app/api/projects/[id]/force-webhook-subscription/route.ts` | Recovery | 1.0a + 2.0 | Force-subscribes bot with fallback methods |

### Database Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema definition (TwitterApp, Bot, WebhookRegistration models) |

---

## Common Workflows

### Workflow 1: Connecting a New Bot

```
1. User clicks "Connect Bot" in Dashboard
   GET /api/projects/{id}/bot/authorize
   
2. OAuth 1.0a flow:
   → Redirect to Twitter login
   → User authorizes app
   → Twitter redirects with temporary tokens
   
3. Callback completes the flow:
   GET /api/auth/bot-twitter/callback
   → Exchange temp tokens for permanent bot tokens
   → Save encrypted bot tokens to database (OAuth 1.0a)
   
4. Webhook registration:
   → List webhooks using Bearer Token (OAuth 2.0)
   → Register webhook if needed (OAuth 1.0a)
   → Subscribe bot to webhook (OAuth 1.0a)
   
5. Success:
   ✅ Bot account connected
   ✅ Webhook registered
   ✅ Bot subscribed to events
```

**If this fails**: See `WEBHOOK_FAILURE_DIAGNOSIS.md`

### Workflow 2: Refreshing Bearer Token

```
1. Admin notices webhook registrations failing
2. Check TwitterApp status
3. Call: POST /api/twitter-apps/{appId}/refresh-token
4. Endpoint:
   → Gets Consumer Key/Secret from TwitterApp
   → Creates new Bearer Token via Twitter OAuth 2.0
   → Updates TwitterApp.bearerToken in database
5. Next bot connection uses new token
   → All webhook operations succeed
```

### Workflow 3: Updating TwitterApp Credentials

```
1. Twitter rotates Consumer Key/Secret
2. Update TwitterApp via admin dashboard or API:
   PUT /api/twitter-apps/{appId}
   {
     consumerKey: "new_key",
     consumerSecret: "new_secret"
   }
3. Refresh Bearer Token:
   POST /api/twitter-apps/{appId}/refresh-token
4. Done: All bots using this TwitterApp can now connect
```

---

## Key Concepts

### OAuth 1.0a
- **User-Level**: Acts on behalf of a specific user
- **4 Tokens**: Consumer Key, Consumer Secret, Access Token, Access Token Secret
- **Signature Required**: HMAC-SHA1 signing of all requests
- **Used For**: Bot authentication, webhook subscription
- **Storage**: Encrypted in `Bot` table

### OAuth 2.0 Bearer Token
- **App-Level**: Administrative operations
- **1 Token**: Bearer Token
- **No Signature**: Just `Authorization: Bearer {token}`
- **Used For**: Listing webhooks, managing bearer tokens
- **Storage**: Encrypted in `TwitterApp` table

### Webhook Registration
- **Process**: 3 steps (list → register → subscribe)
- **Uses Both OAuth Versions**: v2 Bearer Token + v1.0a user tokens
- **Mixed APIs**: v2 for list/subscribe, v1.1 for register
- **Single Shared Webhook**: All bots subscribe to ID `1999190094972911617`

---

## Troubleshooting Decision Tree

```
Bot connection fails
│
├─ Error: "Failed to list webhooks: 401"
│  └─ Bearer Token invalid
│     └─ POST /api/twitter-apps/{appId}/refresh-token
│
├─ Error: "Failed to create bearer token: 401"
│  └─ Consumer Key/Secret invalid
│     └─ Update TwitterApp credentials + refresh token
│
├─ Error: "oauth_signature_mismatch"
│  └─ Consumer Key/Secret or bot tokens invalid
│     └─ Disconnect bot + fix credentials + reconnect
│
└─ Error: "DuplicateSubscription" or "Already subscribed"
   └─ Bot already subscribed (OK)
      └─ Check database status (should show subscribed: true)
```

---

## API Endpoints

### OAuth & Webhook Endpoints

```
Bot Authorization:
  GET /api/projects/{id}/bot/authorize ← Start OAuth
  GET /api/auth/bot-twitter/callback ← OAuth callback

Webhook Management:
  GET /api/projects/{id}/webhooks
  POST /api/projects/{id}/register-webhook
  POST /api/projects/{id}/force-webhook-subscription

TwitterApp Management:
  GET /api/twitter-apps
  POST /api/twitter-apps
  POST /api/twitter-apps/{id}/refresh-token ← CRITICAL
```

---

## Dependencies

### Libraries
- `twitter-api-v2`: OAuth 1.0a client library
- `crypto`: Node.js crypto for HMAC-SHA1 signing
- `@prisma/client`: Database ORM

### External Services
- Twitter API v1.1: Account Activity API (webhook registration)
- Twitter API v2: Webhooks, subscriptions, user info
- Twitter OAuth 2.0 Token Endpoint: Bearer token creation

---

## Contact & Support

For issues or questions:
1. Check the relevant documentation above
2. Search server logs for error codes
3. Review `WEBHOOK_FAILURE_DIAGNOSIS.md` for common solutions
4. If issue persists, contact Twitter Developer Support

---

**Last Updated**: 2026-02-21
**Maintained By**: Development Team
**Version**: 1.0
