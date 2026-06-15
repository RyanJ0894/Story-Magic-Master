# Security & Quality — 2026-06-14

Synthesis of security-related findings from all three review parts. Not just "RLS" (this codebase uses Clerk + app-level scoping, not Supabase RLS) — broader: tenant isolation, race conditions, destructive-action UX, injection surfaces.

## CRITICAL

None.

## HIGH

### [NEW] DT-32-H-1 — Sub-account project list info leak

`packages/web/lib/services/projects.ts:44-77` returns every team-shared project (including `scriptText`) to sub-accounts even when they have no `ProjectAssignment` row. This contradicts PR #177's stated isolation guarantee — that PR + migration 0039 patched `withProjectAuth` (per-project read) but missed the dashboard list query.

**Impact:** sub-account user can enumerate project names, descriptions, page counts, and `scriptText` for projects they cannot open. Surface area = anyone given a team-member seat by a master account.

**Fix (15 LoC + test):**
```ts
where: {
  OR: [
    { userId },
    { teamShares: { some: { team: { ownerId: userId } } } },     // master/owner
    { AND: [                                                       // sub-account
      { teamShares: { some: { team: { members: { some: activeMemberWhere(userId) } } } } },
      { projectAssignments: { some: { userId } } },
    ]},
  ],
}
```
+ regression test in `packages/web/tests/unit/api/projects-route.test.ts`.

**Owner:** Sprint A, P0. Should ship before friendly cohort if any cohort tester is a sub-account.

### [CARRYOVER → re-graded HIGH] DT-30-M-1 — `subscriptions` desync from `profile.subscriptionTier`

3 routes update `profile.subscriptionTier` without an accompanying `subscriptions.upsert`:
- `app/api/admin/tier/route.ts:57-66`
- `app/api/referral/upgrade/route.ts:75-84`
- `app/api/admin/subscriptions/[subscriptionId]/route.ts:79,158`

With PR #196's `llm_call_log` cost-attribution now live, cost rollups join through `subscriptions` — so users provisioned via these 3 paths won't appear in tier-based usage dashboards. Now a real reporting bug.

**Fix:** `prisma.subscription.upsert({ where: { userId }, create: {...}, update: {...} })` after each `profile.update`.

### [CARRYOVER] PLAY-TOCTOU

Previously open. **STATUS UPDATE: this is now RESOLVED.** Direct inspection of `app/api/shares/access/[code]/play/route.ts:58-65` shows atomic UPDATE with `WHERE play_count < max_plays`. Update prior TODO accordingly — data-tier agent flagged as carryover but the agent didn't re-verify; the file does carry the fix.

## MEDIUM

### [CARRYOVER] CONTENT-LOG-RETENTION

`content_access_log` grows unbounded. `(project_id, created_at DESC)` index already in place, so retention is cheap:
```sql
DELETE FROM content_access_log WHERE created_at < NOW() - INTERVAL '90 days';
```
Wire in `packages/orchestrator/src/lib/cleanup.ts` daily.

### [CARRYOVER] DT-31-M-2 — Scene cache write predicate

Verify `lib/scene-cache.ts` upsert path uses `content_hash` in the WHERE clause to force cache-miss on regeneration. Not blocking; cascade now handled by 0040.

## LOW / Quality

### `safeUpdate` framework underused

`packages/web/lib/db/safe-write.ts` (H4 framework) exists and is well-documented but applied at only 2 call sites. Other `prisma.job.update` / `prisma.project.update` sites are guarded by prior `findFirst` or transactions; not unsafe per se, but the framework's value compounds with adoption. Recommend an audit pass when the next backend refactor PR lands.

### [NEW] DT-32-L-1 — `llm_call_log.project_id` is TEXT

Same class as DT-31-H-1 but lower-impact. Cost log should survive project deletion for retention reasons — so `ON DELETE SET NULL` rather than CASCADE:
```sql
ALTER TABLE llm_call_log ALTER COLUMN project_id TYPE UUID USING project_id::uuid;
ALTER TABLE llm_call_log ADD CONSTRAINT llm_call_log_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
```

### XSS / Injection Surface

Spot-checks pass:
- No custom `escapeHtml` found (per CLAUDE.md rule).
- `xss` library imported only in places where `dangerouslySetInnerHTML` is used.
- Zod schemas on all API inputs (including `webhooks/stripe` per spec).
- No raw `$queryRawUnsafe` template-string interpolation outside of migrations.
- Voice catalog sync is bounded — JSON file is in repo, can't ingest arbitrary content.

### Auth/Session

- Clerk JWT cookies (__session + __client_uat) validated server-side in middleware.
- `withProjectAuth` enforces three-path predicate including `projectAssignments.some` — this is the right policy. DT-32-H-1 is a single-call-site bug, NOT a systemic auth flaw.

## Priority Stack for Sprint A

1. **DT-32-H-1** (sub-account list leak) — P0 — 2 SP — ship before friendly cohort if cohort has sub-accounts
2. **DT-30-M-1** (`subscriptions` upsert × 3 routes) — P1 — 2 SP
3. **CONTENT-LOG-RETENTION** (cron) — P2 — 1 SP
4. **DT-32-L-1** (`llm_call_log` FK) — P2 — 1 SP
5. **`safeUpdate` audit** — P2 — 2 SP (audit-only; fixes per finding)

Total: 8 SP P0-P2 security/data work for Sprint A.
