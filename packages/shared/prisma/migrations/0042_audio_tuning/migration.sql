-- Migration 0042: Per-user audio mix tuning preferences.
--
-- Closes B-001 from docs/RYAN-TESTING-BUILD-PLAN-2026-06-15.md.
--
-- Adds one row per user that opts into custom mix tuning. Stores offsets
-- (relative to in-code defaults) rather than absolutes so a future baseline
-- shift doesn't invalidate saved preferences. `locked` is the explicit
-- commit flag — unlocked rows persist for the page reload but don't flow
-- into generations.

CREATE TABLE "audio_tuning" (
  "user_id"                 TEXT             NOT NULL,
  "music_gain_offset_db"    INTEGER          NOT NULL DEFAULT 0,
  "ambience_gain_offset_db" INTEGER          NOT NULL DEFAULT 0,
  "sfx_gain_offset_db"      INTEGER          NOT NULL DEFAULT 0,
  "narration_speed"         DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "locked"                  BOOLEAN          NOT NULL DEFAULT false,
  "updated_at"              TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT "audio_tuning_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "audio_tuning_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "profiles"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- No index needed beyond the PK — every query is keyed by user_id which is
-- already the primary key.
