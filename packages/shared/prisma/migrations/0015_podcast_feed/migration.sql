-- Migration 0015: Podcast Feed
-- Adds podcast_feeds table for audio-to-podcast RSS distribution (Issue #38)

CREATE TABLE IF NOT EXISTS "podcast_feeds" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "project_id"     UUID        NOT NULL,
  "episode_title"  TEXT        NOT NULL,
  "description"    TEXT        NOT NULL,
  "cover_art_url"  TEXT,
  "rss_feed_slug"  TEXT        NOT NULL,
  "published"      BOOLEAN     NOT NULL DEFAULT false,
  "published_at"   TIMESTAMPTZ,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "podcast_feeds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "podcast_feeds_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "podcast_feeds_project_id_key" UNIQUE ("project_id"),
  CONSTRAINT "podcast_feeds_rss_feed_slug_key" UNIQUE ("rss_feed_slug")
);

CREATE INDEX IF NOT EXISTS "podcast_feeds_project_id_idx"
  ON "podcast_feeds"("project_id");
