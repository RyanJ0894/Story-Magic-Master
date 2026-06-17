# Data Tiers Audit — 2026-06-16

**Scope:** Delta vs 2026-06-14. New on-disk migrations since last review:
- `0041_llm_call_log_project_fk` — closes prior backlog DT-32-L-1.
- `0042_audio_tuning` — new user-scoped per-user audio mix tuning table (B-001).

## Summary
- CRITICAL: 0
- HIGH: 0 NEW (1 CARRYOVER — DT-32-H-1 `listProjects` from 2026-06-14)
- MEDIUM: 0 NEW (2 CARRYOVER)
- LOW: 1 NEW, 3 CARRYOVER

## Resolved since 2026-06-14

- **DT-31-H-1 (pipeline TEXT project_id) — RESOLVED.** Confirmed closed by migration `0040_pipeline_table_fks_and_activity_index` (prior review). `packages/orchestrator/src/orchestrator/workers/parallel-tts.ts:226` and `tts.ts:103` already cast `${project_id}::uuid` on insert, so app and schema are aligned. No remaining raw-TEXT `project_id` columns in `packages/orchestrator/src`.
- **DT-32-L-1 (llm_call_log TEXT project_id, no FK) — RESOLVED.** Migration `0041_llm_call_log_project_fk` (a) NULLs out non-UUID and orphan rows before conversion (preserves cost telemetry), (b) `ALTER COLUMN project_id TYPE UUID USING ...::uuid`, (c) adds FK with `ON DELETE SET NULL ON UPDATE CASCADE`. Prisma schema lines 1278/1291 declare `projectId String? @db.Uuid` + optional relation with `onDelete: SetNull`. Indexes on `(project_id, created_at DESC)` etc. remain valid post-conversion. Choice of `SET NULL` (not `CASCADE`) is correct — cost-rollup history must survive project deletion. ✓

## HIGH Findings

### [CARRYOVER] DT-32-H-1 — `listProjects` does not honor `project_assignments` for sub-accounts

Still open. Fix unchanged from 2026-06-14 review (add `projectAssignments: { some: { userId } }` AND-clause in the team-share branch of `packages/web/lib/services/projects.ts:44`). No PR observed in the 2026-06-14 → 2026-06-16 window touching this file.

## MEDIUM Findings

### [CARRYOVER] PLAY-TOCTOU — play route TOCTOU on `max_plays`
Still open.

### [CARRYOVER] CONTENT-LOG-RETENTION — `content_access_log` no retention job
Still open.

### [CARRYOVER] DT-30-M-1 (re-graded HIGH last round) — tier-provisioning routes skip `subscriptions` upsert
Still open. Now compounded: `llm_call_log` cost rollups join via `subscriptions` and 0041 hardens that path, so the desync becomes more visible in finance dashboards.

## LOW Findings

### [NEW] DT-33-L-1 — `audio_tuning.updated_at` does not auto-update at the DB layer

**Where:** `packages/shared/prisma/migrations/0042_audio_tuning/migration.sql:18` and schema.prisma:1405.

**Issue:** Column defaults to `NOW()` on INSERT, and Prisma's `@updatedAt` decorator handles UPDATEs via the application layer. This is functionally fine for the single writer path (`updateAudioTuning` upsert), but any direct-SQL touch (admin console, future bulk reset migration) will leave `updated_at` stale. The other timestamped tables in this schema (e.g. `projects`, `jobs`) use the same Prisma-only convention so this is consistent, not a regression — flagging only because a DB-level trigger would be cheap and the table will be small.

**Fix (optional, single-statement):**
```sql
CREATE OR REPLACE FUNCTION audio_tuning_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audio_tuning_touch_updated_at
  BEFORE UPDATE ON audio_tuning
  FOR EACH ROW EXECUTE FUNCTION audio_tuning_touch_updated_at();
```
Defer if you want to keep the schema convention consistent.

### [CARRYOVER] DT-32-L-2 — `project_assignments` missing `(team_id, user_id)` compound index
Still open if the admin "what is this user assigned to in this team" query ships.

