-- Migration 0035: Convert all DateTime columns to TIMESTAMPTZ
-- PostgreSQL stores timestamptz with timezone metadata and auto-converts
-- on retrieval. 89 columns across 45 tables.
-- saleDate in script_corpus keeps @db.Date (date only — no time component).

-- activity_logs
ALTER TABLE "activity_logs" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- ai_health_log
ALTER TABLE "ai_health_log" ALTER COLUMN "checked_at" TYPE TIMESTAMPTZ;

-- alert_preferences
ALTER TABLE "alert_preferences" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "alert_preferences" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- alerts
ALTER TABLE "alerts" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "alerts" ALTER COLUMN "email_sent_at" TYPE TIMESTAMPTZ;
ALTER TABLE "alerts" ALTER COLUMN "read_at" TYPE TIMESTAMPTZ;

-- alignments
ALTER TABLE "alignments" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- api_keys
ALTER TABLE "api_keys" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "api_keys" ALTER COLUMN "last_used_at" TYPE TIMESTAMPTZ;

-- audio_outputs
ALTER TABLE "audio_outputs" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- audit_logs
ALTER TABLE "audit_logs" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- content_access_log
ALTER TABLE "content_access_log" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- corpus_score
ALTER TABLE "corpus_score" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- credit_transactions
ALTER TABLE "credit_transactions" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- human_reviews
ALTER TABLE "human_reviews" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "human_reviews" ALTER COLUMN "notified_customer_at" TYPE TIMESTAMPTZ;
ALTER TABLE "human_reviews" ALTER COLUMN "notified_reviewer_at" TYPE TIMESTAMPTZ;
ALTER TABLE "human_reviews" ALTER COLUMN "reviewed_at" TYPE TIMESTAMPTZ;

-- impact_donations
ALTER TABLE "impact_donations" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- impact_partners
ALTER TABLE "impact_partners" ALTER COLUMN "active_from" TYPE TIMESTAMPTZ;
ALTER TABLE "impact_partners" ALTER COLUMN "active_to" TYPE TIMESTAMPTZ;
ALTER TABLE "impact_partners" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "impact_partners" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- impact_prize_draws
ALTER TABLE "impact_prize_draws" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "impact_prize_draws" ALTER COLUMN "notified_at" TYPE TIMESTAMPTZ;
ALTER TABLE "impact_prize_draws" ALTER COLUMN "paid_at" TYPE TIMESTAMPTZ;

-- impact_stories
ALTER TABLE "impact_stories" ALTER COLUMN "attested_at" TYPE TIMESTAMPTZ;
ALTER TABLE "impact_stories" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "impact_stories" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- Drop view that depends on job_logs.created_at before altering the column
DROP VIEW IF EXISTS recent_job_errors;

-- job_logs
ALTER TABLE "job_logs" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- Recreate view with timestamptz-typed created_at
CREATE OR REPLACE VIEW recent_job_errors AS
SELECT
    jl.id,
    jl.job_id,
    jl.project_id,
    j.user_id,
    p.name AS project_name,
    jl.step,
    jl.message,
    jl.error_message,
    jl.error_stack,
    jl.metadata,
    jl.created_at
FROM job_logs jl
JOIN jobs j ON j.id = jl.job_id
JOIN projects p ON p.id = jl.project_id
WHERE jl.level = 'error'
ORDER BY jl.created_at DESC
LIMIT 100;

-- Drop view that depends on jobs.completed_at before altering the column
DROP VIEW IF EXISTS queue_stats;

-- jobs
ALTER TABLE "jobs" ALTER COLUMN "completed_at" TYPE TIMESTAMPTZ;
ALTER TABLE "jobs" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "jobs" ALTER COLUMN "lock_expires_at" TYPE TIMESTAMPTZ;
ALTER TABLE "jobs" ALTER COLUMN "queued_at" TYPE TIMESTAMPTZ;
ALTER TABLE "jobs" ALTER COLUMN "started_at" TYPE TIMESTAMPTZ;

