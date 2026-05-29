-- AddIndex: subscriptions.user_id (billing queries were full-scanning)
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- DropIndex: subscriptions.stripeSubscriptionId — redundant; @unique already creates an implicit btree index
DROP INDEX IF EXISTS "subscriptions_stripe_subscription_id_idx";

-- DropIndex: usage.(userId, period) — redundant; @@unique already creates usage_user_id_period_key
DROP INDEX IF EXISTS "usage_user_id_period_idx";

-- AlterTable: story_scores.model_version default was stale ("gpt-4o"); production uses claude-sonnet-4-6
ALTER TABLE "story_scores" ALTER COLUMN "model_version" SET DEFAULT 'claude-sonnet-4-6';
