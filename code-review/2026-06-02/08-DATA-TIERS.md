# Data Tiers Audit — 2026-06-02

**Scope:** Delta review — changes since 2026-05-29. Migrations reviewed: `0029_subscriptions_user_id_idx_cleanup_stale_defaults`, `0030_orchestrator_pipeline_tables`, `0031_team_member_type`. Schema source of truth confirmed as `packages/shared/prisma/schema.prisma`.

**Prior review:** `code-review/2026-05-29/08-DATA-TIERS.md`

---

## Carryover Status from 2026-05-29 Review

| Prior Finding | Status |
|---|---|
| DT-29-NEW-1: `Subscription` `@@index([userId])` + `@@index([userId, status])` | **FIXED** — migration `0029_subscriptions_user_id_idx_cleanup_stale_defaults` adds both indexes. Schema confirmed at `schema.prisma:281–283`. |
| DT-29-NEW-2: `Purchase` `onDelete: SetNull`, `userId?` nullable | **NOT FIXED** — `Purchase.user` still has no `onDelete` at `schema.prisma:299`. |
| DT-29-2: `ScriptShare.sharedByUser` `onDelete: SetNull` | **NOT FIXED** — `schema.prisma:376` still has no `onDelete`. |
| DT-29-3: `ScriptShare.sharedWithUser` `onDelete: SetNull` | **NOT FIXED** — `schema.prisma:377` still has no `onDelete`. |
| DT-29-1: Corpus export `take: 500` limit | **NOT FIXED** — `app/api/admin/corpus/export/route.ts:16` outer `findMany` still has no `take`. (Inner `corpusScores` `take: 1` is correct but irrelevant.) |
| CONTENT-LOG-RETENTION: nightly cleanup job | **NOT FIXED** — no retention job added. |
| HIGH: `play` route TOCTOU on `maxPlays` | **NOT FIXED** — `app/api/shares/access/[code]/play/route.ts` still does `findFirst` + `update` in two statements. |

---

## CRITICAL Findings

None. No new CRITICAL findings this cycle.

---

## HIGH Findings

### [CARRYOVER] `play` route — TOCTOU on `maxPlays` allows overshoot
**Where:** `packages/web/app/api/shares/access/[code]/play/route.ts:47–75`

**Issue:** `findFirst` reads `playCount` and `maxPlays`, then a separate `update { playCount: { increment: 1 } }` is issued. Under N concurrent requests near the play limit, all N reads see `playCount < maxPlays`, all pass the guard, and all increment — resulting in `playCount` exceeding `maxPlays` by up to N-1.

**Fix:**
```ts
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
  // re-fetch to distinguish not-found vs expired vs limit-reached
}
```

---

### [CARRYOVER] `ContentAccessLog` has no retention / cleanup job
**Where:** `packages/shared/prisma/schema.prisma:419–442` + `packages/web/scripts/` (missing)

**Issue:** Every play, stream-start, and complete event appends a row. No TTL, archival script, or `DELETE WHERE created_at < NOW() - INTERVAL 'X days'` exists anywhere. Under production load this table grows without bound and degrades analytics range scans.

**Fix:** Add a Render cron job or `packages/web/scripts/cleanup-access-log.ts`:
```sql
DELETE FROM content_access_log
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

### [CARRYOVER] `Purchase` — no `onDelete` on `user` or `project` relation blocks GDPR erasure
**Where:** `packages/shared/prisma/schema.prisma:299–300`

**Issue:** Both `user` and `project` FK relations on `Purchase` have no `onDelete` directive (defaults to `Restrict`). Deleting a user or a project that has purchase rows throws a FK constraint error. There is no pre-delete cleanup code in the user-deletion or project-deletion flow. This is a GDPR/compliance blocker.

**Fix (SetNull — preserves financial audit trail):**
```prisma
// schema.prisma — Purchase model
userId   String?  @map("user_id")    // make nullable
user     Profile? @relation(fields: [userId], references: [id], onDelete: SetNull)
project  Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
```

Migration:
```sql
ALTER TABLE purchases ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE purchases
  DROP CONSTRAINT purchases_user_id_fkey,
  ADD CONSTRAINT purchases_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE purchases
  DROP CONSTRAINT IF EXISTS purchases_project_id_fkey,
  ADD CONSTRAINT purchases_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
