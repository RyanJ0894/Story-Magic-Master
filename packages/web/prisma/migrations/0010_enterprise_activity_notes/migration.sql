-- Migration: 0010_enterprise_activity_notes
-- Adds ActivityLog and ProjectNote tables for Enterprise Master Account feature.

-- ActivityLog: tracks all meaningful sub-user actions within a team
CREATE TABLE "activity_logs" (
    "id"          UUID      NOT NULL DEFAULT gen_random_uuid(),
    "team_id"     UUID      NOT NULL,
    "user_id"     TEXT      NOT NULL,
    "project_id"  UUID      NOT NULL,
    "event_type"  TEXT      NOT NULL,
    "metadata"    JSONB     NOT NULL DEFAULT '{}',
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_logs_team_id_created_at_idx"  ON "activity_logs"("team_id", "created_at" DESC);
CREATE INDEX "activity_logs_team_id_user_id_idx"     ON "activity_logs"("team_id", "user_id");
CREATE INDEX "activity_logs_team_id_project_id_idx"  ON "activity_logs"("team_id", "project_id");
CREATE INDEX "activity_logs_user_id_project_id_idx"  ON "activity_logs"("user_id", "project_id");

ALTER TABLE "activity_logs"
    ADD CONSTRAINT "activity_logs_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activity_logs"
    ADD CONSTRAINT "activity_logs_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProjectNote: per-user, per-line notes for the screenplay-style audio player
CREATE TABLE "project_notes" (
    "id"          UUID      NOT NULL DEFAULT gen_random_uuid(),
    "project_id"  UUID      NOT NULL,
    "author_id"   TEXT      NOT NULL,
    "line_id"     TEXT,
    "timestamp"   INTEGER,
    "note_text"   TEXT      NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_notes_project_id_idx"        ON "project_notes"("project_id");
CREATE INDEX "project_notes_author_id_idx"          ON "project_notes"("author_id");
CREATE INDEX "project_notes_project_id_author_idx"  ON "project_notes"("project_id", "author_id");

ALTER TABLE "project_notes"
    ADD CONSTRAINT "project_notes_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_notes"
    ADD CONSTRAINT "project_notes_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
