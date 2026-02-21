-- Add OAuth 2.0 columns to TwitterApp
ALTER TABLE "twitter_apps"
ADD COLUMN IF NOT EXISTS "clientId" TEXT,
ADD COLUMN IF NOT EXISTS "clientSecret" TEXT;

-- Make OAuth 1.0a credentials optional (they were required before)
ALTER TABLE "twitter_apps"
ALTER COLUMN "consumerKey" DROP NOT NULL,
ALTER COLUMN "consumerSecret" DROP NOT NULL;