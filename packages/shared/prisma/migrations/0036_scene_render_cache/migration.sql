-- Scene-level render cache (T2-2 of cost-opt Phase 2, issue #190)
--
-- Stores a content-hash → rendered scene path mapping so the orchestrator
-- pipeline can short-circuit alignment + cue + timeline + mix work when a
-- scene's content has not changed since its last render.

CREATE TABLE "scene_renders" (
    "project_id"   TEXT        NOT NULL,
    "scene_id"     TEXT        NOT NULL,
    "content_hash" TEXT        NOT NULL,
    "scene_path"   TEXT        NOT NULL,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_renders_pkey" PRIMARY KEY ("project_id", "scene_id")
);

-- Future-proofing: cross-project reuse on content_hash. Cheap to add now;
-- expensive to backfill later if we want it.
CREATE INDEX "scene_renders_content_hash_idx" ON "scene_renders"("content_hash");
