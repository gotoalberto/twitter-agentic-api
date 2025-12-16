#!/bin/bash

# Apply idempotent_tweets migration directly to database
# This bypasses Prisma's migration system due to drift between projects

export PGPASSWORD="XForward2024Pass"

psql -h x-forwarder-db.cuayvp8dpvrg.us-east-1.rds.amazonaws.com \
     -U xforwarder \
     -d xforwarder \
     -p 5432 \
     -f prisma/migrations/20251216_add_idempotent_tweets/migration.sql

echo "✅ Migration applied successfully"
