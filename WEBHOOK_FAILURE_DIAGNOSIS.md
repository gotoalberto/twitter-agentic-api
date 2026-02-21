# Webhook Registration Failure - Diagnosis & Solutions

## Quick Diagnosis Checklist

When a bot fails to connect due to webhook registration failure, check these in order:

- [ ] **Bearer Token Valid?** - Check TwitterApp.bearerToken
  - If invalid: Run `POST /api/twitter-apps/{appId}/refresh-token`
  - This is the MOST COMMON cause of failures

- [ ] **Consumer Credentials Correct?** - Check TwitterApp.consumerKey/consumerSecret
  - Verify in Twitter Developer Portal
  - Make sure OAuth 1.0a is enabled
  - Ensure app has Read + Write permissions

- [ ] **Twitter App OAuth Scope** - Check in Twitter Developer Portal
  - v2 API access: REQUIRED (for listing/subscribing webhooks)
  - v1.1 API access: OPTIONAL (for webhook registration fallback)

- [ ] **Webhook Environment Correct?** - Check TwitterApp.webhookEnv
  - Should match the environment in Twitter App settings
  - Typically "production"

- [ ] **Project Has TwitterApp Assigned?**
  - Project.twitterAppId should reference valid TwitterApp
  - Without this, bot connection cannot proceed

---

## Bearer Token Invalidation Scenarios

### Scenario 1: Token Was Manually Revoked
```
How to detect: 401 Unauthorized from listWebhooks()
Solution: POST /api/twitter-apps/{appId}/refresh-token
Time to fix: 2-3 seconds
```

### Scenario 2: Consumer Credentials Were Rotated
```
How to detect: 401 Unauthorized when creating new token
Solution: 
  1. Get new Consumer Key/Secret from Twitter Dev Portal
  2. Update TwitterApp with new credentials
  3. Try creating new bearer token
Time to fix: 5-10 minutes
```

### Scenario 3: Twitter App OAuth 2.0 Access Was Revoked
```
How to detect: 403 Forbidden from OAuth 2.0 token endpoint
Solution:
  1. Check Twitter Developer Portal settings
  2. Re-enable OAuth 2.0 if disabled
  3. Ensure app has required permissions
Time to fix: 5-15 minutes
```

### Scenario 4: Bearer Token Expired in Database But Is Valid
```
How to detect: listWebhooks() fails but manual API test succeeds
Solution: POST /api/twitter-apps/{appId}/refresh-token
Time to fix: 2-3 seconds
Note: Bearer tokens technically don't expire, but this can happen
      if the database copy is corrupted or out of sync
```

---

## Step-by-Step Debugging

### Step 1: Identify Which TwitterApp Is Being Used

Check the project configuration:
```typescript
// Look at: Project.twitterAppId
// This tells you which TwitterApp to check
```

### Step 2: Verify Bearer Token Validity

Check the logs for:
```
📡 Twitter API Response: 401 / 403
or
Failed to list webhooks: 401 / 403
```

If you see this, the bearer token is invalid.

### Step 3: Refresh the Bearer Token

```bash
# Option 1: Via API
POST /api/twitter-apps/{appId}/refresh-token

# Option 2: Via CLI (if you have access)
const { createBearerToken, updateTwitterApp } = require('./lib');
const newToken = await createBearerToken(consumerKey, consumerSecret);
await updateTwitterApp(appId, { bearerToken: newToken });
```

### Step 4: Verify Consumer Credentials

Check logs for:
```
❌ Twitter API Error: {status: 403, message: "Forbidden"}
or
oauth_signature_mismatch
or
HMAC-SHA1 signature verification failed
```

If you see this, consumer credentials may be wrong.

### Step 5: Retry Bot Connection

After fixing credentials:
```
1. User clicks "Disconnect Bot" in dashboard
2. User clicks "Connect Bot" again
3. Completes OAuth flow
4. Should now succeed
```

---

## API Endpoints for Troubleshooting

### Check TwitterApp Status

```bash
# List all TwitterApps
GET /api/twitter-apps
Response: List of apps (credentials masked)

# Get specific TwitterApp details
GET /api/twitter-apps/{appId}
Response: App info (credentials masked)
```

### Verify Bearer Token

```bash
# Refresh bearer token
POST /api/twitter-apps/{appId}/refresh-token
Request: { }
Response: {
  success: boolean,
  message: string,
  newBearerToken?: string
}

# If it fails: Consumer Key/Secret are wrong
```

### Check Webhook Registration

