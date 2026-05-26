# Data Tiers Audit — 2026-05-26

**Scope:** Migrations 0022–0026 (Sprints H–N) + new share/play routes  
**Models Audited:** ScriptShare, ReaderLibrary, ContentAccessLog, AudioOutput, Alert, HumanReview  
**Prior Review:** `code-review/2026-05-19/08-DATA-TIERS.md`

---

## Carryover Status from 2026-05-19 Review

| Prior Finding | Status |
|---|---|
| ProjectComment.user_id missing FK | FIXED — migration 0025 |
| Reaction index name mismatch (0024 vs Prisma-expected) | FIXED — migration 0025 |
| Partial unique index for reaction race condition | FIXED — migration 0025 |
| Progressive playback partial index lost on migrate reset | FIXED — migration 0025 (re-assert) |
| Reaction upsert not wrapped in transaction | Status unknown — not re-verified in this cycle |
| AudioOutput jobId missing index | FIXED — migration 0026 |
| Alert (userId, isRead) composite index | FIXED — migration 0026 |
| HumanReview projectId index | FIXED — migration 0026 |

All carryover findings from the 2026-05-19 review are resolved in migrations 0025 and 0026.

---

## CRITICAL Findings

### [NEW] play/route.ts does not check `expiresAt` or `maxPlays` before incrementing
**Where:** `packages/web/app/api/shares/access/[code]/play/route.ts:39–54`

**Issue:** The play tracking endpoint queries the share with only `{ shareCode: code, isActive: true }`. It does not check `expiresAt` or `maxPlays`. An expired or play-limited share that is still `isActive: true` (i.e., has not been deactivated by a background job or an explicit `deactivate_all` call) will:

1. Have its `playCount` incremented beyond `maxPlays`.
2. Log rows in `content_access_log` for access that should have been denied.
3. Inflate analytics seen by the project owner.

The `accessShare()` service function (`lib/services/shares.ts:279–284`) does check both, but the play route bypasses it entirely.

**Fix:**
```typescript
// packages/web/app/api/shares/access/[code]/play/route.ts
const share = await prisma.scriptShare.findFirst({
  where: { shareCode: code, isActive: true },
  select: { id: true, projectId: true, playCount: true, expiresAt: true, maxPlays: true },
});

if (!share) {
  return errorResponse('Share not found', 404, { code: 'NOT_FOUND' });
}

// Guard: expired share
if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
  return errorResponse('Share has expired', 410, { code: 'EXPIRED' });
}

// Guard: play limit reached
if (share.maxPlays != null && share.playCount >= share.maxPlays) {
  return errorResponse('Play limit reached', 410, { code: 'PLAY_LIMIT' });
}
```

**Severity:** CRITICAL — Expired and play-limited shares remain playable; analytics data is polluted

---

### [NEW] playCount increment is non-atomic — race condition
**Where:** `packages/web/app/api/shares/access/[code]/play/route.ts:50–53`

**Issue:** The route reads `share.playCount` then writes `playCount: (share.playCount ?? 0) + 1`. Under concurrent play events (e.g., an autoplay retry, two simultaneous listeners, or a page reload), two reads can occur before either write completes, causing both to write the same value and losing one increment.

```typescript
// Current — non-atomic read-modify-write
data: { playCount: (share.playCount ?? 0) + 1 },
```

Prisma supports atomic increments natively.

**Fix:**
```typescript
// Replace with atomic increment — no read needed
await prisma.scriptShare.update({
  where: { id: share.id },
  data: { playCount: { increment: 1 }, lastAccessedAt: new Date() },
});
```

Also removes the now-unnecessary `playCount` field from the `select` clause in the `findFirst` call above. Note: `lastAccessedAt` is currently never updated by the play route — this fix closes that gap simultaneously.

**Severity:** CRITICAL — Under load, playCount undercounts; inaccurate engagement data delivered to owner dashboard

---

## HIGH Findings

