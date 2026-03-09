-- Drop hivemind tables in correct order (FK dependencies first)
ALTER TABLE IF EXISTS "rate_limits" DROP COLUMN IF EXISTS "hivemind_user_id";

DROP TABLE IF EXISTS "hivemind_raids" CASCADE;
DROP TABLE IF EXISTS "hivemind_actions" CASCADE;
DROP TABLE IF EXISTS "hivemind_users" CASCADE;
DROP TABLE IF EXISTS "hivemind_config" CASCADE;
