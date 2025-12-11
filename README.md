# Bitso Twitter API

Twitter API integration for Bitso cryptocurrency exchange. This application allows administrators to connect a Twitter bot account and receive mention notifications via webhooks.

## Features

- 🔐 Admin authentication with Twitter OAuth 2.0
- 🤖 Bot connection via Twitter OAuth 1.0a
- 📡 Real-time webhook processing for Twitter mentions
- 💾 Secure credential storage in Redis (Upstash)
- 🔒 AES-256-GCM encryption for OAuth tokens
- 📝 Detailed logging of all Twitter events

## Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Authentication:** NextAuth.js v4
- **Database:** Redis (Upstash)
- **Twitter API:** twitter-api-v2
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Prerequisites

- Node.js 20+
- npm or yarn
- Twitter Developer Account with:
  - OAuth 2.0 credentials (for admin login)
  - OAuth 1.0a credentials (for bot connection)
  - Bearer Token (for webhook registration)
  - Account Activity API access
- Upstash Redis account

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

- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for development)
- `NEXTAUTH_SECRET` - NextAuth encryption secret
- `UPSTASH_REDIS_REST_URL` - Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` - Redis authentication token
- `ENCRYPTION_KEY` - Key for encrypting bot tokens
- `X_API_CLIENT_ID` - Twitter OAuth 2.0 client ID
- `X_API_CLIENT_SECRET` - Twitter OAuth 2.0 client secret
- `TWITTER_OAUTH_API_KEY` - Twitter OAuth 1.0a consumer key
- `TWITTER_OAUTH_API_SECRET` - Twitter OAuth 1.0a consumer secret
- `X_API_BEARER_TOKEN` - Twitter Bearer token
- `ALLOWED_ADMIN_USERS` - Comma-separated list of admin usernames

## Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing with ngrok

For webhook testing, you need to expose your local server to the internet:

```bash
# Install ngrok
brew install ngrok

# Start ngrok tunnel
ngrok http 3000

# Update NEXTAUTH_URL and NEXT_PUBLIC_APP_URL in .env.local with ngrok URL
```

## Usage

### 1. Admin Login

1. Navigate to `/` (home page)
2. Click "Iniciar sesión con Twitter"
3. Authorize with your Twitter admin account (@gotoalberto or @bitsoonchain)
4. You'll be redirected to `/dashboard`

### 2. Connect Bot

1. In the dashboard, click "Conectar Bot"
2. Authorize the bot Twitter account via OAuth 1.0a
3. Bot credentials will be encrypted and stored in Redis
4. Bot is now ready to receive webhook events

### 3. Receive Mentions

When someone mentions your bot on Twitter:

1. Twitter sends webhook event to `/api/webhooks/twitter`
2. Event is validated and processed
3. Full details are logged to console
4. No data is stored (logs only)

### Example Log Output

```
================================================================================
📨 WEBHOOK EVENT RECEIVED
================================================================================
   Timestamp: 2025-12-11T10:30:00.000Z
   Event keys: tweet_create_events

🐦 TWEET CREATE EVENTS
────────────────────────────────────────────────────────────────────────────────

  📝 Tweet Details:
     Tweet ID: 1234567890
     From: @user_handle (User Name)
     User ID: 9876543210
     Text: @bot_handle Hello! This is a test mention
     Created at: Wed Dec 11 10:30:00 +0000 2025
     Language: en
     Mentions: @bot_handle
     Tweet URL: https://twitter.com/user_handle/status/1234567890
```

## API Routes

### Authentication

- `GET /api/auth/[...nextauth]` - NextAuth routes (OAuth 2.0)
- `GET /api/auth/bot-twitter/authorize` - Initiate bot OAuth 1.0a
- `GET /api/auth/bot-twitter/callback` - Bot OAuth callback
- `GET /api/auth/bot-twitter/status` - Get bot connection status
- `POST /api/auth/bot-twitter/disconnect` - Disconnect bot

### Webhooks

- `GET /api/webhooks/twitter` - CRC validation
- `POST /api/webhooks/twitter` - Receive webhook events

## Project Structure

```
bitso-twitter-api/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/   # NextAuth handler
│   │   │   │   └── bot-twitter/     # Bot OAuth endpoints
│   │   │   └── webhooks/
│   │   │       └── twitter/         # Webhook endpoint
│   │   ├── dashboard/               # Dashboard page
│   │   ├── page.tsx                 # Login page
│   │   ├── layout.tsx               # Root layout
│   │   └── providers.tsx            # Client providers
│   ├── lib/
│   │   ├── auth/
│   │   │   └── config.ts            # NextAuth config
│   │   ├── db/
│   │   │   └── redis.ts             # Redis client
│   │   ├── twitter/
│   │   │   └── bot.ts               # Bot operations
│   │   └── utils/
│   │       ├── admin.ts             # Admin validation
│   │       ├── encryption.ts        # Token encryption
│   │       └── env.ts               # Environment helpers
│   └── types/
│       ├── bot.ts                   # Bot types
│       └── next-auth.d.ts           # NextAuth types
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore rules
├── package.json                     # Dependencies
└── README.md                        # This file
```

## Security

### Encryption

- Bot OAuth tokens are encrypted with AES-256-GCM before storing in Redis
- Encryption key is stored in environment variable
- Tokens are decrypted only when needed for API calls

### Admin Access

- Only whitelisted Twitter accounts can access the dashboard
- Whitelist is configured via `ALLOWED_ADMIN_USERS` environment variable
- Currently allowed: @gotoalberto, @bitsoonchain

### Secrets Protection

- Pre-commit hooks prevent committing secrets
- GitHub Actions scan for leaked credentials
- All sensitive files are in `.gitignore`

## Deployment

### Vercel Deployment

1. **Configure environment variables in Vercel:**
   ```bash
   # List current variables
   vercel env ls --token 9Oi1p5WuVRSQqlEJbbHn8qI2

   # Add each variable using printf (avoids newlines)
   printf "value" | vercel env add VAR_NAME production --token 9Oi1p5WuVRSQqlEJbbHn8qI2
   ```

2. **Deploy:**
   ```bash
   npm run build
   vercel --prod --token 9Oi1p5WuVRSQqlEJbbHn8qI2
   ```

3. **Verify deployment:**
   ```bash
   vercel logs bitso-twitter-api.vercel.app --production --token 9Oi1p5WuVRSQqlEJbbHn8qI2
   ```

### Post-Deployment

1. Update `NEXTAUTH_URL` to production URL
2. Update `NEXT_PUBLIC_APP_URL` to production URL
3. Register webhook with production URL
4. Test CRC validation
5. Test mention processing

## Troubleshooting

### Bot won't connect

- Verify OAuth 1.0a credentials are correct
- Check that callback URL matches `NEXTAUTH_URL`
- Ensure cookies are enabled

### Webhooks not working

- Verify `TWITTER_OAUTH_API_SECRET` is set
- Check CRC validation is passing
- Ensure bot is subscribed to webhook
- Check webhook URL is accessible from Twitter

### Redis connection issues

- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Check Redis instance is active
- Test connection with Redis CLI

### Encryption errors

- Verify `ENCRYPTION_KEY` is set and consistent
- Don't change encryption key after storing tokens
- Reconnect bot if encryption key changes

## Contributing

This is a private project for Bitso. Please contact @gotoalberto for access.

## License

Private - All Rights Reserved

## Support

For issues or questions, contact:
- Email: alberto.gomez@bitso.com
- Twitter: @gotoalberto