### [CARRYOVER] DT-31-L-2 — Migration 0035 timestamptz conversions without explicit `USING ... AT TIME ZONE 'UTC'`
Still open; portability concern only.

### [CARRYOVER] DT-27-2 / DT-27-5 — invite-accept TOCTOU and Migration 0027 non-partial index
Still open.

## Audio Tuning (migration 0042) — clean-bill checks

| Check | Result |
|-------|--------|
| **Schema ↔ migration parity** | Match. `audio_tuning(user_id TEXT PK, music/ambience/sfx_gain_offset_db INT, narration_speed DOUBLE PRECISION, locked BOOLEAN, updated_at TIMESTAMPTZ)` exactly mirrors `model AudioTuning` at schema.prisma:1398–1410. ✓ |
| **FK to users (Profile)** | `audio_tuning_user_id_fkey REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE`. Profile.id is TEXT (Clerk userId) — type matches. ✓ |
| **Indexes** | None beyond PK. Justified — every read/write is keyed on `user_id` which is the PK. ✓ |
| **Unique constraints** | `PRIMARY KEY (user_id)` enforces one-row-per-user. Matches Prisma `@unique`-via-`@id`. ✓ |
| **Cascade-delete safety** | User deletion cascades the tuning row. Tuning is non-essential preference data; cascade is correct. ✓ |
| **User-scoping (GET/PATCH)** | `app/api/settings/audio-tuning/route.ts` uses `withAuth` and passes `userId` as the only scope — service layer (`lib/services/audio-tuning.ts::getAudioTuning`/`updateAudioTuning`) keys all queries on `userId`. No path for cross-user access. ✓ |
| **User-scoping (preview)** | `app/api/settings/audio-tuning/preview/route.ts:48-56` `findFirst` includes `userId` in the WHERE alongside the optional `requestedProjectId`. A sub-account cannot preview against another user's project, and cannot leak `directorJson` cross-tenant. ✓ |
| **Defaults persisted as zeros (not nulls)** | `DEFAULT 0` on all offsets, `1.0` on speed — matches `DEFAULT_AUDIO_TUNING` and the merge path in `updateAudioTuning` (no NULL-vs-0 ambiguity). ✓ |
| **Locked-flag semantics** | `locked=false` rows are correctly ignored by orchestrator path (`getLockedAudioTuning` returns `undefined`). The try/catch fallback there is intentional and documented. ✓ |
| **Scene-cache hash invalidation** | `lib/scene-cache.ts::computeSceneRenderHash` is documented to fold tuning values into the hash (see schema comment lines 1395–1397). Verify the wiring in PR review — out of scope for the SQL audit. |

## Other spot-checks

- `prisma validate` from `packages/shared`: passes (single unrelated warning about `DIRECT_DATABASE_URL` env-var resolution in CLI shell — config only). ✓
- New tables added across 0040/0041/0042 all have their FK columns indexed:
  - 0040: pre-existing per-table indexes on `(project_id, scene_id)` / `(project_id, ...)` cover the new FKs.
  - 0041: existing `llm_call_log_project_created_idx` covers the `project_id` FK side; index is still valid after the TEXT→UUID column rewrite.
  - 0042: PK IS the FK column. ✓
- No new raw `project_id TEXT` references introduced in 0041/0042. Grep of `packages/orchestrator/src` confirms casts to `::uuid` at all raw INSERT sites. ✓

## Priority for Next PR

1. **DT-32-H-1** — still the top item; ~15 LoC + regression test in `tests/unit/api/projects-route.test.ts`. (Carried over from 2026-06-14.)
2. **DT-30-M-1** — `subscriptions.upsert` after `profile.update` in `admin/tier`, `upgrade`, `referral/upgrade`.
3. **PLAY-TOCTOU** — atomic `UPDATE … WHERE play_count < max_plays` guard.
4. **CONTENT-LOG-RETENTION** — daily cleanup in `packages/orchestrator/src/lib/cleanup.ts`.
5. (Optional) **DT-33-L-1** — only if the admin console gains a direct-SQL writer for tuning.