-- Recreate view with timestamptz-typed columns
CREATE OR REPLACE VIEW queue_stats AS
SELECT
    job_type,
    COUNT(*) FILTER (WHERE status = 'queued') AS queued_count,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') AS completed_24h,
    COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours') AS failed_24h,
    AVG(actual_duration_ms) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') AS avg_duration_ms,
    MAX(queued_at) FILTER (WHERE status = 'queued') AS oldest_queued_at,
    COUNT(*) FILTER (WHERE status = 'processing' AND lock_expires_at < NOW()) AS stale_locks
FROM jobs
GROUP BY job_type;

-- mix_manifests
ALTER TABLE "mix_manifests" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- platform_settings
ALTER TABLE "platform_settings" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- podcast_feeds
ALTER TABLE "podcast_feeds" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "podcast_feeds" ALTER COLUMN "published_at" TYPE TIMESTAMPTZ;
ALTER TABLE "podcast_feeds" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- profiles
ALTER TABLE "profiles" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "profiles" ALTER COLUMN "current_period_end" TYPE TIMESTAMPTZ;
ALTER TABLE "profiles" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- project_comments
ALTER TABLE "project_comments" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "project_comments" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- project_notes
ALTER TABLE "project_notes" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "project_notes" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- projects
ALTER TABLE "projects" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "projects" ALTER COLUMN "exchange_listed_at" TYPE TIMESTAMPTZ;
ALTER TABLE "projects" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- purchases
ALTER TABLE "purchases" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- reader_library
ALTER TABLE "reader_library" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "reader_library" ALTER COLUMN "last_played_at" TYPE TIMESTAMPTZ;
ALTER TABLE "reader_library" ALTER COLUMN "read_status_updated_at" TYPE TIMESTAMPTZ;
ALTER TABLE "reader_library" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- revisions
ALTER TABLE "revisions" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- rewrites
ALTER TABLE "rewrites" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- script_corpus
ALTER TABLE "script_corpus" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "script_corpus" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- script_reviews
ALTER TABLE "script_reviews" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "script_reviews" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- script_shares
ALTER TABLE "script_shares" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "script_shares" ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ;
ALTER TABLE "script_shares" ALTER COLUMN "last_accessed_at" TYPE TIMESTAMPTZ;
ALTER TABLE "script_shares" ALTER COLUMN "last_viewed_at" TYPE TIMESTAMPTZ;
ALTER TABLE "script_shares" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- story_scores
ALTER TABLE "story_scores" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- subscriptions
ALTER TABLE "subscriptions" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "subscriptions" ALTER COLUMN "current_period_end" TYPE TIMESTAMPTZ;
ALTER TABLE "subscriptions" ALTER COLUMN "current_period_start" TYPE TIMESTAMPTZ;
ALTER TABLE "subscriptions" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- suggestions
ALTER TABLE "suggestions" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "suggestions" ALTER COLUMN "responded_at" TYPE TIMESTAMPTZ;

-- team_members
ALTER TABLE "team_members" ALTER COLUMN "accepted_at" TYPE TIMESTAMPTZ;
ALTER TABLE "team_members" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "team_members" ALTER COLUMN "invited_at" TYPE TIMESTAMPTZ;
ALTER TABLE "team_members" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- team_shares
ALTER TABLE "team_shares" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- teams
ALTER TABLE "teams" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "teams" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- timelines
ALTER TABLE "timelines" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- usage
ALTER TABLE "usage" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "usage" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;

-- voice_clones
ALTER TABLE "voice_clones" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- voice_marketplace_interest
ALTER TABLE "voice_marketplace_interest" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- webhook_delivery_logs
ALTER TABLE "webhook_delivery_logs" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- webhook_endpoints
ALTER TABLE "webhook_endpoints" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;

-- writer_subscriptions
ALTER TABLE "writer_subscriptions" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
