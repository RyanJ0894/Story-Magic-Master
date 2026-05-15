-- Migration: 0024_add_comment_reactions
-- Allow body to be null (reaction-only entries have no text)
-- Add reaction_type column: 'like' | 'dislike' | 'undecided' | NULL

ALTER TABLE "project_comments" ALTER COLUMN "body" DROP NOT NULL;
ALTER TABLE "project_comments" ADD COLUMN IF NOT EXISTS "reaction_type" VARCHAR(20);

-- Index for fast per-user reaction lookup (partial — only rows with a reaction)
CREATE INDEX IF NOT EXISTS "project_comments_project_id_scene_idx_reaction_idx"
  ON "project_comments" ("project_id", "scene_index", "reaction_type")
  WHERE "reaction_type" IS NOT NULL;