### [NEW] ContentAccessLog has no index on `shareId`
**Where:** `packages/web/prisma/schema.prisma:415–437`, `packages/web/app/api/shares/access/[code]/play/route.ts:62–75`

**Issue:** The `content_access_log` table is written on every play and stream-position event. The play route and the reader library position route both write rows with a `shareId` FK. The schema declares two indexes on this table:

```
@@index([projectId, createdAt(sort: Desc)])
@@index([userId, createdAt(sort: Desc)])
```

There is no `@@index([shareId, createdAt])`. Any per-share analytics query (e.g., "show all plays for share X") requires a full table scan filtered to a single `share_id` value. As `content_access_log` grows (one row per play event across all shares), this will degrade progressively.

**Fix:**

Migration:
```sql
-- New migration: 0027_content_access_log_share_index
CREATE INDEX IF NOT EXISTS "content_access_log_share_id_created_at_idx"
  ON "content_access_log"("share_id", "created_at" DESC)
  WHERE "share_id" IS NOT NULL;
```

Schema addition to `ContentAccessLog`:
```prisma
@@index([shareId, createdAt(sort: Desc)])
```

**Severity:** HIGH — Per-share analytics queries are unbounded table scans; degrades linearly as play volume grows

---

### [NEW] ContentAccessLog has no retention/cleanup strategy — table is unbounded
**Where:** `packages/web/app/api/shares/access/[code]/play/route.ts`, `packages/web/app/api/reader/library/[entryId]/position/route.ts`

**Issue:** Every call to either route appends a row to `content_access_log` with no maximum age, partition, or purge mechanism. The position route fires on every playback position save (which can be called multiple times per session). There is no scheduled cleanup job, no TTL column, and no mention of this table in the queue worker's cleanup cycle (`lib/queue/worker.ts`).

For enterprise clients with active sharing, this table will grow continuously. At 1,000 plays/day it reaches ~365,000 rows/year. At enterprise scale (10 concurrent productions) it reaches ~3.6M rows/year with no floor.

**Fix (two-part):**

1. Add a retention policy migration:
```sql
-- New migration: 0027 (append to shareId index migration above)
-- Rows older than 2 years are outside any reasonable analytics window
-- A pg_cron job or application cron should run this monthly:
-- DELETE FROM content_access_log WHERE created_at < NOW() - INTERVAL '2 years';
```

2. Add to `lib/queue/service.ts` (alongside `cleanupExpiredLocks`):
```typescript
export async function cleanupOldAccessLogs(): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM content_access_log
    WHERE created_at < NOW() - INTERVAL '2 years'
  `;
  return result;
}
```

Call from `lib/queue/worker.ts` on the existing cleanup timer (already runs every 60 seconds — reduce to daily for this).

**Severity:** HIGH — Unbounded table growth with no floor; will cause query degradation and storage cost at enterprise scale

---

## MEDIUM Findings

### [NEW] `AccessType` in `lib/types/marketplace.ts` does not include values written by current routes
**Where:** `packages/web/lib/types/marketplace.ts:178`, `packages/web/app/api/shares/access/[code]/play/route.ts:32`, `packages/web/app/api/reader/library/[entryId]/position/route.ts:52`

**Issue:** The TypeScript `AccessType` union is:
```typescript
export type AccessType = 'stream_start' | 'stream_end' | 'download' | 'share_create' | 'share_click';
```

The two routes that write to `content_access_log` use values outside this union:
- `play/route.ts` writes `'play'` and `'complete'`
- `position/route.ts` writes `'stream'`

These are plain `String` columns in the Prisma schema (no DB enum), so they succeed at runtime. However, any TypeScript code that reads `ContentAccessLog.access_type` and narrows against `AccessType` will silently miss these values. The admin analytics dashboard, if it filters or switches on `AccessType`, will drop all play/complete/stream rows.

**Fix:**
```typescript
// packages/web/lib/types/marketplace.ts
export type AccessType =
  | 'stream_start'
  | 'stream_end'
  | 'stream'          // reader library position updates
  | 'download'
  | 'share_create'
  | 'share_click'
  | 'play'            // share play tracking
  | 'complete';       // share completion tracking
