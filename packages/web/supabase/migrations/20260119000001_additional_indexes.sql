-- Additional performance indexes
-- Migration: 20260119000001

-- Index for Stripe customer ID lookups (used by webhooks)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- Index for recent jobs (ordered by created_at)
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Composite index for user's recent projects
CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects(user_id, created_at DESC);
