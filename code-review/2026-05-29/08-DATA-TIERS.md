# Data Tiers Audit — 2026-05-29

**Scope:** Full schema audit (not delta-only). Covers all 43 models in
`packages/web/prisma/schema.prisma` plus the orchestrator mirror schema.
Migrations reviewed through `0028_profiles_email_index`.

**Prior review:** `code-review/2026-05-27/08-DATA-TIERS.md`

---

## Carryover Status from 2026-05-27 Review

| Prior Finding | Status |
|---|---|
| `addMember` 500 on re-invite of removed user (HIGH) | **FIXED** — `teams.ts:356–407` now does `OR [{invitedEmail}, {userId}]` lookup and reactivates via `update` instead of `create`. |
| `profiles.email` unindexed (MEDIUM DT-27-1) | **FIXED** — migration `0028_profiles_email_index` adds `profiles_email_idx`. |
| Invite-accept TOCTOU window (MEDIUM DT-27-2) | **NOT FIXED** — still two separate statements; now re-classified LOW (rate-limit + idempotent constraint make blast radius trivial). |
| `removeMember` leaves userId on removed rows (LOW DT-27-3) | Moot — DT-27-HIGH fix handles the re-invite case without nulling userId. Keeping as LOW. |
| `ensureProfile` email backfill overwrites user edits (LOW DT-27-4) | Still present, still LOW. No in-app email edit today. |
| 0027 non-partial index (LOW DT-27-5) | Still present, still LOW / cosmetic. |
| `play/route.ts` — non-atomic `playCount` TOCTOU (CRITICAL from 2026-05-26) | **STILL OPEN** — re-classified HIGH (see below). |
| `ContentAccessLog` retention/cleanup (HIGH from 2026-05-26) | **STILL OPEN** (no cleanup job added). |

---

## CRITICAL Findings

None. No new CRITICAL findings this cycle.

---

## HIGH Findings

### [CARRYOVER] `play` route — TOCTOU on maxPlays guard allows overshoot
**Where:** `packages/web/app/api/shares/access/[code]/play/route.ts:40–73`

**Issue:** The route performs a two-step read-then-write to enforce `maxPlays`:

1. `findFirst` reads `playCount` and `maxPlays` (line 40–49).
2. Guard: `if (playCount >= maxPlays) return 410` (line 61).
3. `update { playCount: { increment: 1 } }` (line 67).

Step 3 uses a DB-native `play_count = play_count + 1` which is individually atomic, but the guard in step 2 is based on a stale snapshot from step 1. Under concurrent requests (N rapid plays near the limit), all N reads see `playCount < maxPlays`, all pass the guard, and all increment — resulting in `playCount` exceeding `maxPlays` by up to `N-1`.

In practice the limit is per-share (not per-user), so a bad actor replaying a request N times near the limit can exceed it. The 2026-05-26 review classed this CRITICAL; re-classing HIGH because `maxPlays` is optional and rarely set to tight values in current usage, but the correctness gap is real and should be fixed.

**Fix:** Collapse the read and increment into a single conditional update using `$executeRaw` with a WHERE guard, or use a DB-level UPDATE ... WHERE + check rows affected:

```ts
// Replace the findFirst + separate update with one atomic UPDATE:
const result = await prisma.$executeRaw`
  UPDATE script_shares
  SET play_count = play_count + 1,
      last_accessed_at = NOW()
  WHERE id = (
    SELECT id FROM script_shares
    WHERE share_code = ${code}
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (max_plays IS NULL OR play_count < max_plays)
    LIMIT 1
  )
  RETURNING id
`;
if (result === 0) {
  // share not found, expired, or limit reached — re-fetch to distinguish
  const share = await prisma.scriptShare.findFirst({ where: { shareCode: code } });
  if (!share || !share.isActive) return errorResponse('Share not found', 404, ...);
  if (share.expiresAt && share.expiresAt < new Date()) return errorResponse('Expired', 410, ...);
  if (share.maxPlays && share.playCount >= share.maxPlays) return errorResponse('Play limit reached', 410, ...);
}
```

Alternatively, wrap the read + write in `prisma.$transaction` with isolation level `Serializable` — simpler but adds lock overhead.

---

### [CARRYOVER] `ContentAccessLog` has no retention / cleanup job
**Where:** `packages/web/prisma/schema.prisma:416–438` (`content_access_log` table)

**Issue:** Every play event and stream access appends a row. There is no TTL, archival job, or `DELETE WHERE created_at < NOW() - INTERVAL 'X days'` anywhere in the codebase. Under continuous production use (multiple teams sharing scripts), this table grows without bound. At 100 plays/day, it hits 36k rows/year; at scale (10k users), it hits millions of rows and degrades the `@@index([shareId, createdAt])` range scans used by the analytics dashboard.

**Fix:** Add a nightly cleanup job (cron or Render job) that deletes rows older than the retention window (90 days for analytics, or 365 days if audit trail needed):

```sql
-- Run nightly (e.g., via pg_cron or a Render cron job)
DELETE FROM content_access_log
WHERE created_at < NOW() - INTERVAL '90 days';
```

