-- Migration 0012: scene-level audio sharing
-- Adds scene_index and scene_start_ms to script_shares for per-scene share URLs.
-- Both columns are nullable; NULL = full-project share (existing behaviour unchanged).

ALTER TABLE "script_shares"
  ADD COLUMN IF NOT EXISTS "scene_index"    INTEGER,
  ADD COLUMN IF NOT EXISTS "scene_start_ms" INTEGER;
