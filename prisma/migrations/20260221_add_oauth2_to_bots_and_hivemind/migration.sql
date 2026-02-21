-- Add OAuth 2.0 columns to Bot model
ALTER TABLE "bots"
ADD COLUMN IF NOT EXISTS "oauth2AccessToken" TEXT,
ADD COLUMN IF NOT EXISTS "refreshToken" TEXT,
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "scope" TEXT;

-- Add OAuth 2.0 columns to HivemindUser model
ALTER TABLE "hivemind_users"
ADD COLUMN IF NOT EXISTS "oauth2_access_token" TEXT,
ADD COLUMN IF NOT EXISTS "refresh_token" TEXT,
ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "scope" TEXT;