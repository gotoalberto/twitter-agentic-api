# X Forwarder

Twitter webhook forwarder application with multi-project support. This app registers with Twitter's Account Activity API and forwards all webhook events to configured endpoints, allowing you to manage multiple Twitter bots and their webhook forwarding configurations independently.

## What does it do?

**X Forwarder** acts as a transparent proxy between Twitter and your applications:

1. **Manages multiple projects** - Each project can have its own bot and forwarding configuration
2. **Registers webhooks with Twitter** using Twitter API v2
3. **Subscribes bot accounts** to receive webhook events via OAuth 1.0a
4. **Forwards all events** to project-specific endpoints in real-time
5. **Publishes tweets** on behalf of connected bots via API endpoint

This is useful when:
- You need to manage multiple Twitter bots independently
- Twitter's webhook limit is reached (1 webhook per app)
- You want to centralize bot credential management
- Your applications can't directly register with Twitter
- You need a proxy API for publishing tweets

## Architecture

```
┌─────────┐         ┌────────────────┐         ┌──────────────┐
│ Twitter │────────▶│  X Forwarder   │────────▶│  Project A   │
│   API   │         │   (Database)   │         │  (goodboy)   │
└─────────┘         └────────────────┘         └──────────────┘
    │                      │
    │                      │                    ┌──────────────┐
    │  Webhook Events      │───────────────────▶│  Project B   │
    │                      │                    │ (customer)   │
    │                      │                    └──────────────┘
    │  Tweet Publishing    │
    │◀─────────────────────┤
```

## Features

### Multi-Project Support

- 📦 Create and manage multiple independent projects
- 🤖 Each project can have one Twitter bot
- 📡 Independent webhook forwarding per project
- 🔐 Project-scoped credentials and configurations

### Twitter Integration

- 🔐 Admin authentication with Twitter OAuth 2.0
- 🤖 Bot connection via Twitter OAuth 1.0a
- 📡 Real-time webhook forwarding with header preservation
- 💾 Secure credential storage with AES-256-GCM encryption
- 📝 Detailed logging of all operations
- ⚡ Automatic webhook subscription/unsubscription
- 🎯 Tweet publishing API endpoint
- 🔄 CRC validation handled automatically

### Database & Infrastructure

- 💿 PostgreSQL 15.15 on AWS RDS
- 🔄 Prisma ORM for type-safe database operations
- 🔒 Encrypted OAuth tokens (AES-256-GCM)
- 🔗 Cascade deletion (deleting project cleans up all resources)

## Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Authentication:** NextAuth.js v4
- **Database:** PostgreSQL 15.15 (AWS RDS)
- **ORM:** Prisma 7.1.0
- **Twitter API:** API v2 (webhooks, subscriptions, tweets)
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
- PostgreSQL 15+ database (AWS RDS recommended)
- Target applications with webhook endpoints

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

5. **Setup database:**
   ```bash
   # Run Prisma migrations
   npx prisma migrate deploy

   # Generate Prisma Client
   npx prisma generate
   ```

## Environment Variables

See `.env.example` for all required variables. Key variables include:

### Required

- `NEXTAUTH_URL` - Your app URL (e.g., `https://bitso-twitter-api.vercel.app`)
- `NEXTAUTH_SECRET` - NextAuth encryption secret
- `NEXT_PUBLIC_APP_URL` - Public app URL (same as NEXTAUTH_URL)
- `DATABASE_URL` - PostgreSQL connection string
- `ENCRYPTION_KEY` - Key for encrypting bot tokens (AES-256-GCM)
- `X_API_CLIENT_ID` - Twitter OAuth 2.0 client ID (for admin login)
- `X_API_CLIENT_SECRET` - Twitter OAuth 2.0 client secret
- `TWITTER_OAUTH_API_KEY` - Twitter OAuth 1.0a consumer key (for bots & webhooks)
- `TWITTER_OAUTH_API_SECRET` - Twitter OAuth 1.0a consumer secret
- `X_API_BEARER_TOKEN` - Twitter Bearer token (for webhook registration)
- `ALLOWED_ADMIN_USERS` - Comma-separated list of admin usernames (e.g., `"user1,user2"`)
- `TWITTER_WEBHOOK_ENV` - Webhook environment name (e.g., `"production"`)