```

---

### [CARRYOVER] `ScriptShare.sharedByUser` — no `onDelete` blocks user deletion
**Where:** `packages/shared/prisma/schema.prisma:376`

**Issue:** `sharedByUser Profile @relation("SharedBy", ...)` has no `onDelete`. Deleting a user who created shares throws FK violation. No pre-delete cleanup exists.

**Fix:**
```prisma
sharedBy     String?  @map("shared_by")   // make nullable
sharedByUser Profile? @relation("SharedBy", fields: [sharedBy], references: [id], onDelete: SetNull)
```

Migration:
```sql
ALTER TABLE script_shares ALTER COLUMN shared_by DROP NOT NULL;
ALTER TABLE script_shares
  DROP CONSTRAINT script_shares_shared_by_fkey,
  ADD CONSTRAINT script_shares_shared_by_fkey
    FOREIGN KEY (shared_by) REFERENCES profiles(id) ON DELETE SET NULL;
```

---

## NEW Findings Since 2026-05-29

### [NEW] `packages/web/prisma/migrations/` is an orphaned directory — migration split risk
**Where:** `packages/web/prisma/migrations/` — contains only `0029_subscription_user_indexes/`; `packages/shared/prisma/migrations/` is the canonical source (30 migrations)

**Issue:** When the schema was consolidated into `packages/shared`, the `packages/web/prisma/` directory was left with one stale migration folder (`0029_subscription_user_indexes`) and no `schema.prisma`. There is no schema file in this directory, so `prisma migrate` invoked from `packages/web/` will fail with a schema-not-found error — but the presence of a `migrations/` folder is a trap: a developer running `prisma migrate dev --schema ../shared/prisma/schema.prisma` from the wrong working directory could accidentally attempt to reconcile the web migration history against the shared database, producing a false "database is not in sync with migration history" error or a spurious baseline migration. The `migration_lock.toml` file is absent from `packages/web/prisma/migrations/`, which means Prisma would create it fresh and diverge.

**Classify:** MEDIUM — no active data loss risk today (web's `postinstall` correctly runs `cd ../shared && prisma generate`), but is a footgun for any developer running `prisma migrate` directly in `packages/web`.

**Fix:** Delete `packages/web/prisma/migrations/` entirely and update the `packages/web/package.json` prisma scripts to point explicitly to the shared schema:
```json
"prisma:migrate:dev": "cd ../shared && prisma migrate dev",
"prisma:migrate:deploy": "cd ../shared && prisma migrate deploy"
```

---

### [NEW] `PurchaseType` TypeScript type in `marketplace.ts` is completely stale — all live values are untyped
**Where:** `packages/web/lib/types/marketplace.ts:144–168`

**Issue:** The `PurchaseType` union and `PURCHASE_PRICES` constant define six values (`processing`, `ocr_processing`, `unlock`, `download`, `subscription`, `generation`). None of these appear in the actual codebase that writes `purchase_type` to the database. The three live values are:

| Value written to DB | Written in |
|---|---|
| `'upload'` | `packages/web/app/api/reader/upload/create-payment/route.ts:37` |
| `'advanced_analysis'` | `packages/web/app/api/projects/[id]/advanced-analysis/route.ts:24` |
| `'human_review'` | `packages/web/app/api/stripe/webhook/route.ts:158` |

The `ocr_processing` type (previously `$8`) was removed in the reader-upload-B-C fix (`7c55bb8`) but was never cleaned out of the type file. The remaining four values (`processing`, `unlock`, `download`, `generation`) have no corresponding write anywhere. Any code that imports `PurchaseType` for type-checking against DB rows gets a false sense of safety.

**Fix:** Update `marketplace.ts`:
```ts
// Before
export type PurchaseType =
  | 'processing'
  | 'ocr_processing'
  | 'unlock'
  | 'download'
  | 'subscription'
  | 'generation';