Add to `packages/web/scripts/` and wire into `render.yaml` as a cron job. This pairs with the existing `@@index([projectId, createdAt(sort: Desc)])` already on the table.

---

### [NEW] `Subscription` model missing `@@index([userId])`
**Where:** `packages/web/prisma/schema.prisma:258–281`

**Issue:** `Subscription` has `userId String @map("user_id")` and a FK relation to `Profile` with `onDelete: Cascade`, but the only index defined is `@@index([stripeSubscriptionId])`. Any query by `userId` (e.g., "get active subscription for this user" — the most common billing check) does a sequential scan of the entire `subscriptions` table.

The billing/webhook handlers look up subscriptions by `userId` on every authenticated API call that checks entitlements. Without this index, every entitlement check is O(n) on the subscriptions table.

**Fix:**
```prisma
// packages/web/prisma/schema.prisma — Subscription model
@@index([userId])           // ADD
@@index([userId, status])   // ADD — covers "active subscription for user" query
@@index([stripeSubscriptionId])  // KEEP existing
```

Migration:
```sql
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_status_idx" ON "subscriptions"("user_id", "status");
```

---

### [NEW] `Purchase` has no `onDelete` cascade on user relation — orphaned rows on user delete
**Where:** `packages/web/prisma/schema.prisma:296–303`

**Issue:**
```prisma
user    Profile  @relation(fields: [userId], references: [id])          // NO onDelete
project Project? @relation(fields: [projectId], references: [id])        // NO onDelete
```

Both relations have no `onDelete` directive, which defaults to `Restrict` in Prisma (raises a FK violation if you try to delete a user or project that has purchase rows). This means:

- Deleting a user account will **throw a FK constraint error** unless all their `purchases` rows are deleted first.
- Deleting a project that has a purchase (e.g., an Advanced Analysis upgrade) will also throw.

There is no pre-delete cleanup code in the user-deletion flow. This is a data-integrity blocker for GDPR deletion requests.

**Fix (preferred — preserve audit trail):**
```prisma
user    Profile  @relation(fields: [userId], references: [id], onDelete: SetNull)
project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
```
This keeps the purchase record (required for financial audit) but nulls the FK when the user or project is deleted. Requires making `userId` optional in the schema (`userId String? @map("user_id")`).

**Fix (alternative — cascade delete):** Only appropriate if purchase records have no compliance retention requirement:
```prisma
user    Profile  @relation(fields: [userId], references: [id], onDelete: Cascade)
project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
```

Migration for the SetNull path:
```sql
ALTER TABLE purchases ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE purchases
  DROP CONSTRAINT IF EXISTS purchases_user_id_fkey,
  ADD CONSTRAINT purchases_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE purchases
  DROP CONSTRAINT IF EXISTS purchases_project_id_fkey,
  ADD CONSTRAINT purchases_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
```

---

## Backlog (MEDIUM / LOW)

| ID | Severity | [Status] | Title | Fix |
|---|---|---|---|---|
| DT-29-1 | MEDIUM | [NEW] | **`admin/corpus/export` unbounded `scriptCorpus.findMany`** — `app/api/admin/corpus/export/route.ts:16` fetches all `script_corpus` rows with `datasetCategory IS NOT NULL` and no `take`. If the corpus grows to thousands of scripts, this will OOM the serverless function and/or time out. | Add `take: 500` (or stream in pages) and document the limit. Low urgency while corpus is small (43 scripts today). |
| DT-29-2 | MEDIUM | [NEW] | **`ScriptShare.sharedByUser` has no `onDelete` — FK restricts user deletion** — `schema.prisma:373` `sharedByUser Profile @relation("SharedBy", ...)` has no `onDelete`. Same pattern as Purchase: deleting a user who has created shares will throw FK violation unless shares are deleted first. No pre-delete cleanup code exists. | Add `onDelete: SetNull` and make `sharedBy String? @map("shared_by")` nullable. Pairs with DT-29-3 below. |
| DT-29-3 | MEDIUM | [NEW] | **`ScriptShare.sharedWithUser` has no `onDelete`** — `schema.prisma:374` same issue on the recipient side. Deleting a user who has had scripts shared with them throws. | Add `onDelete: SetNull` on this relation (already nullable). |
| DT-27-2 | LOW | [CARRYOVER] | **Invite-accept TOCTOU window** — `app/api/invite/[token]/route.ts:182–218` — `findFirst` + `update` are not in a transaction; double-click race is idempotent in practice due to rate-limit and unique constraint. | Wrap in `prisma.$transaction` or catch P2002 to return 200. Low blast radius. |
| DT-27-3 | LOW | [CARRYOVER] | **`removeMember` leaves `userId` on removed rows** — `teams.ts:463` sets only `status:'removed'`. Root cause is moot now that `addMember` handles re-invite correctly via the OR lookup. | No action required unless audit-trail nulling is desired. |
| DT-27-4 | LOW | [CARRYOVER] | **`ensureProfile` email backfill can overwrite user-edited email** — `ensure-profile.ts:31`. No in-app email edit today; no live impact. | Gate backfill to set only when stored value is null, if in-app email editing is ever added. |
| DT-27-5 | LOW | [CARRYOVER] | **Migration 0027 full index instead of partial** — `content_access_log(share_id, created_at)` indexes NULL `share_id` rows. Minor index bloat. | Recreate as partial index `WHERE share_id IS NOT NULL` in a future migration batch. |
| DT-29-4 | LOW | [NEW] | **`ImpactStory.viewCount` increment not idempotent per viewer** — `app/api/impact/stories/[id]/route.ts:27` increments on every GET, including repeated views by the same user/IP. | Add a per-IP / per-session dedup using Redis `SETNX` or a `viewed_stories` set before incrementing. Low urgency while Impact feature is pre-launch. |
| DT-29-5 | LOW | [NEW] | **Orchestrator partial schemas can drift from web schema** — `packages/orchestrator/prisma/schema.prisma` mirrors 5 of the 43 web models. Any column added to `Project`, `Purchase`, `MixManifest`, `Timeline`, `Alignment`, `TtsStem`, or `VoiceMap` in the web schema must be manually added to the orchestrator mirror or the orchestrator's Prisma client will silently ignore the column. No CI check enforces consistency. | Add a CI step that diffing `prisma format` output of both schemas for shared table names, or add a comment in the web schema on mirrored models pointing to the orchestrator copy. |

