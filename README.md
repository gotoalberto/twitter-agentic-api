# X Forwarder

Twitter webhook forwarder application. This app registers with Twitter's Account Activity API and forwards all webhook events to a configured endpoint, allowing you to receive Twitter webhooks even if your main application can't be registered directly with Twitter.

## What does it do?

**X Forwarder** acts as a transparent proxy between Twitter and your application:

1. **Registers a webhook with Twitter** using Twitter API v2
2. **Subscribes a bot account** to receive webhook events via OAuth 1.0a
3. **Forwards all events** to your configured endpoint in real-time
4. **Handles CRC validation** by proxying to your endpoint

This is useful when:
- Twitter's webhook limit is reached (1 webhook per app)
- You need to receive webhooks at a different URL
- You want to multiplex webhooks to multiple endpoints
- Your main app can't directly register with Twitter

## Architecture

```
┌─────────┐         ┌────────────────┐         ┌──────────────┐
│ Twitter │────────▶│  X Forwarder   │────────▶│ Your App     │
│   API   │         │  (This App)    │         │ (goodboy)    │
└─────────┘         └────────────────┘         └──────────────┘
    │                      │                          │
    │  1. CRC Check        │                          │
    ├─────────────────────▶│  Forward CRC            │
    │                      ├─────────────────────────▶│
    │                      │◀─────────────────────────┤
    │◀─────────────────────┤  Return response         │
    │                      │                          │
    │  2. Webhook Event    │                          │
    ├─────────────────────▶│  Forward event + headers │
    │                      ├─────────────────────────▶│
    │                      │◀─────────────────────────┤
    │◀─────────────────────┤  Return response         │
```

## How it works

### 1. Bot Connection & Webhook Registration

When you connect a bot and save a forwarding endpoint:

```typescript
// 1. User connects bot via OAuth 1.0a
POST /api/auth/bot-twitter/authorize
  ↓
// 2. Bot credentials encrypted and stored in Redis
// 3. User configures forwarding endpoint in dashboard
POST /api/config/forwarding
  {
    "endpoint": "https://goodboy.pepesdog.box/api/webhooks/twitter",
    "enabled": true
  }
  ↓
// 4. Webhook registered with Twitter
POST https://api.twitter.com/2/webhooks
  {
    "url": "https://bitso-twitter-api.vercel.app/api/webhooks/twitter"
  }
  ↓
// 5. Bot subscribed to webhook
POST https://api.twitter.com/2/account_activity/webhooks/{webhookId}/subscriptions/all
  (OAuth 1.0a signature with bot credentials)
  ↓
// 6. Twitter validates webhook via CRC
GET https://bitso-twitter-api.vercel.app/api/webhooks/twitter?crc_token=XXX
  ↓
// 7. X Forwarder forwards CRC to configured endpoint
GET https://goodboy.pepesdog.box/api/webhooks/twitter?crc_token=XXX
  ↓
// 8. Response returned to Twitter
{ "response_token": "sha256=..." }
```

### 2. Event Forwarding

When Twitter sends a webhook event:

```typescript
// 1. Twitter sends event to X Forwarder
POST https://bitso-twitter-api.vercel.app/api/webhooks/twitter
Headers:
  Content-Type: application/json
  x-twitter-webhooks-signature: sha256=ABC123...
Body:
  {
    "tweet_create_events": [...],
    "for_user_id": "123456"
  }
  ↓
// 2. X Forwarder forwards to configured endpoint with ALL headers
POST https://goodboy.pepesdog.box/api/webhooks/twitter
Headers:
  Content-Type: application/json
  x-twitter-webhooks-signature: sha256=ABC123...  // Preserved!
  X-Forwarded-From: x-forwarder
Body:
  {
    "tweet_create_events": [...],  // Exact same payload
    "for_user_id": "123456"
  }
  ↓
// 3. Your app validates signature and processes event
// 4. Response returned to Twitter via X Forwarder
{ "success": true }
```

## Features