export const PURCHASE_PRICES: Record<PurchaseType, number> = { ... };

// After
export type PurchaseType =
  | 'upload'            // Reader script upload ($5)
  | 'advanced_analysis' // Opus analysis upgrade ($9.99)
  | 'human_review';     // Human-in-loop review ($99)

export const PURCHASE_PRICES: Record<PurchaseType, number> = {
  upload: 500,
  advanced_analysis: 999,
  human_review: 9900,
};
```

Also remove `ocr_processing` from `PURCHASE_PRICES` and the `DTO` validation at `packages/web/lib/api/dto/index.ts:203` which still references `$5 (standard) or $8 (OCR)`.

---

### [NEW] `TeamShare.sharer` — no `onDelete` on `sharedBy` relation blocks user deletion
**Where:** `packages/shared/prisma/schema.prisma:810`

**Issue:** `sharer Profile @relation(fields: [sharedBy], references: [id])` on `TeamShare` has no `onDelete`. Deleting a user who has shared projects with teams throws FK violation. Same pattern as `ScriptShare.sharedByUser` (DT-29-2), newly confirmed in the `TeamShare` model which was added later.

**Fix:**
```prisma
sharedBy    String?  @map("shared_by")   // make nullable
sharer      Profile? @relation(fields: [sharedBy], references: [id], onDelete: SetNull)
```

Migration:
```sql
ALTER TABLE team_shares ALTER COLUMN shared_by DROP NOT NULL;
ALTER TABLE team_shares
  DROP CONSTRAINT team_shares_shared_by_fkey,
  ADD CONSTRAINT team_shares_shared_by_fkey
    FOREIGN KEY (shared_by) REFERENCES profiles(id) ON DELETE SET NULL;
```

---

### [NEW] `TeamMember.inviter` — no `onDelete` on `invitedBy` relation
**Where:** `packages/shared/prisma/schema.prisma:789`

**Issue:** `inviter Profile? @relation("InvitedBy", fields: [invitedBy], references: [id])` has no `onDelete`. The field is already nullable (`invitedBy String?`), but without `onDelete: SetNull` the default is `Restrict` — deleting a user who invited team members throws FK violation (Prisma Restrict = raise error).

**Fix:**
```prisma
inviter Profile? @relation("InvitedBy", fields: [invitedBy], references: [id], onDelete: SetNull)
```

Migration (FK rename only — column already nullable):
```sql
ALTER TABLE team_members
  DROP CONSTRAINT team_members_invited_by_fkey,
  ADD CONSTRAINT team_members_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;
```

---

### [NEW] `0031_team_member_type` migration: column added to `packages/shared` but schema drift in generated Prisma types not yet confirmed in orchestrator
**Where:** `packages/shared/prisma/migrations/0031_team_member_type/migration.sql` vs `packages/orchestrator/src/generated/prisma/schema.prisma`

**Issue:** Migration `0031` adds `member_type TEXT` to `team_members`. The `packages/shared` generated types (`index.d.ts:35842`) correctly include `memberType`. However, `packages/orchestrator/dist/generated/prisma/schema.prisma` is a compiled artefact that may not have been regenerated after this migration. If the orchestrator was built before `0031` was added and the `dist/` was committed/cached, the orchestrator's generated client will silently omit `memberType`. The orchestrator does not use `team_members` directly today, but the risk is precedent-setting for future pipeline tables.

**Classify:** LOW — `team_members` is not read by the orchestrator pipeline. Risk is precedent.

**Fix:** Ensure `packages/orchestrator` runs `prisma generate` in its build step with the shared schema. Add to `packages/orchestrator/package.json`:
```json
"postinstall": "cd ../shared && prisma generate"
```
And verify `packages/orchestrator/dist/generated/prisma/` is in `.gitignore` (generated artefacts should not be committed).

---

### [NEW] `0029_subscriptions_user_id_idx_cleanup_stale_defaults` drops `subscriptions_stripe_subscription_id_idx` — but implicit unique index relies on this
**Where:** `packages/shared/prisma/migrations/0029_subscriptions_user_id_idx_cleanup_stale_defaults/migration.sql:5–6`

**Issue:** The migration drops `subscriptions_stripe_subscription_id_idx` on the grounds it is "redundant" because `@unique` creates an implicit btree index. This is correct in principle — PostgreSQL does create an implicit index for `UNIQUE` constraints. However, the explicit index name `subscriptions_stripe_subscription_id_idx` may be referenced in existing query plans or monitoring dashboards that were set up before this migration. More critically, if the Prisma migration was applied against a database that had the index created by `prisma db push` rather than the `@unique` directive, the constraint name may differ (`subscriptions_stripe_subscription_id_key` vs `subscriptions_stripe_subscription_id_idx`), and the `DROP INDEX IF EXISTS` will silently do nothing — leaving both indexes.

**Classify:** LOW — the UNIQUE constraint's implicit index covers query needs; the concern is operational (monitoring/explain plans may reference the old name).

**Fix:** Confirm after migration by running:
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'subscriptions'
  AND indexname LIKE '%stripe%';
```
Expected result: only `subscriptions_stripe_subscription_id_key` (from the UNIQUE constraint). If `subscriptions_stripe_subscription_id_idx` still appears, drop it manually.

