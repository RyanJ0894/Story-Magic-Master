-- Migration: Add training data fields to script_corpus, add corpus_score table

-- Add training dataset fields to script_corpus
ALTER TABLE "script_corpus"
  ADD COLUMN IF NOT EXISTS "script_text"         TEXT,
  ADD COLUMN IF NOT EXISTS "dataset_category"    TEXT,
  ADD COLUMN IF NOT EXISTS "act1_break_page"     INTEGER,
  ADD COLUMN IF NOT EXISTS "act2_break_page"     INTEGER,
  ADD COLUMN IF NOT EXISTS "dialogue_pct"        DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "scene_count"         INTEGER,
  ADD COLUMN IF NOT EXISTS "conflict_density"    DECIMAL(5,3),
  ADD COLUMN IF NOT EXISTS "emotional_arc_score" DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS "page_count"          INTEGER,
  ADD COLUMN IF NOT EXISTS "pdf_filename"        TEXT;

-- Index for fast category lookups
CREATE INDEX IF NOT EXISTS "script_corpus_dataset_category_idx"
  ON "script_corpus"("dataset_category");

-- Create corpus_score table
CREATE TABLE IF NOT EXISTS "corpus_score" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "corpus_script_id" UUID         NOT NULL,
  "model_version"    TEXT         NOT NULL,
  "overall_score"    DECIMAL(4,2) NOT NULL,
  "concept_score"    DECIMAL(4,2) NOT NULL,
  "structure_score"  DECIMAL(4,2) NOT NULL,
  "character_score"  DECIMAL(4,2) NOT NULL,
  "craft_score"      DECIMAL(4,2) NOT NULL,
  "dimensions"       JSONB        NOT NULL,
  "strengths"        TEXT[]       NOT NULL DEFAULT '{}',
  "weaknesses"       TEXT[]       NOT NULL DEFAULT '{}',
  "confidence"       DECIMAL(4,2) NOT NULL,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "corpus_score_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corpus_score_corpus_script_id_fkey"
    FOREIGN KEY ("corpus_script_id")
    REFERENCES "script_corpus"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "corpus_score_corpus_script_id_idx"
  ON "corpus_score"("corpus_script_id");

CREATE INDEX IF NOT EXISTS "corpus_score_model_version_idx"
  ON "corpus_score"("model_version");