- 🔐 Admin authentication with Twitter OAuth 2.0
- 🤖 Bot connection via Twitter OAuth 1.0a
- 📡 Real-time webhook forwarding with header preservation
- 🔄 CRC validation proxying
- 💾 Secure credential storage in Redis (Upstash)
- 🔒 AES-256-GCM encryption for OAuth tokens
- 📝 Detailed logging of all forwarding operations
- ⚡ Automatic webhook subscription/unsubscription
- 🎯 Configurable forwarding endpoint via dashboard

## Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Authentication:** NextAuth.js v4
- **Database:** Redis (Upstash)
- **Twitter API:** API v2 (webhooks, subscriptions)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Prerequisites

- Node.js 20+
- npm or yarn
- Twitter Developer Account with:
  - OAuth 2.0 credentials (for admin login)
  - OAuth 1.0a credentials (for bot connection)
  - Bearer Token (for webhook registration)
  - Account Activity API access (required for webhooks)
- Upstash Redis account
- Target application with webhook endpoint

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/gotoalberto/bitso-twitter-api.git
   cd bitso-twitter-api
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and fill in all required variables. See [Environment Variables](#environment-variables) section.

4. **Generate secrets:**
   ```bash
   # Generate NEXTAUTH_SECRET
   openssl rand -base64 32

   # Generate ENCRYPTION_KEY
   openssl rand -base64 32
   ```

## Environment Variables

See `.env.example` for all required variables. Key variables include:

### Required

- `NEXTAUTH_URL` - Your app URL (e.g., `https://bitso-twitter-api.vercel.app`)
- `NEXTAUTH_SECRET` - NextAuth encryption secret
- `NEXT_PUBLIC_APP_URL` - Public app URL (same as NEXTAUTH_URL)
- `UPSTASH_REDIS_REST_URL` - Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` - Redis authentication token
- `ENCRYPTION_KEY` - Key for encrypting bot tokens (AES-256-GCM)
- `X_API_CLIENT_ID` - Twitter OAuth 2.0 client ID (for admin login)
- `X_API_CLIENT_SECRET` - Twitter OAuth 2.0 client secret
- `TWITTER_OAUTH_API_KEY` - Twitter OAuth 1.0a consumer key (for bot & webhooks)
- `TWITTER_OAUTH_API_SECRET` - Twitter OAuth 1.0a consumer secret (for CRC validation)
- `X_API_BEARER_TOKEN` - Twitter Bearer token (for webhook registration)
- `ALLOWED_ADMIN_USERS` - Comma-separated list of admin usernames (e.g., `"user1,user2"`)
- `BOT_TWITTER_HANDLE` - Bot's Twitter handle (without @)
- `TWITTER_WEBHOOK_ENV` - Webhook environment name (e.g., `"production"`)

### Important Notes

- **DO NOT use `echo` to set env vars in Vercel** - it adds literal `\n` characters
- **Always use `printf '%s' 'value'`** when piping to `vercel env add`
- All credentials must be from the **same Twitter app**
- The Twitter app must have **Account Activity API** access enabled

## Usage

### 1. Admin Login

1. Navigate to `/` (home page)
2. Click "Sign in with Twitter"
3. Authorize with your admin Twitter account
4. You'll be redirected to `/dashboard`

### 2. Connect Bot

1. In the dashboard, under "Bot Connection", click "Connect Bot"
2. Authorize the bot Twitter account via OAuth 1.0a
3. Bot credentials will be encrypted and stored in Redis
4. Bot status will show as "Connected"

### 3. Configure Forwarding Endpoint

1. In the dashboard, under "Webhook Forwarding Configuration"
2. Enter your target webhook URL (e.g., `https://goodboy.pepesdog.box/api/webhooks/twitter`)
3. Enable forwarding with the toggle
4. Click "Save Configuration"
5. The app will automatically:
   - Register a webhook with Twitter (API v2)
   - Subscribe the bot to the webhook (OAuth 1.0a)
   - Store the webhook registration in Redis
   - Twitter will validate via CRC (forwarded to your endpoint)

### 4. Monitor Forwarding

All webhook events will now be forwarded to your configured endpoint:

```bash
# View logs in Vercel
vercel logs bitso-twitter-api.vercel.app --production

# Or check logs in real-time
vercel logs bitso-twitter-api.vercel.app --production --follow
```

### Example Log Output

```
================================================================================
📨 WEBHOOK EVENT RECEIVED
================================================================================
   Timestamp: 2025-12-11T10:30:00.000Z
   Event keys: tweet_create_events

🔄 FORWARDING WEBHOOK TO TARGET ENDPOINT
────────────────────────────────────────────────────────────────────────────────
   Target URL: https://goodboy.pepesdog.box/api/webhooks/twitter
   Method: POST
   Headers:
     Content-Type: application/json
     X-Forwarded-From: x-forwarder
     x-twitter-webhooks-signature: sha256=ABC123...

   Payload (RAW):
   {
     "tweet_create_events": [{
       "id_str": "1234567890",
       "text": "@bot_handle Hello!",
       "user": { "screen_name": "user_handle" }
     }]
   }

   Response Status: 200 OK
   Response Time: 123ms
   Success: ✅ YES
────────────────────────────────────────────────────────────────────────────────
```

## API Routes

### Authentication

- `GET /api/auth/[...nextauth]` - NextAuth routes (OAuth 2.0 for admin)
- `GET /api/auth/bot-twitter/authorize` - Initiate bot OAuth 1.0a flow
- `GET /api/auth/bot-twitter/callback` - Bot OAuth callback handler
- `GET /api/auth/bot-twitter/status` - Get bot connection status
- `POST /api/auth/bot-twitter/disconnect` - Disconnect bot and cleanup webhook

### Configuration

- `GET /api/config/forwarding` - Get current forwarding configuration
- `POST /api/config/forwarding` - Save forwarding configuration (registers webhook)
- `DELETE /api/config/forwarding` - Delete forwarding configuration (unsubscribes & deletes webhook)

### Webhooks

- `GET /api/webhooks/twitter?crc_token=XXX` - CRC validation (proxied to target endpoint)
- `POST /api/webhooks/twitter` - Receive and forward webhook events

## Webhook Flow

### Registration Flow (when saving forwarding config)

```typescript
1. User saves forwarding endpoint in dashboard
   ↓
2. POST /api/config/forwarding
   ↓
3. Check if webhook already exists
   ↓
4. If endpoint changed: delete old webhook
   ↓
5. Register new webhook with Twitter (API v2)
   POST https://api.twitter.com/2/webhooks
   ↓
6. Subscribe bot to webhook (OAuth 1.0a)
   POST https://api.twitter.com/2/account_activity/webhooks/{id}/subscriptions/all
   ↓
7. Save webhook registration to Redis
   {
     webhookId: "123456",
     url: "https://bitso-twitter-api.vercel.app/api/webhooks/twitter",
     botUserId: "789",
     botUsername: "bot_handle",
     subscribed: true,
     registeredAt: "2025-12-11T10:00:00.000Z"
   }
   ↓
8. Twitter validates via CRC (forwarded to your endpoint)
```

### Unsubscription Flow (when disconnecting bot or deleting config)

```typescript
1. User clicks "Disconnect Bot" or deletes forwarding config
   ↓
2. POST /api/auth/bot-twitter/disconnect
   or
   DELETE /api/config/forwarding
   ↓
3. Unsubscribe bot from webhook (OAuth 1.0a)
   DELETE https://api.twitter.com/2/account_activity/webhooks/{id}/subscriptions/all
   ↓
4. Delete webhook from Twitter (Bearer Token)
   DELETE https://api.twitter.com/2/webhooks/{id}
   ↓
5. Delete webhook registration from Redis
   ↓
6. Delete bot credentials from Redis (if disconnecting)
```

## Project Structure

```
bitso-twitter-api/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/      # NextAuth OAuth 2.0 handler
│   │   │   │   └── bot-twitter/        # Bot OAuth 1.0a endpoints
│   │   │   │       ├── authorize/      # Start OAuth flow
│   │   │   │       ├── callback/       # OAuth callback (saves bot)
│   │   │   │       ├── disconnect/     # Disconnect bot (cleanup webhook)
│   │   │   │       └── status/         # Get bot status
│   │   │   ├── config/
│   │   │   │   └── forwarding/         # Forwarding config CRUD
│   │   │   │       └── route.ts        # GET/POST/DELETE handlers
│   │   │   └── webhooks/
│   │   │       └── twitter/            # Webhook endpoint
│   │   │           └── route.ts        # GET (CRC) / POST (events)
│   │   ├── dashboard/                  # Dashboard UI
│   │   │   └── page.tsx                # Bot & forwarding config
│   │   ├── page.tsx                    # Login page
│   │   ├── layout.tsx                  # Root layout
│   │   ├── globals.css                 # Global styles
│   │   └── providers.tsx               # NextAuth SessionProvider
│   ├── lib/
│   │   ├── auth/
│   │   │   └── config.ts               # NextAuth configuration
│   │   ├── db/
│   │   │   └── redis.ts                # Upstash Redis client
│   │   ├── twitter/
│   │   │   ├── bot.ts                  # Bot OAuth operations
│   │   │   ├── config.ts               # Forwarding config operations
│   │   │   ├── webhooks.ts             # Webhook registration/subscription
│   │   │   └── webhook-storage.ts      # Webhook registration storage
│   │   └── utils/
│   │       ├── admin.ts                # Admin whitelist validation
│   │       ├── encryption.ts           # AES-256-GCM token encryption
│   │       └── env.ts                  # Environment helpers
│   └── types/
│       ├── bot.ts                      # Bot credential types
│       └── next-auth.d.ts              # NextAuth type extensions
├── .env.example                        # Environment template
├── .gitignore                          # Git ignore rules
├── .husky/
│   └── pre-commit                      # Prevent committing secrets
├── .github/
│   └── workflows/
│       └── security-scan.yml           # Secret scanning
├── package.json                        # Dependencies
├── next.config.js                      # Next.js config
├── tailwind.config.ts                  # Tailwind config
├── tsconfig.json                       # TypeScript config
├── vercel.json                         # Vercel config
└── README.md                           # This file
```

## Redis Data Structure

### Bot Credentials

```typescript
Key: "bot:connected"
Value: {
  userId: "123456789",
  username: "bot_handle",
  accessToken: "encrypted_token",  // AES-256-GCM encrypted
  accessTokenSecret: "encrypted_secret",
  iv: "base64_iv",
  authTag: "base64_tag"
}
```

### Forwarding Configuration

```typescript
Key: "config:forwarding"
Value: {
  endpoint: "https://goodboy.pepesdog.box/api/webhooks/twitter",
  enabled: true,
  updatedAt: "2025-12-11T10:00:00.000Z"
}
```

### Webhook Registration

```typescript
Key: "webhook:registration"
Value: {
  webhookId: "1234567890",
  url: "https://bitso-twitter-api.vercel.app/api/webhooks/twitter",
  botUserId: "123456789",
  botUsername: "bot_handle",
  subscribed: true,
  registeredAt: "2025-12-11T10:00:00.000Z",
  lastCrcCheck: "2025-12-11T10:05:00.000Z"
}
```

## Security

### Encryption

- Bot OAuth tokens are encrypted with **AES-256-GCM** before storing in Redis
- Encryption key is stored in `ENCRYPTION_KEY` environment variable
- Each encryption generates a unique IV (initialization vector) and auth tag
- Tokens are decrypted only when needed for API calls

### Admin Access

- Only whitelisted Twitter accounts can access the dashboard
- Whitelist is configured via `ALLOWED_ADMIN_USERS` environment variable
- Session-based authentication with NextAuth.js
- CSRF protection enabled

### Webhook Security

- Twitter signatures (`x-twitter-webhooks-signature`) are preserved when forwarding
- Your endpoint can validate requests came from Twitter
- CRC validation ensures webhook ownership
- HTTPS required for all webhook URLs

### Secrets Protection

- Pre-commit hooks prevent committing secrets
- GitHub Actions scan for leaked credentials
- All sensitive files are in `.gitignore`
- Redis credentials use environment variables only

## Deployment

### Vercel Deployment

1. **Configure environment variables in Vercel:**
   ```bash
   # IMPORTANT: Use printf, not echo (echo adds literal \n)

   # Example:
   printf '%s' 'your_value_here' | vercel env add NEXTAUTH_SECRET production
   printf '%s' 'https://bitso-twitter-api.vercel.app' | vercel env add NEXTAUTH_URL production

   # Add all required variables listed in "Environment Variables" section
   ```

2. **Deploy:**
   ```bash
   npm run build
   vercel deploy --prod
   ```

3. **Verify deployment:**
   ```bash
   vercel logs bitso-twitter-api.vercel.app --production
   ```

### Post-Deployment Checklist

- [ ] All environment variables configured
- [ ] `NEXTAUTH_URL` matches production URL
- [ ] `NEXT_PUBLIC_APP_URL` matches production URL
- [ ] Admin login works
- [ ] Bot connection works
- [ ] Forwarding endpoint configured
- [ ] CRC validation passes
- [ ] Webhook events are forwarded correctly
- [ ] Check logs for errors

## Troubleshooting

### Bot won't connect

- **Check OAuth 1.0a credentials** are correct and from same app
- **Verify callback URL** matches `NEXTAUTH_URL + /api/auth/bot-twitter/callback`
- **Enable cookies** in browser
- **Check Redis connection** - credentials may fail to save
- **Review logs** for OAuth errors

### Webhook registration fails

- **Verify Bearer Token** is correct and has webhook permissions
- **Check Twitter app** has Account Activity API access enabled
- **Ensure bot is connected** before saving forwarding config
- **Check webhook limit** - Twitter allows 1 webhook per app (delete old ones)
- **Review logs** for API errors (401, 403, etc.)

### CRC validation fails

- **Verify `TWITTER_OAUTH_API_SECRET`** matches the app credentials
- **Check forwarding endpoint** is accessible from internet
- **Ensure target endpoint** responds to CRC correctly
- **Review logs** for CRC forwarding errors

### Events not forwarding

- **Check forwarding is enabled** in dashboard
- **Verify endpoint URL** is correct and accessible
- **Check bot is subscribed** to webhook
- **Ensure target endpoint** returns 200 OK quickly (< 3s)
- **Review logs** for forwarding errors

### Redis connection issues

- **Verify Redis credentials** are correct
- **Check Redis instance** is active and not rate-limited
- **Test with Redis CLI** or Upstash console
- **Check network connectivity** from Vercel to Upstash

### Encryption errors

- **Verify `ENCRYPTION_KEY`** is set and 32 bytes (base64)
- **Don't change encryption key** after storing bot credentials
- **Reconnect bot** if encryption key changes
- **Check IV and authTag** are stored correctly

### Vercel deployment issues

- **Use `printf` not `echo`** when setting env vars (echo adds `\n`)
- **Verify all env vars** are set for production environment
- **Check build logs** for compilation errors
- **Ensure Node.js 20+** is used

## Known Limitations

- **1 webhook per Twitter app** - Twitter's limit, not this app's
- **Bot must stay connected** - disconnecting removes webhook
- **CRC checks every 24h** - Twitter requires this, handled automatically
- **3 second timeout** - Twitter requires webhook response < 3s

## Contributing

This is a private project. Contact @gotoalberto for access.

## License

Private - All Rights Reserved

## Support

For issues or questions, contact:
- Email: alberto.gomez@bitso.com
- Twitter: @gotoalberto
