-- Migration: 0032_ai_health_log
-- Tracks AI provider health check results before long-running batch jobs.
-- Enables pattern detection for key failures, quota exhaustion, and provider outages.

CREATE TABLE IF NOT EXISTS "ai_health_log" (
    "id"            TEXT NOT NULL,
    "provider"      TEXT NOT NULL,
    "status"        TEXT NOT NULL,
    "error_code"    TEXT,
    "error_message" TEXT,
    "latency_ms"    INTEGER,
    "triggered_by"  TEXT NOT NULL DEFAULT 'preflight',
    "checked_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_health_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_health_log_provider_checked_at_idx"
    ON "ai_health_log"("provider", "checked_at");

CREATE INDEX IF NOT EXISTS "ai_health_log_checked_at_idx"
    ON "ai_health_log"("checked_at");
