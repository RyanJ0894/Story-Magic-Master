# Data Tiers Audit — 2026-06-09

**Scope:** Delta vs 2026-06-03. New on-disk migrations since last review: `0035_timestamps_to_timestamptz`, `0036_scene_render_cache`. Per task brief, migrations 0034 (team_member_deactivation, PR #173), 0037 (llm_call_log, PR #196) **were named in the prompt but are not present on `main`** — their PRs are still open. `packages/orchestrator/src/lib/llm-call-log.ts` does **not exist** on `main`, so PRICING-table cross-reference can't be performed against merged code (will need re-audit after #196 lands).

## Delta Summary

- **Resolved since 2026-06-03 (5):**
  - DT-29-NEW-2 — `Purchase.userId/projectId` now `onDelete: SetNull` (schema:299–300) via migration `0033_fk_cascade_gdpr_set_null`.
  - DT-29-2/3 — `ScriptShare.sharedBy/sharedWith` now `onDelete: SetNull` (schema:376–377).
  - DT-30-H-1 — `TeamShare.sharedBy` now `onDelete: SetNull` (schema:810).
  - DT-29-1 — Corpus export bounded `take: 500` (`admin/corpus/export/route.ts:17`).
  - DT-30-C-1 — admin/stats raw SQL snake_case fix shipped previous review.
- **Carryover (4):** PLAY-TOCTOU, CONTENT-LOG-RETENTION, DT-27-2/4/5, DT-29-4/5, DT-30-M-1.
- **New (4):** DT-31-H-1 (pipeline tables no FK + orphan accumulation), DT-31-M-1 (`project_id` index missing on pipeline tables), DT-31-M-2 (`SceneRender` has no `Project` relation in Prisma — orphan on project delete), DT-31-L-1 (PR #196 prep — llm_call_log not yet on `main`).

## CRITICAL Findings

_None._ All previously CRITICAL items (DT-30-C-1 admin/stats casing, FK cascade GDPR blockers) are resolved.

## HIGH Findings

### [NEW] DT-31-H-1 — Pipeline tables store `project_id` as TEXT with no FK → orphan rows on project deletion

**Where:** `packages/shared/prisma/schema.prisma:1167–1222` (`Timeline`, `Alignment`, `TtsStem`, `SceneRender`); migration `0030_orchestrator_pipeline_tables/migration.sql`; migration `0036_scene_render_cache/migration.sql:7–15`.

**Issue:** `Project.id` is `UUID` (schema:87). `tts_stems`, `timelines`, `alignments`, `scene_renders` declare `project_id TEXT NOT NULL` with **no FOREIGN KEY** and no Prisma `@relation` to `Project`. When a user deletes a project, the `Project` row Cascades through `audio_outputs`/`jobs`/etc. but pipeline state rows and the new `scene_renders` cache entries are **left orphaned**. For `scene_renders` this is worse than waste: a future project that happens to reuse the same `(projectId, sceneId)` (admin restore from backup, test seeds) would hit stale cache and short-circuit rendering with the prior project's `scene_path`.

**Fix:** Add FK in a new migration. Type mismatch (TEXT vs UUID) means a cast-and-add:
```sql
-- migration 0037_pipeline_tables_project_fk
ALTER TABLE "scene_renders" ALTER COLUMN "project_id" TYPE UUID USING project_id::uuid;
ALTER TABLE "scene_renders"
  ADD CONSTRAINT "scene_renders_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;
-- Repeat for tts_stems, timelines, alignments, mix_manifests, voice_map.
```
And in `schema.prisma`, add `project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)` to each model, change `projectId String` → `projectId String @db.Uuid`.

## MEDIUM Findings

### [NEW] DT-31-M-1 — Missing `project_id` index on high-volume pipeline tables

**Where:** `tts_stems`, `timelines`, `alignments`, `scene_renders`.

**Issue:** Each table's PK starts with `project_id`, so prefix-scan lookups by `project_id` alone are technically covered, but any `WHERE project_id = ? ORDER BY created_at DESC` (cleanup job, admin queries) cannot use the composite PK efficiently after the first column. `scene_renders` has only `(project_id, scene_id)` PK + `content_hash` idx — fine. `tts_stems`/`timelines`/`alignments` are fine for current access patterns. **Verdict: DOWNGRADE to LOW** — composite-PK prefix scans suffice; flagging only because the cleanup retention job (when added) will benefit from an explicit `(project_id, created_at)` index on `content_access_log` (already exists, line 438) — pipeline tables don't need it yet.

### [NEW] DT-31-M-2 — `SceneRender` cache has no cache-invalidation hook on project content change

**Where:** `packages/shared/prisma/schema.prisma:1212–1222`; cache write logic in scene-render code.

**Issue:** Cache is keyed on `(projectId, sceneId)` + `content_hash` validation token. If the orchestrator ever writes the new row **without** updating `content_hash` on regeneration (e.g., bug, partial write, manual SQL), stale `scene_path` will be served. Pair with DT-31-H-1: no FK means even a project deletion + re-create with same ID would hit the cache.

**Fix:** This is application-layer — verify the upsert in the scene-render write path uses `content_hash` as part of the WHERE predicate (not just `(projectId, sceneId)`), so a mismatch forces re-render. The schema is fine; the test plan in PR #191 should include "delete project, recreate same project, ensure cache miss".

### [CARRYOVER] DT-30-M-1 — `admin/tier` + `upgrade` + `referral/upgrade` set `profile.subscriptionTier` without `subscriptions` upsert

Still open. Fix unchanged: add `prisma.subscription.upsert(...)` after `profile.update` in each of the three routes.

### [CARRYOVER] CONTENT-LOG-RETENTION — `content_access_log` no retention job

Still open. Existing `(projectId, createdAt DESC)` index makes a retention DELETE cheap. Fix:
```sql
DELETE FROM content_access_log WHERE created_at < NOW() - INTERVAL '90 days';
```
Wire as a daily cron in `packages/orchestrator/src/lib/cleanup.ts`.

### [CARRYOVER] PLAY-TOCTOU — play route TOCTOU on `max_plays`

Still open. Fix unchanged (atomic `$executeRaw` UPDATE w/ `WHERE play_count < max_plays` guard, check `rowCount`).

## Backlog (LOW)

| ID | Severity | Title | Fix |
|----|----------|-------|-----|
| DT-31-L-1 | LOW [NEW] | PR #196 `llm_call_log` not yet on `main` — cannot verify PRICING table model-name alignment | After merge: cross-ref PRICING keys against `select-director-model.ts:72,84` (`anthropic/claude-sonnet-4-6`, `anthropic/claude-haiku-4-5`) and `llm-client.ts:127` (`openai/gpt-4.1`). All names should be the slash-prefixed provider form, not raw Anthropic ids. |
| DT-31-L-2 | LOW [NEW] | Migration 0035 mass `ALTER COLUMN ... TYPE TIMESTAMPTZ` without explicit `USING ... AT TIME ZONE 'UTC'` clause | PostgreSQL infers UTC if the session timezone is UTC. Render Postgres is UTC — safe in prod. Add `USING "<col>" AT TIME ZONE 'UTC'` for portability. Not blocking. |
| DT-27-2 | LOW [CARRYOVER] | Invite-accept TOCTOU | `$transaction` + catch P2002 |
| DT-27-4 | LOW [CARRYOVER] | `ensureProfile` email backfill overwrites | Gate on null check |
| DT-27-5 | LOW [CARRYOVER] | Migration 0027 non-partial index | Recreate as partial `WHERE share_id IS NOT NULL` |
| DT-29-4 | LOW [CARRYOVER] | ImpactStory `viewCount` dedup | Redis SETNX |
| DT-29-5 | LOW [CARRYOVER] | Orchestrator schema mirror drift | CI diff check (generated client in `packages/shared/src/generated/prisma/schema.prisma` is in sync as of this audit — keep monitoring) |

## Spot-checks performed

- **Ownership enforcement (web):** `app/api/projects/[id]/route.ts` uses `withProjectAuth` wrapper (GET, DELETE). `app/api/admin/users/route.ts` uses `withAdminAuth`. Pattern consistent across `app/api/admin/*`. ✓
- **Ownership enforcement (orchestrator):** All mutation routes (`generate-scenes`, `orchestrate`, `stitch-segments`, `analyze`, `preview`, `impact`, `stems`) wired through `serviceAuthMiddleware` in `src/index.ts:107–122`. `/download/:project_id/:filename` uses user-level `authMiddleware` (line 125) with existing IDOR/path-traversal guards. ✓
- **Generated Prisma drift:** `packages/shared/src/generated/prisma/schema.prisma` includes `SceneRender` model — in sync with source schema. ✓
- **Migration 0035 view dependency:** Drops + recreates `recent_job_errors` and `queue_stats` views before/after `ALTER COLUMN` — correct. ✓
- **Cost-opt cascade survival (#171/#173/#191/#196):** PR #171 not relevant to schema; #173 + #196 not yet merged. PR #191 (`scene_renders`) is standalone — does not interfere with existing `onDelete: SetNull` rules from migration 0033. ✓

## Priority for Next PR

1. **DT-31-H-1** — pipeline tables FK + UUID type fix (single migration 0037, blocks orphan accumulation + scene_renders cache poisoning risk).
2. **CONTENT-LOG-RETENTION** — wire daily cleanup cron.
3. **PLAY-TOCTOU** — atomic guard.
4. **DT-30-M-1** — `subscriptions.upsert` in tier provisioning routes.
5. After PR #196 lands — re-audit `llm_call_log` indexes + PRICING name alignment (DT-31-L-1).