```bash
# List project webhooks
GET /api/projects/{projectId}/webhooks
Response: List of registered webhooks

# Manual webhook registration
POST /api/projects/{projectId}/register-webhook
Request: { }
Response: {
  webhookId: string,
  url: string,
  subscribed: boolean
}

# Force webhook subscription
POST /api/projects/{projectId}/force-webhook-subscription
Request: { }
Response: {
  success: boolean,
  webhookId: string,
  subscribed: boolean
}
```

---

## Common Error Messages & Solutions

### Error: "Failed to list webhooks: 401"
```
Cause: Bearer token invalid or expired
Solution: POST /api/twitter-apps/{appId}/refresh-token
```

### Error: "Failed to create bearer token: 401"
```
Cause: Consumer Key or Consumer Secret is invalid
Solution: 
  1. Check TwitterApp.consumerKey
  2. Check TwitterApp.consumerSecret
  3. Verify they match Twitter Developer Portal
  4. Update if necessary
```

### Error: "Twitter API error: Webhook registration failed - 403"
```
Cause: App doesn't have v1.1 webhook management access
Solution: 
  This is expected! The app uses shared webhook.
  This error usually means the shared webhook was already created.
  Check listWebhooks() to confirm webhook exists.
```

### Error: "Twitter API error: DuplicateSubscription"
```
Cause: Bot is already subscribed to webhook
Solution: This is OK
  - Bot is already set up
  - No action needed
  - Database status should be updated to "subscribed: true"
```

### Error: "oauth_signature_mismatch"
```
Cause: Consumer Key/Secret or bot tokens are corrupted/invalid
Solution:
  1. Disconnect bot: DELETE /api/projects/{projectId}/bot
  2. Delete TwitterApp if credentials are wrong
  3. Recreate TwitterApp with correct credentials
  4. Reconnect bot
```

---

## Testing After Fix

### 1. Verify Bearer Token Works

```bash
curl -i -X GET \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  "https://api.twitter.com/2/users/by/username/twitter"

# Should return 200 OK with user data
# If 401/403: Bearer token is invalid
```

### 2. Verify Consumer Credentials Work

```bash
# The TwitterApi library will validate automatically
# If error: Consumer Key/Secret invalid
```

### 3. Test Full Bot Connection Flow

```
1. Open dashboard
2. Click "Connect Bot" for project
3. Complete OAuth flow
4. Should see: "Bot connected successfully"
5. Check logs for: "✅ WEBHOOK REGISTRATION COMPLETE"
```

### 4. Verify Webhook Subscription

```bash
# Check database status
SELECT * FROM webhook_registrations 
WHERE project_id = 'YOUR_PROJECT_ID';

# Should show:
# - webhookId: not null
# - url: matches your webhook URL
# - subscribed: true
```

---

## Prevention & Monitoring

### Best Practices

1. **Regular Token Validation**
   - Periodically verify bearer tokens are valid
   - Monthly refresh of long-lived tokens

2. **Backup TwitterApp**
   - Create multiple TwitterApps with same credentials
   - Switch to backup if primary fails
   - No downtime for users

3. **Alert on Failures**
   - Monitor webhook registration failures
   - Alert when bearer token refresh fails
   - Early warning of credential rotation

4. **Documentation**
   - Document which TwitterApp is used by which projects
   - Keep track of Consumer Key rotation dates
   - Maintain inventory of API credentials

### Monitoring Queries

```sql
-- Find projects with potential issues
SELECT 
  p.id, p.name, 
  t.name as twitter_app,
  wr.subscribed, wr.webhook_id
FROM projects p
LEFT JOIN twitter_apps t ON p.twitter_app_id = t.id
LEFT JOIN webhook_registrations wr ON p.id = wr.project_id
WHERE wr.subscribed = false
  OR wr.webhook_id IS NULL;

-- Find bots without webhook subscriptions
SELECT b.username, p.name, wr.subscribed
FROM bots b
JOIN projects p ON b.project_id = p.id
LEFT JOIN webhook_registrations wr ON p.id = wr.project_id
WHERE wr.subscribed = false OR wr.id IS NULL;
```

---

## When to Escalate

Contact Twitter Support if:
- Bearer token refresh returns 500 error from Twitter
- Consumer credentials are correct but OAuth 1.0a fails
- App shows "No v2 API access" despite having it enabled
- Webhook registration returns "Invalid URL" when URL is correct

---

## Reference Documentation

- Full OAuth analysis: `OAuth_Webhook_Analysis.md`
- Quick reference: `OAUTH_QUICK_REFERENCE.md`
- Webhook code: `/src/lib/twitter/webhooks.ts`
- Bearer token code: `/src/lib/twitter/bearer-token.ts`
- Bot connection: `/src/app/api/auth/bot-twitter/callback/route.ts`

---

Last Updated: 2026-02-21
