-- CreateTable
CREATE TABLE "idempotent_tweets" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "tweet_id" TEXT NOT NULL,
    "tweet_text" TEXT NOT NULL,
    "reply_to_tweet_id" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotent_tweets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idempotent_tweets_project_id_idempotency_key_idx" ON "idempotent_tweets"("project_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "idempotent_tweets_expires_at_idx" ON "idempotent_tweets"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotent_tweets_project_id_idempotency_key_key" ON "idempotent_tweets"("project_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "idempotent_tweets" ADD CONSTRAINT "idempotent_tweets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
