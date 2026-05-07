-- Migration 0013: director notes
-- Adds director_notes JSONB column to projects for pre-generation creative direction.
-- NULL = no notes set (existing projects unaffected).

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "director_notes" JSONB;