### Database Connection String Format

```
postgresql://username:password@host:port/database
```

Example:
```
DATABASE_URL="postgresql://xforwarder:password@x-forwarder-db.cuayvp8dpvrg.us-east-1.rds.amazonaws.com:5432/xforwarder"
```

### Important Notes

- **DO NOT use `echo` to set env vars in Vercel** - it adds literal `\n` characters
- **Always use `printf '%s' 'value'`** when piping to `vercel env add`
- All Twitter credentials must be from the **same Twitter app**
- The Twitter app must have **Account Activity API** access enabled

## Usage

### 1. Admin Login

1. Navigate to `/` (home page)
2. Click "Sign in with Twitter"
3. Authorize with your admin Twitter account (must be in `ALLOWED_ADMIN_USERS`)
4. You'll be redirected to `/dashboard`

### 2. Create a Project

1. In the dashboard, click "New Project"
2. Enter a unique project name (e.g., "goodboy", "customer-support")
3. Click "Create Project"
4. You'll see your new project card in the dashboard

### 3. Configure Project

Click on a project card to access project-specific configuration:

#### Connect Bot

1. Click "Connect Bot"
2. Authorize the bot Twitter account via OAuth 1.0a
3. Bot credentials will be encrypted and stored in PostgreSQL
4. Bot status will show as "Connected"

#### Configure Forwarding Endpoint

1. Enter your target webhook URL (e.g., `https://goodboy.pepesdog.box/api/webhooks/twitter`)
2. Enable forwarding with the checkbox
3. Click "Save Configuration"
4. The app will automatically:
   - Register a webhook with Twitter (API v2)
   - Subscribe the bot to the webhook (OAuth 1.0a)
   - Store the webhook registration in PostgreSQL
   - Twitter will validate via CRC

### 4. Using the Tweet Publishing API

External applications can publish tweets via the API:

```bash
curl -X POST https://bitso-twitter-api.vercel.app/api/twitter/tweet \
  -H "Content-Type: application/json" \
  -d '{
    "username": "bot_handle",
    "text": "Hello from X Forwarder!",
    "replyToTweetId": "1234567890",
    "idempotencyKey": "unique-key-123"
  }'
```

Response (first time):
```json
{
  "success": true,
  "tweet": {
    "id": "1234567890",
    "text": "Hello from X Forwarder!",
    "url": "https://twitter.com/bot_handle/status/1234567890"
  }
}
```

Response (retry with same idempotencyKey):
```json
{
  "success": true,
  "tweet": {
    "id": "1234567890",
    "text": "Hello from X Forwarder!",
    "url": "https://twitter.com/bot_handle/status/1234567890"
  },
  "idempotent": true
}
```

**Note:** The `idempotent: true` flag indicates that the tweet was already published and this is a cached response. No duplicate tweet was created.

### 5. Monitor Operations

```bash
# View logs in Vercel
vercel logs bitso-twitter-api.vercel.app --production

# Or check logs in real-time
vercel logs bitso-twitter-api.vercel.app --production --follow
```

## API Routes

### Project Management

- `GET /api/projects` - List all projects with relationships
- `POST /api/projects` - Create new project
  ```json
  { "name": "project-name" }
  ```
- `GET /api/projects/[id]` - Get specific project
- `DELETE /api/projects/[id]` - Delete project (cascades to bot, config, webhooks)

### Bot Management (Project-Scoped)

- `GET /api/projects/[id]/bot/authorize` - Start bot OAuth 1.0a flow
- `GET /api/projects/[id]/bot/status` - Get bot connection status
- `POST /api/projects/[id]/bot/disconnect` - Disconnect bot and cleanup webhooks

### Forwarding Configuration (Project-Scoped)

- `GET /api/projects/[id]/forwarding` - Get forwarding configuration
- `POST /api/projects/[id]/forwarding` - Save configuration (registers webhook)
  ```json
  {
    "endpoint": "https://your-app.com/webhooks/twitter",
    "enabled": true
  }
  ```
