-- Migration 0012: Project Comments
-- Shared comments visible to all project collaborators (owner + TeamShare/ScriptShare members).
-- Distinct from project_notes (which are private per-user).

CREATE TABLE project_comments (
  id                 UUID         NOT NULL DEFAULT gen_random_uuid(),
  project_id         UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id            TEXT         NOT NULL,
  scene_index        INTEGER,
  audio_timestamp_ms INTEGER,
  body               TEXT         NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_project_comments PRIMARY KEY (id)
);

CREATE INDEX idx_project_comments_project_created ON project_comments (project_id, created_at DESC);
CREATE INDEX idx_project_comments_user ON project_comments (user_id);
