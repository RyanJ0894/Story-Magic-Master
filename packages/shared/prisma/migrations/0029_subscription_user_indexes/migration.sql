-- Migration: 0029_subscription_user_indexes
-- Add composite indexes to subscriptions table.
-- Every entitlement check queries by userId (and often userId+status);
-- without these indexes each check is a full table scan.

CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");