- `DELETE /api/projects/[id]/forwarding` - Delete configuration (unsubscribes & deletes webhook)

### Tweet Publishing

- `POST /api/twitter/tweet` - Publish a tweet
  ```json
  {
    "username": "bot_handle",
    "text": "Tweet text",
    "replyToTweetId": "optional_tweet_id",
    "idempotencyKey": "unique-key-123"
  }
  ```

  **Idempotency Support:**
  - `idempotencyKey` (optional): Prevents duplicate tweets on retry
  - If a tweet was already published with the same key, returns the cached tweet
  - Keys expire after 24 hours
  - Use a unique identifier (e.g., database record ID) as the key

### Legacy Endpoints (Backward Compatible)

These endpoints use the default "goodboy" project:

- `GET /api/auth/bot-twitter/*` - Bot OAuth endpoints
- `GET /api/config/forwarding` - Forwarding configuration

### Webhooks

- `GET /api/webhooks/twitter?crc_token=XXX` - CRC validation
- `POST /api/webhooks/twitter` - Receive and forward webhook events

## Database Schema

### Projects

```typescript
{
  id: string (cuid)
  name: string (unique)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Bots

```typescript
{
  id: string (cuid)
  projectId: string (unique)
  username: string (unique)
  userId: string (unique)
  accessToken: string (encrypted)
  accessTokenSecret: string (encrypted)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Forwarding Configurations

```typescript
{
  id: string (cuid)
  projectId: string (unique)
  endpoint: string
  enabled: boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Webhook Registrations

```typescript
{
  id: string (cuid)
  projectId: string
  webhookId: string (unique)
  url: string
  subscribed: boolean
  createdAt: DateTime
  updatedAt: DateTime
}
```

## Project Structure

```
bitso-twitter-api/
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── migrations/                # Prisma migrations
│   └── config.ts                  # Prisma configuration
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/      # NextAuth OAuth 2.0
│   │   │   │   └── bot-twitter/        # Legacy bot OAuth endpoints
│   │   │   ├── projects/
│   │   │   │   ├── route.ts            # GET/POST projects
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts        # GET/DELETE project
│   │   │   │       ├── bot/
│   │   │   │       │   ├── authorize/  # Start OAuth for project
│   │   │   │       │   ├── status/     # Bot status for project
│   │   │   │       │   └── disconnect/ # Disconnect bot from project
│   │   │   │       └── forwarding/     # Forwarding config for project
│   │   │   │           └── route.ts    # GET/POST/DELETE
│   │   │   ├── twitter/
│   │   │   │   └── tweet/              # Tweet publishing endpoint
│   │   │   ├── config/
│   │   │   │   └── forwarding/         # Legacy forwarding endpoint
│   │   │   └── webhooks/
│   │   │       └── twitter/            # Webhook receiver
│   │   ├── dashboard/
│   │   │   ├── page.tsx                # Projects list
│   │   │   └── projects/
│   │   │       └── [id]/
│   │   │           └── page.tsx        # Project detail page
│   │   └── page.tsx                    # Login page
│   ├── lib/
│   │   ├── auth/
│   │   │   └── config.ts               # NextAuth configuration
│   │   ├── db/
│   │   │   ├── prisma.ts               # Prisma singleton client
│   │   │   ├── projects.ts             # Project CRUD operations
│   │   │   ├── bots.ts                 # Bot operations with encryption
│   │   │   ├── forwarding.ts           # Forwarding config operations
│   │   │   └── webhooks.ts             # Webhook registration operations
│   │   ├── twitter/
│   │   │   └── webhooks.ts             # Twitter webhook API calls
│   │   └── utils/
│   │       ├── admin.ts                # Admin whitelist validation
│   │       ├── encryption.ts           # AES-256-GCM token encryption
│   │       └── env.ts                  # Environment helpers
│   └── generated/
│       └── prisma/                     # Generated Prisma client
├── .env.example                        # Environment template
├── package.json                        # Dependencies
└── README.md                           # This file
```

## Security

### Encryption

- Bot OAuth tokens are encrypted with **AES-256-GCM** before storing in PostgreSQL
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
- Your endpoints can validate requests came from Twitter
- CRC validation ensures webhook ownership
- HTTPS required for all webhook URLs

### Database Security

- Connection strings use encrypted connections (SSL)
- Credentials stored only in environment variables
- Cascade deletion prevents orphaned records
- Foreign key constraints ensure data integrity

## Deployment

### Vercel Deployment

1. **Configure environment variables in Vercel:**
   ```bash
   # IMPORTANT: Use printf, not echo (echo adds literal \n)

   # Example:
   printf '%s' 'your_value_here' | vercel env add NEXTAUTH_SECRET production
   printf '%s' 'https://bitso-twitter-api.vercel.app' | vercel env add NEXTAUTH_URL production

   # Add DATABASE_URL
   printf '%s' 'postgresql://user:pass@host:5432/db' | vercel env add DATABASE_URL production

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
- [ ] Database migrations ran successfully
- [ ] Prisma Client generated
- [ ] `NEXTAUTH_URL` matches production URL
- [ ] `NEXT_PUBLIC_APP_URL` matches production URL
- [ ] Admin login works
- [ ] Can create projects
- [ ] Bot connection works per project
- [ ] Forwarding endpoint configured per project
- [ ] CRC validation passes
- [ ] Webhook events are forwarded correctly
- [ ] Tweet publishing API works
- [ ] Check logs for errors

## Troubleshooting

### Database Connection Issues

- **Verify DATABASE_URL** is correct and accessible
- **Check PostgreSQL version** (15+ required)
- **Test connection** from Vercel to database
- **Review Prisma logs** for connection errors
- **Check firewall rules** allow Vercel IP ranges

### Bot won't connect

- **Check OAuth 1.0a credentials** are correct and from same app
- **Verify callback URL** matches `NEXTAUTH_URL + /api/auth/bot-twitter/callback`
- **Enable cookies** in browser
- **Check database connection** - credentials may fail to save
- **Review logs** for OAuth errors

### Webhook registration fails

- **Verify Bearer Token** is correct and has webhook permissions
- **Check Twitter app** has Account Activity API access enabled
- **Ensure bot is connected** before saving forwarding config
- **Check webhook limit** - Twitter allows 1 webhook per app (delete old ones)
- **Review logs** for API errors (401, 403, etc.)

### Events not forwarding

- **Check forwarding is enabled** in project configuration
- **Verify endpoint URL** is correct and accessible
- **Check bot is subscribed** to webhook
- **Ensure target endpoint** returns 200 OK quickly (< 3s)
- **Review logs** for forwarding errors

### Encryption errors

- **Verify `ENCRYPTION_KEY`** is set and 32 bytes (base64)
- **Don't change encryption key** after storing bot credentials
- **Reconnect bot** if encryption key changes
- **Check database** stores encrypted values correctly

### Prisma errors

- **Run migrations**: `npx prisma migrate deploy`
- **Generate client**: `npx prisma generate`
- **Check schema**: `npx prisma validate`
- **View data**: `npx prisma studio`

## Migration from Redis

If you're migrating from the old Redis-based version:

1. **Backup existing data** from Redis
2. **Create "goodboy" project** in new system
3. **Reconnect bot** via new OAuth flow
4. **Reconfigure forwarding endpoint**
5. **Test webhook delivery**
6. **Decommission Redis** instance

The default "goodboy" project maintains backward compatibility with legacy endpoints.

## Known Limitations

- **1 webhook per Twitter app** - Twitter's limit, not this app's
- **Bot must stay connected** - disconnecting removes webhook
- **CRC checks every 24h** - Twitter requires this, handled automatically
- **3 second timeout** - Twitter requires webhook response < 3s
- **One bot per project** - design constraint for clarity

## Contributing

This is a private project. Contact @gotoalberto for access.

## License

Private - All Rights Reserved

## Support

For issues or questions, contact:
- Email: alberto.gomez@bitso.com
- Twitter: @gotoalberto
