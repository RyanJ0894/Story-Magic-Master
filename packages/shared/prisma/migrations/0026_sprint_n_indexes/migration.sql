-- DT-BL-M1: Index jobId on audio_outputs for job-based lookups
CREATE INDEX IF NOT EXISTS "audio_outputs_job_id_idx" ON "audio_outputs"("job_id");

-- DT-BL-M2: Composite index on alerts for unread-alert queries (userId + isRead)
CREATE INDEX IF NOT EXISTS "alerts_user_id_is_read_idx" ON "alerts"("user_id", "is_read");

-- DT-BL-M3: Index projectId on human_reviews for project-scoped review lookups
CREATE INDEX IF NOT EXISTS "human_reviews_project_id_idx" ON "human_reviews"("project_id");
