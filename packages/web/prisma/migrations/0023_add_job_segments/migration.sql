-- Sprint K: Full Script Processing — chunked generation support
-- Adds segments JSON column to track per-segment status + audio URLs
-- Adds first_audio_url for progressive playback (Sprint L Fast Start)

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "segments" JSONB,
  ADD COLUMN IF NOT EXISTS "first_audio_url" TEXT;

-- Index to find jobs that have a first audio URL available (progressive playback polling)
CREATE INDEX IF NOT EXISTS "jobs_first_audio_url_not_null"
  ON "jobs" ("id")
  WHERE "first_audio_url" IS NOT NULL;