---

## Schema Correctness: Migrations Since 2026-05-29

| Migration | SQL Column | Schema Column | Match |
|---|---|---|---|
| `0029_subscriptions_user_id_idx_cleanup_stale_defaults` | `user_id` index on `subscriptions` | `@@index([userId])` at `schema.prisma:281` | PASS |
| `0029_subscriptions_user_id_idx_cleanup_stale_defaults` | `DROP INDEX subscriptions_user_id_period_idx` on `usage` | `@@unique([userId, period])` — unique covers it | PASS (redundant index correctly removed) |
| `0029_subscriptions_user_id_idx_cleanup_stale_defaults` | `ALTER COLUMN model_version SET DEFAULT 'claude-sonnet-4-6'` | `@default("claude-sonnet-4-6")` at `schema.prisma:491` | PASS |
| `0030_orchestrator_pipeline_tables` | `mix_manifests`, `timelines`, `alignments`, `tts_stems`, `voice_map` | `MixManifest`, `Timeline`, `Alignment`, `TtsStem`, `VoiceMap` at `schema.prisma:1157–1209` | PASS — all column names and types match |
| `0031_team_member_type` | `ADD COLUMN "member_type" TEXT` | `memberType String? @map("member_type")` at `schema.prisma:777` | PASS |

No column name mismatches found in the three new migrations.

---

## Seed Data Coverage

**New plan types or tiers in recent migrations:** None. `0030` adds pipeline tables (no plan data). `0031` adds a classification label column (no plan data).

**Existing gaps (unchanged from prior review):**
- `packages/web/prisma/seed.ts` seeds one `Profile` (tier `pro`) and two `Project` rows plus one `Purchase`. No `Subscription` seed rows, no `Team`/`TeamMember` seed rows, no `enterprise`-tier profile. The enterprise gate (`/enterprise/(gated)/layout.tsx`) checks `subscriptionTier === 'enterprise'` — a developer needs a manual `UPDATE profiles SET subscription_tier = 'enterprise'` to test the enterprise flow locally.

**Fix (LOW):** Add an enterprise seed user to `seed.ts`:
```ts
await prisma.profile.upsert({
  where: { id: 'user_dev_enterprise_001' },
  update: {},
  create: {
    id: 'user_dev_enterprise_001',
    email: 'enterprise@storymagic.test',
    fullName: 'Enterprise Dev User',
    subscriptionTier: 'enterprise',
    subscriptionStatus: 'active',
  },
});
```

---

## Backlog (MEDIUM / LOW)

