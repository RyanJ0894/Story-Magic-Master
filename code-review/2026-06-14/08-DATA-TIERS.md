# Data Tiers Audit — 2026-06-14

**Scope:** Delta vs 2026-06-09. New on-disk migrations since last review: `0037_llm_call_log`, `0038_team_member_deactivation`, `0039_project_assignment`, `0040_pipeline_table_fks_and_activity_index`. Migrations 0037 and 0040 close the two highest-priority carryover items (DT-31-H-1 and the LLM cost-attribution backlog).

## Summary
- CRITICAL: 0
- HIGH: 1 NEW, 2 CARRYOVER
- MEDIUM: 2 CARRYOVER
- LOW: 2 NEW, 4 CARRYOVER

## Resolved since 2026-06-09

- **DT-31-H-1 — RESOLVED.** Migration `0040_pipeline_table_fks_and_activity_index` (a) deletes existing orphans across `mix_manifests`, `timelines`, `alignments`, `tts_stems`, `scene_renders`, `voice_map`; (b) converts `project_id` from `TEXT` → `UUID`; (c) adds `ON DELETE CASCADE ON UPDATE CASCADE` FK constraints; (d) the prod pre-flight audit recorded in the migration header (6 orphan rows in `prod.timelines`) confirms the bug existed and was fixed. Prisma schema (lines 1199–1324) now declares `projectId String @db.Uuid` + `project Project @relation(..., onDelete: Cascade)` on all six tables. ✅
- **DT-32-M-1 — RESOLVED.** Same migration adds `activity_logs_user_id_created_at_idx (user_id, created_at DESC)` for the PR #200 notification feed producer query pattern.
- **DT-31-L-1 (PR #196 verification) — partially RESOLVED.** `llm_call_log` table is in `0037_llm_call_log/migration.sql` with three sensible indexes — `(project_id, created_at DESC)`, `(operation, created_at DESC)`, `(created_at)`. Schema-level Prisma model declared at schema.prisma:1265–1283. Remaining sub-item: PRICING-table model-name alignment is application-layer and still needs cross-ref against `lib/llm-call-log.ts` (not blocking).

## HIGH Findings

### [NEW] DT-32-H-1 — `listProjects` does not honor `project_assignments` for sub-accounts (information leak in dashboard)

**Where:** `packages/web/lib/services/projects.ts:44-77` (function `listProjects`); called from `packages/web/app/api/projects/route.ts:33`.

**Issue:** Migration `0039_project_assignment` and `withProjectAuth` (middleware.ts:176-204) correctly require an explicit `ProjectAssignment` row for sub-account access to a single project. However, the dashboard listing query at `lib/services/projects.ts:44` only filters by:
```ts
OR: [
  { userId },
  { teamShares: { some: { team: { members: { some: activeMemberWhere(userId) } } } } },
],
```
There is no `projectAssignments` constraint. A sub-account therefore sees **every project shared with their team** in `/dashboard/projects`, including projects they cannot open (`withProjectAuth` 404s them). This is the exact information-disclosure surface PR #177 was meant to close at the DB query level — but only the single-project read path was patched.

Severity HIGH because (a) it surfaces project names, descriptions, page counts, and `scriptText` (selected in the query) to sub-accounts who were explicitly NOT assigned to those projects, and (b) it directly contradicts the cited PR #177 security fix.

**Fix:** Match the `withProjectAuth` three-path predicate. Replace the OR in `listProjects`:
```ts
return prisma.project.findMany({
  where: {
    OR: [
      { userId },
      // Master / team owner — broad team access
      { teamShares: { some: { team: { ownerId: userId } } } },
      // Sub-account — must have an explicit assignment
      {
        AND: [
          { teamShares: { some: { team: { members: { some: activeMemberWhere(userId) } } } } },
          { projectAssignments: { some: { userId } } },
        ],
      },
    ],
  },
  // ...
});
```
Add a regression test in `packages/web/tests/unit/api/projects-route.test.ts` covering: sub-account in a team with two shares, only one has a `ProjectAssignment` — list returns exactly that one.

### [CARRYOVER] PLAY-TOCTOU — play route TOCTOU on `max_plays`

Still open. Fix unchanged: atomic `$executeRaw` UPDATE with `WHERE play_count < max_plays`, check `rowCount`, 403 if zero.

### [CARRYOVER] DT-30-M-1 → re-graded HIGH — `admin/tier`, `upgrade`, `referral/upgrade` set `profile.subscriptionTier` without `subscriptions` upsert

Still open. With the cost-attribution arc (#196 / `llm_call_log`) now landed, the tier desync becomes a real reporting bug: cost rollups join through `subscriptions`, so users provisioned via the three routes won't show in tier-based usage dashboards. Fix unchanged: add `prisma.subscription.upsert(...)` after `profile.update` in each route.

## MEDIUM Findings

### [CARRYOVER] CONTENT-LOG-RETENTION — `content_access_log` no retention job

Still open. Index `(project_id, created_at DESC)` already exists, so a simple cron is cheap:
```sql
DELETE FROM content_access_log WHERE created_at < NOW() - INTERVAL '90 days';
```
Wire daily in `packages/orchestrator/src/lib/cleanup.ts`.

### [CARRYOVER] DT-31-M-2 — `SceneRender` cache must include `content_hash` in write-path WHERE predicate

Still application-layer; covered now that 0040 added the FK (project deletion cascades). Single residual risk: cache write must upsert with `content_hash` in the WHERE clause to force cache-miss on regeneration. Verify in PR #191's `lib/scene-cache.ts` upsert path.

## Backlog (LOW)

| ID | Severity | Title | Fix |
|----|----------|-------|-----|
| DT-32-L-1 | LOW [NEW] | `llm_call_log.project_id` is `TEXT` (not UUID) and has no FK to `projects(id)` | Migration: same pattern as 0040 — convert + add `ON DELETE SET NULL` (call log should survive project deletion for cost-history retention). Schema lines 1265–1283 also need `@db.Uuid`. |
| DT-32-L-2 | LOW [NEW] | `project_assignments.user_id` is `TEXT` (matches `profiles.id` which is also TEXT — consistent), but no compound index on `(team_id, user_id)` for the audit query "what is this user assigned to in this team?" | Add `CREATE INDEX "project_assignments_team_user_idx" ON "project_assignments"("team_id", "user_id");` if that query pattern appears in admin UI. |
| DT-31-L-1 | LOW [CARRYOVER] | PRICING table model-name alignment (now that #196 has merged) | Cross-ref keys in `packages/orchestrator/src/lib/llm-call-log.ts` against `select-director-model.ts` and `llm-client.ts`. Should all be slash-prefixed (`anthropic/claude-…`). |
| DT-31-L-2 | LOW [CARRYOVER] | Migration 0035 mass `ALTER COLUMN … TYPE TIMESTAMPTZ` without explicit `AT TIME ZONE 'UTC'` | Render Postgres session TZ is UTC so safe in prod; add USING clause for portability. |
| DT-27-2 | LOW [CARRYOVER] | Invite-accept TOCTOU | `$transaction` + catch P2002 |
| DT-27-5 | LOW [CARRYOVER] | Migration 0027 non-partial index | Recreate as partial `WHERE share_id IS NOT NULL` |

## Spot-checks performed

- **Ownership enforcement (web):** `withProjectAuth` enforces three-path predicate including `projectAssignments.some` for sub-accounts (middleware.ts:176–204). All `app/api/projects/[id]/**` routes use it. ✓
- **`safeUpdate` actually used:** `packages/web/lib/generation/processor.ts:99-117` wraps the two job-finalization writes that race against project deletion. Other `prisma.job.update` / `prisma.project.update` sites at processor.ts:172, 180, 285, 379, 405, 479, 553, 558, 629, 638 are NOT wrapped — but inspection shows they're either inside transactions or guarded by prior `findFirst` checks. **Not flagged; recommend follow-up audit** when next cleanup PR lands.
- **Voice catalog UNIQUE:** `VoiceCatalogEntry.voiceId` declared `@unique` (schema.prisma:1351). Backed at DB level by migration `0034_add_voice_catalog`. ✓
- **Sub-account public route check:** `/api/exchange`, `/api/writers/[writerId]` are public marketplace by design (filtered by `exchangeIsPublic`). `/api/enterprise/team-comments` is owner-only (`Team.ownerId = userId`). `/api/reader/library` scopes subscriptions by user-owned library. ✓
- **`prisma validate`** reported one warning about `directUrl` env-var resolution (`DIRECT_DATABASE_URL` not present in CLI shell) — config concern only, not a schema issue. Generated client at `packages/shared/src/generated/prisma/schema.prisma` is in sync. ✓
- **0040 cascade correctness:** All six pipeline tables use `ON DELETE CASCADE ON UPDATE CASCADE` matching every other Project-owned table. ✓
- **0039 cascades:** `project_assignments` cascades on `project`, `user`, and `team`; `assigned_by` uses `SET NULL` (correct — preserves audit trail when admin profile deleted). ✓

## Priority for Next PR

1. **DT-32-H-1** — patch `listProjects` to honor `projectAssignments` for sub-accounts. ~15 LoC + regression test. Closes the PR #177 isolation gap.
2. **DT-30-M-1 → HIGH** — `subscriptions.upsert` in the three tier-provisioning routes.
3. **PLAY-TOCTOU** — atomic guard.
4. **CONTENT-LOG-RETENTION** — wire daily cleanup cron.
5. **DT-32-L-1** — `llm_call_log` FK + UUID type (single migration, ON DELETE SET NULL).
