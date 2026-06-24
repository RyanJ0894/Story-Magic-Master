-- Cross-project per-scene cache of DirectorAgent output. The orchestrator
-- splits an incoming script into scenes (via extractSceneInfo), hashes each
-- scene block + model, and looks them all up here. If every scene hits, we
-- skip DirectorAgent entirely — director is the ~330 s tentpole on a cold
-- 10-page run. Partial misses still bypass the cache (no quality risk from
-- splicing) but populate it for next time.
--
-- content_hash is sha256(scene_text + '|' + model_id). Including the model
-- in the hash means a model upgrade naturally orphans the old entries —
-- no version column needed for keying.
--
-- TTL: prune on last_hit_at older than 30 days. The pruner is a separate
-- cron; the index is built here.

CREATE TABLE IF NOT EXISTS director_scene_cache (
    content_hash  TEXT PRIMARY KEY,
    model         TEXT NOT NULL,
    scene_json    JSONB NOT NULL,
    char_count    INTEGER NOT NULL,
    hit_count     INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_hit_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS director_scene_cache_last_hit_at_idx
    ON director_scene_cache (last_hit_at);