| ID | Severity | [Status] | Title | Fix |
|---|---|---|---|---|
| DT-29-1 | MEDIUM | [CARRYOVER] | **`admin/corpus/export` outer `findMany` unbounded** — `app/api/admin/corpus/export/route.ts:16` fetches all `script_corpus` rows with no outer `take`. Inner `take: 1` on `corpusScores` does not bound the corpus table scan. | Add `take: 500` to the outer `findMany`. |
| DT-29-2 | HIGH | [CARRYOVER] | **`ScriptShare.sharedByUser` no `onDelete`** | Add `onDelete: SetNull`, make `sharedBy` nullable. (Detailed fix above.) |
| DT-29-3 | MEDIUM | [CARRYOVER] | **`ScriptShare.sharedWithUser` no `onDelete`** — field is already nullable, but Restrict default still blocks user deletion. | Add `onDelete: SetNull` to the relation directive. |
| DT-06-02-1 | MEDIUM | [NEW] | **`packages/web/prisma/migrations/` orphaned directory** — no schema.prisma; leftover from pre-consolidation; migration footgun for new developers. | Delete the directory; update web package.json scripts to invoke from `../shared`. |
| DT-06-02-2 | MEDIUM | [NEW] | **`PurchaseType` TS type completely stale** — `marketplace.ts:144` defines 6 values; all 3 live DB values (`upload`, `advanced_analysis`, `human_review`) are absent. | Replace type body and `PURCHASE_PRICES` constant; remove dead `ocr_processing` DTO validation. |
| DT-06-02-3 | HIGH | [NEW] | **`TeamShare.sharer` no `onDelete`** — user deletion throws FK violation. | Add `onDelete: SetNull`, make `sharedBy` nullable. (Detailed fix above.) |
| DT-06-02-4 | HIGH | [NEW] | **`TeamMember.inviter` no `onDelete`** — field nullable but Restrict still applies; user deletion throws. | Add `onDelete: SetNull` to the `inviter` relation. |
| DT-06-02-5 | LOW | [NEW] | **`0029_cleanup` drops explicit stripe index — verify implicit exists** | Run `pg_indexes` check post-migration (SQL above). |
| DT-06-02-6 | LOW | [NEW] | **Enterprise seed user missing from `seed.ts`** | Add enterprise-tier profile to `prisma/seed.ts`. |
| DT-27-2 | LOW | [CARRYOVER] | **Invite-accept TOCTOU window** — `app/api/invite/[token]/route.ts` `findFirst` + `update` not in transaction. | Wrap in `prisma.$transaction` or catch P2002 to return 200. |
| DT-27-4 | LOW | [CARRYOVER] | **`ensureProfile` email backfill can overwrite user-edited email** | Gate backfill to set only when stored value is null. |
| DT-27-5 | LOW | [CARRYOVER] | **Migration 0027 non-partial index on `content_access_log`** — indexes NULL `share_id` rows. | Recreate as partial index `WHERE share_id IS NOT NULL` in a future batch. |
| DT-29-4 | LOW | [CARRYOVER] | **`ImpactStory.viewCount` not idempotent per viewer** | Add Redis SETNX dedup before incrementing. |
| DT-29-5 | LOW | [CARRYOVER] | **Orchestrator partial schema can drift from web schema** | CI diff step or comments pointing to mirrored models. |

---

## Overall Grade: B

Since 2026-05-29: two carryover HIGH items (DT-29-NEW-1 subscription index ✅ FIXED; others still open) and four new HIGH-class FK cascade issues discovered in `TeamShare.sharer` and `TeamMember.inviter`. The type drift on `PurchaseType` is the most actionable new item — it requires only a file edit, no migration, and unblocks static analysis catching future purchase-type typos.

**Priority order for next PR:**
1. **FK cascade batch** — `Purchase.user`, `ScriptShare.sharedByUser`, `TeamShare.sharer`, `TeamMember.inviter` — all `onDelete: SetNull` in one migration (these can ship together; they are all user-deletion safety fixes). **4 SP.**
2. **`PurchaseType` type cleanup** — `marketplace.ts` + `dto/index.ts` — no migration needed. **1 SP.**
3. **Orphaned `packages/web/prisma/migrations/` removal** — safe delete, no data impact. **0.5 SP.**
4. **`play` route TOCTOU atomic SQL** — `$executeRaw` replacement. **1 SP.**
5. **Corpus export `take: 500`** — one-line addition. **0.5 SP.**
