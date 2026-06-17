# Review Correction — 2026-06-17

The 2026-06-16 review carried four items as Sprint A carryovers that were already RESOLVED in code. This note corrects the record. The TODO and SPRINT_PLAN are updated accordingly.

## Carryovers re-graded as RESOLVED

### PLAY-TOCTOU — RESOLVED (2026-06-14, reconfirmed today)

**Where:** `packages/web/app/api/shares/access/[code]/play/route.ts:58-65`

```sql
UPDATE script_shares
SET play_count = play_count + 1,
    last_accessed_at = NOW()
WHERE id = ${share.id}::uuid
  AND (max_plays IS NULL OR play_count < max_plays)
```

Atomic guard. Zero-rows → 410 `PLAY_LIMIT_REACHED`. The race that motivated the finding is closed. The 2026-06-14 review explicitly noted this fix; the 2026-06-16 review failed to read the prior correction.

### CONTENT-LOG-RETENTION — RESOLVED

**Where:** `packages/orchestrator/src/lib/cleanup.ts:95-115`, scheduled at `cleanup.ts:173`.

```ts
const CONTENT_ACCESS_LOG_RETENTION_DAYS = 90;
export async function pruneContentAccessLog() { ... }
// startCleanupSchedule(): runCleanup() + void pruneContentAccessLog()
```

Shipped via the Sprint A "data polish" pass (#291). The 2026-06-14 review noted CONTENT-LOG-RETENTION as "no cleanup logic found"; that statement was true at the time but obsoleted three days later when #291 merged. The 2026-06-16 review missed the update.

### DT-30-M-1 — RESOLVED for 3 of 4 routes; gap in invite/[token] is owned by PR #302

**Where (resolved):** `packages/web/lib/services/tier-provision.ts::provisionTier()` — atomic + `Prisma.TransactionIsolationLevel.Serializable`. Wired into:
- `app/api/admin/tier/route.ts:45`
- `app/api/upgrade/route.ts:43`
- `app/api/referral/upgrade/route.ts:56`

**Where (still raw):** `app/api/invite/[token]/route.ts:232` — sets `subscriptionTier: 'creator'` via `profile.update` without touching `subscriptions`. **This is owned by PR #302** (in review with Peter), which actively edits this file to add `INVITE_DEFAULT_TIER=pro` plumbing. Cleanly merge-able with a single line change at PR #302 review time — recommend asking Peter to swap that block for `await provisionTier(prisma, { userId, tier: defaultTier, setProfileStatus: true })` while reviewing.

### VERIFY-DT-32-H-1 — VERIFIED

**Where:** `packages/web/lib/services/projects.ts:44-70` — `listProjects` honors `projectAssignments` for sub-accounts.

```ts
OR: [
  { userId },                                       // owner
  { teamMembers: { some: { userId } } },            // direct team member (full access)
  { projectAssignments: { some: { userId } } },     // sub-account with explicit assignment
]
```

Test coverage: `tests/unit/lib/projects-service-list.test.ts` (12 cases) added in #289.

No other entry points found. The sub-account isolation pattern is consistent across the codebase.

## Sprint A actually-remaining (after correction)

| ID | SP | Status |
|----|----|----|
| UX-I-01 | 1.5 | **IN PROGRESS** — PR #315 open |
| TEST-A-01 | 1 | ALREADY COVERED — `scene-cache.test.ts:103-160` |
| TEST-A-02 | 1 | Folded into PR #315 (7 new component tests) |
| T-01 voice-ID | 1 | BLOCKED on Ryan |
| T-03 resolveModel | 1 | NO-OP — already mitigated with eslint-disable + documented reason at `providers.ts:62-63` |
| DT-30-M-1 | 3 | **3/4 routes RESOLVED**; invite/[token] gap owned by PR #302 review |
| PLAY-TOCTOU | 2 | RESOLVED |
| CONTENT-LOG-RETENTION | 1 | RESOLVED |
| VERIFY-DT-32-H-1 | 1 | RESOLVED (verified) |

**Net actually-remaining for Sprint A: 0 SP** (assuming PR #315 lands, PR #302 reviewer applies the one-line `provisionTier` swap, and Ryan picks a voice).

## Sprint B unchanged

| ID | SP |
|----|----|
| T-02 / T-04 / T-05 typing polish | 5 |
| UX-I-02 / 03 / 04 / 05 audio-tuning polish | 2 |

Total Sprint B: 7 SP.

## Why the 2026-06-16 review missed these

The Data-Tier subagent ran with a prompt that asked it to look at carryover items from `code-review/2026-06-14/08-DATA-TIERS.md` but didn't ask it to re-read the prior **executive summary**, which is where the late-arriving "PLAY-TOCTOU RESOLVED" correction lived. Pattern to fix in future reviews: always read the prior executive summary first, then the dimensional findings docs.

## Action items

1. PR #315 — admin-merge or send to Peter (low risk, frontend only).
2. PR #302 — when reviewing, ask Peter to swap `invite/[token]:232` for `provisionTier(...)`.
3. Skip the rest of Sprint A — nothing to do.
4. Proceed to Sprint B at your discretion.