```

**Severity:** MEDIUM — Silent data loss in any consumer that narrows on `AccessType`; no DB-level impact

---

### [NEW] `ContentAccessLog` TypeScript interface is missing `ipAddress` and `userAgent` columns
**Where:** `packages/web/lib/types/marketplace.ts:180–192`

**Issue:** The `ContentAccessLog` interface exposes `user_id`, `project_id`, `share_id`, `access_type`, positional fields, `device_type`, and `created_at`. The Prisma schema (and therefore the database) also has `ip_address` and `user_agent` columns (set by `play/route.ts`). The TypeScript interface does not declare these. Any consumer reading a `ContentAccessLog` row via this type cannot access the IP or UA data, which are needed for geo-analytics and bot-detection.

**Fix:**
```typescript
export interface ContentAccessLog {
  id: string;
  user_id: string | null;
  project_id: string;
  share_id: string | null;
  access_type: AccessType;
  start_position_seconds: number | null;
  end_position_seconds: number | null;
  duration_seconds: number | null;
  ip_address: string | null;      // ADD
  user_agent: string | null;      // ADD
  device_type: 'mobile' | 'tablet' | 'desktop' | null;
  created_at: string;
}
```

**Severity:** MEDIUM — Missing fields in TS interface; analytics consumers cannot access IP/UA data

---

### [NEW] Redundant indexes on `shareCode` and `shareToken` in `ScriptShare`
**Where:** `packages/web/prisma/schema.prisma:351,352,377,378`, `packages/web/prisma/migrations/0002_add_missing_columns/migration.sql:16,19`

**Issue:** `ScriptShare` has both `@unique` and `@@index` on `shareCode`, and both `@unique` and `@@index` on `shareToken`. A `UNIQUE` constraint in PostgreSQL creates an implicit B-tree index automatically. The additional explicit `@@index` on the same column creates a second, identical index — wasting storage and degrading write performance.

- `@unique` on `shareCode` (line 352) → PostgreSQL creates `script_shares_share_code_key`
- `@@index([shareCode])` (line 378) → creates a duplicate `script_shares_share_code_idx`
- Same pattern for `shareToken` (lines 351, 377)

Migration 0002 even shows this explicitly: `CREATE UNIQUE INDEX ... share_code_key` followed immediately by `CREATE INDEX ... share_code_idx`.

**Fix (migration):**
```sql
-- New migration: 0027 (append)
DROP INDEX IF EXISTS "script_shares_share_code_idx";
DROP INDEX IF EXISTS "script_shares_share_token_idx";
```

**Fix (schema.prisma) — remove the two redundant `@@index` declarations:**
```prisma
// Remove these two lines from ScriptShare:
@@index([shareToken])   // line 377 — @unique already creates this index
@@index([shareCode])    // line 378 — @unique already creates this index
```

**Severity:** MEDIUM — Redundant indexes waste ~2× write overhead on a high-write share path; no data correctness impact

---

### [NEW] Seed data covers no share tables or access logs
**Where:** `packages/web/prisma/seed.ts`

**Issue:** `seed.ts` creates users, projects, and jobs, but does not seed `script_shares`, `reader_library`, or `content_access_log`. New developers running `pnpm prisma db seed` will have no share data to test share-dashboard, bulk-share, or play-tracking flows locally. The share dashboard at `/api/projects/[id]/shares` will always return empty arrays, making local development of the owner analytics view impossible without manual SQL.

**Fix:** Add a seed block to `prisma/seed.ts` after existing project creation:
```typescript
// Seed one share per seeded project
const share = await prisma.scriptShare.create({
  data: {
    projectId: project.id,
    sharedBy: userId,
    accessLevel: 'stream',
    recipientEmail: 'reader@example.com',
    recipientName: 'Test Reader',
    playCount: 3,
    viewCount: 5,
  },
});