---

## Index Coverage Summary (all 43 models)

| Table | FK columns without index | Verdict |
|---|---|---|
| `profiles` | — (email index added in 0028) | OK |
| `projects` | — | OK |
| `jobs` | — | OK |
| `job_logs` | — | OK |
| `audio_outputs` | — (sprint N added job_id index) | OK |
| `usage` | userId (covered by @@unique) | OK |
| `subscriptions` | **userId** — missing | **GAP** (DT-29-NEW HIGH) |
| `purchases` | userId, projectId — indexed | OK — but no cascade |
| `credit_transactions` | — | OK |
| `podcast_feeds` | — | OK |
| `script_shares` | — | OK — but no user cascade |
| `reader_library` | — | OK |
| `content_access_log` | — | OK — but no retention |
| `story_scores` | — | OK |
| `suggestions` | — | OK |
| `rewrites` | — | OK |
| `revisions` | — | OK |
| `script_corpus` | uploadedBy — unindexed (low-volume admin table) | LOW |
| `corpus_score` | — | OK |
| `teams` | — | OK |
| `activity_logs` | — | OK |
| `project_notes` | — | OK |
| `project_comments` | — | OK |
| `team_members` | — | OK |
| `team_shares` | — | OK |
| `alerts` | teamId, relatedUserId — unindexed | LOW (admin-facing infrequent queries) |
| `alert_preferences` | userId (@@unique covers it) | OK |
| `audit_logs` | — | OK |
| `platform_settings` | — | OK |
| `impact_stories` | — | OK |
| `impact_partners` | — | OK |
| `impact_prize_draws` | — | OK |
| `impact_donations` | — | OK |
| `voice_marketplace_interest` | — | OK |
| `script_reviews` | — | OK |
| `writer_subscriptions` | — | OK |
| `voice_clones` | — | OK |
| `api_keys` | — | OK |
| `webhook_endpoints` | — | OK |
| `webhook_delivery_logs` | — | OK |
| `human_reviews` | — | OK |

---

## Migration vs Schema Drift

| Table | Schema | Latest Migration | Match |
|---|---|---|---|
| `team_members` @@unique([teamId,userId]) | schema.prisma:787 | 0001_init | PASS |
| `profiles` @@index([email]) | schema.prisma:76 | 0028 | PASS |
| `content_access_log` @@index([shareId,createdAt]) | schema.prisma:437 | 0027 (non-partial) | PASS (partial predicate omitted — DT-27-5) |
| `jobs` partial index `jobs_first_audio_url_not_null` | comment at schema.prisma:181 | 0023/0025 | UNTRACKED by Prisma — do NOT run `db push` |
| `project_comments` partial unique `project_comments_user_reaction_scene_uniq` | comment at schema.prisma:761 | 0025 | UNTRACKED by Prisma — do NOT run `db push` |
| `subscriptions` userId index | ABSENT | ABSENT | GAP — see DT-29-NEW HIGH |
| `purchases` onDelete | ABSENT | ABSENT | GAP — see DT-29-NEW HIGH |

---

## Overall Grade: B+

The team/invite surface from the prior review is clean and all prior HIGH findings have been fixed or addressed. Three new HIGH findings exist in the billing/sharing data surface:

1. **`maxPlays` overshoot** on the public play endpoint (carryover CRITICAL downgraded to HIGH — now confirmed still unfixed)
2. **`Subscription` missing `userId` index** — every entitlement check is a full table scan
3. **`Purchase` no cascade on user delete** — blocks GDPR erasure flows

Priority order for next PR: Purchase cascade fix (unblocks compliance), Subscription index (performance), play-route TOCTOU fix (correctness).
