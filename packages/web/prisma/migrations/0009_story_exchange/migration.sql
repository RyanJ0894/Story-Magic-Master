-- Story Exchange: exchange listing fields, script reviews, writer subscriptions

-- Exchange listing fields on projects
ALTER TABLE "projects"
  ADD COLUMN "exchange_is_public"    BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN "exchange_listed_at"    TIMESTAMPTZ,
  ADD COLUMN "exchange_slug"         TEXT,
  ADD COLUMN "exchange_tagline"      TEXT,
  ADD COLUMN "exchange_genre"        TEXT,
  ADD COLUMN "page1_preview_url"     TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "projects_exchange_slug_key" ON "projects"("exchange_slug");
CREATE INDEX IF NOT EXISTS "projects_exchange_is_public_exchange_listed_at_idx"
  ON "projects"("exchange_is_public", "exchange_listed_at" DESC);

-- Script reviews (reviewer feedback on listed scripts)
CREATE TABLE "script_reviews" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "project_id"     UUID        NOT NULL,
  "reviewer_id"    TEXT        NOT NULL,
  "reviewer_name"  TEXT,
  "verdict"        TEXT        NOT NULL DEFAULT 'consider',
  "numeric_rating" INTEGER,
  "comment"        TEXT,
  "is_anonymous"   BOOLEAN     NOT NULL DEFAULT false,
  "is_public"      BOOLEAN     NOT NULL DEFAULT true,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "script_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "script_reviews_project_id_reviewer_id_key" UNIQUE ("project_id", "reviewer_id"),
  CONSTRAINT "script_reviews_project_id_fkey" FOREIGN KEY ("project_id")
    REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "script_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id")
    REFERENCES "profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "script_reviews_project_id_idx" ON "script_reviews"("project_id");
CREATE INDEX IF NOT EXISTS "script_reviews_reviewer_id_idx" ON "script_reviews"("reviewer_id");

-- Writer subscriptions (follow a writer)
CREATE TABLE "writer_subscriptions" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "subscriber_id" TEXT        NOT NULL,
  "writer_id"     TEXT        NOT NULL,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "writer_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "writer_subscriptions_subscriber_id_writer_id_key" UNIQUE ("subscriber_id", "writer_id"),
  CONSTRAINT "writer_subscriptions_subscriber_id_fkey" FOREIGN KEY ("subscriber_id")
    REFERENCES "profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "writer_subscriptions_writer_id_fkey" FOREIGN KEY ("writer_id")
    REFERENCES "profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "writer_subscriptions_writer_id_idx" ON "writer_subscriptions"("writer_id");
CREATE INDEX IF NOT EXISTS "writer_subscriptions_subscriber_id_idx" ON "writer_subscriptions"("subscriber_id");