await prisma.contentAccessLog.createMany({
  data: [
    { projectId: project.id, shareId: share.id, accessType: 'play' },
    { projectId: project.id, shareId: share.id, accessType: 'complete' },
  ],
});
```

**Severity:** MEDIUM — DX gap; no data correctness impact in production

---

## LOW Findings

### [NEW] `play/route.ts` does not update `lastAccessedAt` on share
**Where:** `packages/web/app/api/shares/access/[code]/play/route.ts:50–53`

**Issue:** `ScriptShare` has a `lastAccessedAt` column tracked for the owner dashboard (returned in `GET /api/projects/[id]/shares`). The play route increments `playCount` but never sets `lastAccessedAt`. Owners see `lastAccessedAt: null` on shares that have been played.

This is a two-character fix once the atomic increment from CRITICAL finding #2 is applied:
```typescript
data: { playCount: { increment: 1 }, lastAccessedAt: new Date() },
```

**Severity:** LOW — Dashboard shows stale `null` for last access time; no data integrity impact

---

## Migration Correctness: Migrations 0022–0026

| Migration | Schema Match | Issues |
|---|---|---|
| 0022 | PASS | All columns, FKs, and indexes match schema.prisma. |
| 0023 | PASS with caveat | `segments JSONB` and `first_audio_url TEXT` match schema. Partial index `jobs_first_audio_url_not_null` is untracked by Prisma (by design — documented in 0025). |
| 0024 | SUPERSEDED | Index name mismatch was fixed in 0025. |
| 0025 | PASS | All three fixes applied correctly. Partial indexes documented as untracked. |
| 0026 | PASS | Three backlog indexes match schema `@@index` declarations on `AudioOutput`, `Alert`, and `HumanReview`. |

---

## Changes Required Before Next Deploy

### Priority 1 — Security / Data correctness (ship in next PR)

1. **`play/route.ts`**: Add `expiresAt` + `maxPlays` guard (CRITICAL — see fix above)
2. **`play/route.ts`**: Switch to atomic `{ increment: 1 }` for `playCount` and add `lastAccessedAt: new Date()` (CRITICAL + LOW combined fix)

### Priority 2 — Migration 0027 (single file, four changes)

```sql
-- 1. ContentAccessLog shareId index (HIGH)
CREATE INDEX IF NOT EXISTS "content_access_log_share_id_created_at_idx"
  ON "content_access_log"("share_id", "created_at" DESC)
  WHERE "share_id" IS NOT NULL;

-- 2. Drop redundant share_code / share_token indexes (MEDIUM)
DROP INDEX IF EXISTS "script_shares_share_code_idx";
DROP INDEX IF EXISTS "script_shares_share_token_idx";

-- 3. (Comment only — retention policy)
-- Monthly cleanup: DELETE FROM content_access_log WHERE created_at < NOW() - INTERVAL '2 years';
```

Schema changes:
- Remove `@@index([shareToken])` and `@@index([shareCode])` from `ScriptShare`
- Add `@@index([shareId, createdAt(sort: Desc)])` to `ContentAccessLog`

### Priority 3 — Deferred (backlog)

- Add `cleanupOldAccessLogs()` to queue worker (HIGH — retention)
- Update `AccessType` union in `lib/types/marketplace.ts` (MEDIUM)
- Add `ip_address` + `user_agent` to `ContentAccessLog` TS interface (MEDIUM)
- Add share seed data to `prisma/seed.ts` (MEDIUM)

---

## Overall Architecture Grade: A-

All 2026-05-19 CRITICAL and HIGH carryovers are resolved. Two new CRITICAL issues exist in the play route (both are code-only, 5-line fixes). The data model for shares is well-structured; the main gap is that the play route bypasses the validated `accessShare()` service path. Migration chain is clean and well-documented.

- **Security:** B+ (expired/limited shares still trackable via play route — needs fix)
- **Correctness:** B+ (playCount race condition; AccessType enum drift)
- **Performance:** B+ (missing shareId index; redundant indexes on share code/token)
- **Maintainability:** A- (partial indexes documented; migration comments thorough)
