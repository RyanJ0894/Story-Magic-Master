-- Migration 0016: Emotion Overrides
-- Adds emotion_overrides JSONB column to projects for Performance Direction UI (Issue #37)

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "emotion_overrides" JSONB;
