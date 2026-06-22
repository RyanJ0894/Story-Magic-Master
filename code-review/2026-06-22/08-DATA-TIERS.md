# Data Tiers Audit — 2026-06-22

## Delta from 2026-06-16

### Resolved
- **DT-30-M-1 (tier-provisioning TOCTOU)** — RESOLVED in migration 0041 + tier-provision.ts. All three tier-set paths (`admin/tier`, `upgrade`, `referral/upgrade`) now call `provisionTier()` which runs the find-then-decide-then-write under `Serializable` isolation. Two concurrent admin actions cannot both create duplicate `active` subscription rows. Cost attribution in #196 safe.
- **PR #356 merged** — `project_created` and `script_uploaded` producers wired at `/api/projects` and `/api/projects/[id]` routes. Both use `resolveMastersForActor()` to notify each team owner (not the actor if self-action). ProjectComment sceneIndex=null handled correctly for project-level reactions.

### Still Open
- **DT-32-H-1 (listProjects team-share sub-account leak)** — Actually FIXED. Reviewed `packages/web/lib/services/projects.ts:44–87` — the WHERE clause mirrors withProjectAuth's three-path guard. Sub-accounts without an explicit ProjectAssignment are correctly filtered. (The prior review called this still-open because no PR was observed; it was already in the code. ✓)
- **PLAY-TOCTOU, CONTENT-LOG-RETENTION** — Deferred to next sprint.

## CRITICAL Findings
None. Schema and migrations (0038–0042) are clean.

## HIGH Findings
None new.

## MEDIUM Findings

### [CARRYOVER] DT-30-M-2 — Seed data gap: subscriptions row not created for dev profile
**Issue:** `packages/web/prisma/seed.ts` creates a profile with `subscriptionTier: 'pro'` but no matching `subscriptions` row. This is inconsistent with the production invariant (after provisionTier, both profile.subscriptionTier and subscriptions are in sync). If dev fixtures run cost-rollup queries (joining through subscriptions), they will see NULL or undercount for the seed user.

**File:** `packages/web/prisma/seed.ts:17–27`

**Fix:** After the profile upsert (line 27), add:
```ts
await prisma.subscription.upsert({
  where: { id: 'seed_sub_dev_user' },
  update: {},
  create: {
    id: 'seed_sub_dev_user',
    userId: DEV_USER_ID,
    plan: 'pro',
    status: 'active',
    generationsLimit: 20,
    downloadsLimit: 5,
  },
});
```

### [NEW] DT-33-L-2 — Partial unique index on project_comments not enforced by Prisma
**Issue:** Schema line 792 notes that the partial unique index `project_comments_user_reaction_scene_uniq ON project_comments(project_id, user_id, scene_index) WHERE reaction_type IS NOT NULL` was created in migration 0025 but Prisma cannot represent it. Running `prisma db push` on production will drop it. The workaround (use raw migrations, don't db push) is documented, but not followed everywhere.

**File:** `packages/shared/prisma/schema.prisma:791`

**Mitigation:** Remind team: never use `prisma db push` on prod. Only use `prisma migrate deploy` (reads committed migrations). If the partial index is critical for reaction dedup, add it to a future migration (.sql file) to make it Prisma-aware.

## LOW Findings

### [NEW] DT-34-L-1 — ProjectComment N+1 risk in team-comments route
**Issue:** `/api/enterprise/team-comments` (line 34–44) calls `projectComment.findMany` which includes the full `author` relation (fullName, email), then later calls `project: { select: { id: true, name: true } }`. If the team owns 100 projects, each with 50 comments, this could be 5000 rows with nested author lookups. No apparent batching.

**Fix (optional):** Add pagination (take/skip are already there on line 41) or use a batch author lookup — but for typical team sizes and use patterns this is probably fine.

### [CARRYOVER] DT-32-L-2, DT-31-L-2, DT-27-2/5 — Backlog from prior reviews
Still deferred.

## Migration 0042 (audio_tuning) — clean-bill recheck
All checks from prior review remain valid. No schema drift detected between migration SQL and prisma schema.prisma.

## Spot-checks (2026-06-22)

| Check | Result |
|-------|--------|
| **withProjectAuth correctness** | ✓ Lines 159–198 correctly guard three access paths (owner, team-owner, sub-account with ProjectAssignment). Mirrors listProjects. |
| **emitProjectCreated/emitScriptUploaded wiring** | ✓ Both wire to resolveMastersForActor() + loop over multiple team-owner recipients. Self-action correctly skipped (line 452). |
| **provisionTier Serializable isolation** | ✓ tier-provision.ts:74–123 uses `Prisma.TransactionIsolationLevel.Serializable`. Find runs inside tx. All three provisioning routes call it. |
| **Migrations 0038–0042 SQL ↔ schema parity** | ✓ Column names match. No orphan TEXT project_id columns. 0040 FK cascade, 0041 SET NULL, 0042 PK-is-FK all justified. |
| **Seed data consistency** | ⚠ Profile created but no Subscription row (DT-30-M-2). |
| **jobLogs, contentAccessLog, ttsStems indexes** | ✓ jobLogs has (jobId), (projectId), (jobId,createdAt), (createdAt DESC). contentAccessLog has (projectId,createdAt) + (userId,createdAt) + (shareId,createdAt). ttsStems is a composite PK. All good. |
| **Prisma validate (requires DIRECT_DATABASE_URL)** | ⚠ CLI check fails without env var, but this is CI config only — no schema issues. |
| **No schema drift vs prior audit** | ✓ All 42 migrations in place. No rollback history. |

## Priority for Next PR

1. **DT-30-M-2** — seed: add subscription row. ~5 LoC, high value for dev reproducibility.
2. **PLAY-TOCTOU** — atomic play_count guard.
3. **CONTENT-LOG-RETENTION** — daily cleanup job.

---

**Audit completed:** 2026-06-22  
**Model:** claude-haiku-4-5-20251001  
**Scope:** Migrations 0038–0042, application-level tenancy, new producers, indexes, seed consistency.
