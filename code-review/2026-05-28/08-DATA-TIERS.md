# Data Tiers Audit — 2026-05-28

**Prior review:** `code-review/2026-05-27/08-DATA-TIERS.md`

## Carryover Status from 2026-05-27

| ID | Finding | Status |
|----|---------|--------|
| HIGH | `addMember` 500 on re-invite of removed user | ✅ RESOLVED — `teams.ts:357` — OR-clause lookup + reactivate branch |
| DT-27-1 | `profiles.email` unindexed | ✅ RESOLVED — migration 0028 |
| DT-27-2 | Invite-accept new-member branch TOCTOU | ⚠️ CARRYOVER |
| DT-27-3 | `removeMember` leaves `userId` populated | ⚠️ CARRYOVER (mitigated by addMember fix) |
| DT-27-4 | `ensureProfile` email backfill overwrite | ⚠️ CARRYOVER (no live impact today) |
| DT-27-5 | 0027 migration non-partial index | ⚠️ CARRYOVER (cosmetic) |

---

## CRITICAL Findings

None.

---

## HIGH Findings

None new. All prior HIGH resolved.

---

## MEDIUM Findings

### [NEW] `subscriptions.user_id` FK is unindexed — billing queries full-scan

**Where:** `packages/web/prisma/schema.prisma:258–281`; `packages/web/prisma/migrations/0001_init/migration.sql:692`

**Issue:** `Subscription` model has `user Profile @relation(fields: [userId], ...)` but no `@@index([userId])`. Every billing check, plan enforcement, and Stripe webhook sync does a full table scan on `subscriptions`. No `subscriptions_user_id_idx` exists anywhere in 28 migrations. Degrades proportionally with user count.

**Fix:**
```sql
-- Migration 0029_subscriptions_user_id_idx
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");
```
Schema:
```prisma
@@index([userId])
```

---

### [NEW] `story_scores.model_version` default is stale (`"gpt-4o"`)

**Where:** `packages/web/prisma/schema.prisma:488`; `packages/web/prisma/migrations/0001_init/migration.sql:260`

**Issue:** Default is `'gpt-4o'`; production now uses `claude-sonnet-4-6`. Application code at `packages/web/lib/scoring/service.ts:203` explicitly passes `modelVersion` on every insert, so the default never fires for normal inserts. But rows inserted via raw SQL (seed scripts, admin tooling, corpus batch ops) without `model_version` silently inherit `'gpt-4o'`. Analytics queries grouped by `model_version` at `app/api/admin/corpus/export/route.ts:78` will misclassify such rows.

**Fix:**
```sql
ALTER TABLE "story_scores" ALTER COLUMN "model_version" SET DEFAULT 'claude-sonnet-4-6';
```
Schema:
```prisma
modelVersion String @default("claude-sonnet-4-6") @map("model_version")
```

---

### [CARRYOVER DT-27-2] Invite-accept new-member branch not in transaction — TOCTOU risk

**Where:** `packages/web/app/api/invite/[token]/route.ts:182–218`

**Issue:** The `findFirst` membership check (line 182) and `teamMember.update` in the new-member branch (line 209) are separate statements. Two concurrent accepts of the same token (double-click, retry from different IPs) both read `existingMembership = null`, then both update the invite — idempotent on the invite row itself, but the subscription upgrade (`updateMany`, line 223) and alert `create` (line 236) fire for both requests, producing a duplicate team-owner alert. The reactivate branch (lines 196–205) IS correctly wrapped in `prisma.$transaction`; the new-member branch is not.

**Fix:** Wrap `findFirst` + conditional-update in a serializable transaction; move subscription upgrade and alert creation outside:
```ts
await prisma.$transaction(async (tx) => {
  const existing = await tx.teamMember.findFirst({
    where: { teamId: invite.teamId, userId },
    select: { id: true, status: true },
  });
  if (existing) {
    await tx.teamMember.update({ where: { id: existing.id }, data: { status: 'accepted', acceptedAt: new Date() } });
    await tx.teamMember.update({ where: { id: invite.id }, data: { status: 'accepted', acceptedAt: new Date() } });
  } else {
    await tx.teamMember.update({ where: { id: invite.id }, data: { userId, status: 'accepted', acceptedAt: new Date() } });
  }
}, { isolationLevel: 'Serializable' });
```

---

## Backlog (LOW)

| ID | Sev | Label | Title | Fix |
|----|----|-------|-------|-----|
| DT-28-1 | LOW | NEW | `Subscription.@@index([stripeSubscriptionId])` redundant — `@unique` already creates an implicit btree index | `DROP INDEX "subscriptions_stripe_subscription_id_idx";` + remove `@@index([stripeSubscriptionId])` from schema |
| DT-28-2 | LOW | NEW | `Usage.@@index([userId, period])` redundant — `@@unique([userId, period])` already creates `usage_user_id_period_key` | `DROP INDEX "usage_user_id_period_idx";` + remove `@@index([userId, period])` from schema |
| DT-28-3 | LOW | NEW | `deleteTeam` runs 3 sequential writes (redundant `deleteMany` calls — `ON DELETE CASCADE` already handles cleanup) | Remove redundant `deleteMany` calls + rely on CASCADE, or wrap in `$transaction` |
| DT-28-4 | LOW | NEW | Orchestrator `schema.prisma` missing 8 columns vs web schema — `prisma db push` from orchestrator would attempt to DROP them | Add prominent WARNING comment at top of `packages/orchestrator/prisma/schema.prisma` |
| DT-27-3 | LOW | CARRYOVER | `removeMember` leaves `userId` populated | No action needed — `addMember` reactivation handles correctly |
| DT-27-4 | LOW | CARRYOVER | `ensureProfile` email overwrite risk | Gate to null-check if in-app email editing is added |
| DT-27-5 | LOW | CARRYOVER | 0027 migration index non-partial | Optional cleanup only |

---

## Migration Drift Check (most recent 5)

| Migration | Verdict |
|-----------|---------|
| `0028_profiles_email_index` | PASS — matches `Profile @@index([email])` |
| `0027_content_access_log_share_idx` | PASS (non-partial noted as DT-27-5) |
| `0026_sprint_n_indexes` | PASS |
| `0025_data_integrity_sprint_m` | PASS |
| `0024_add_comment_reactions` | PASS |

No TypeScript type drift found. snake_case ↔ camelCase mapping consistent across all 5 migrations.

---

## Overall Grade: A

All HIGH/MEDIUM carryovers resolved. Two new MEDIUM items (unindexed FK, stale default) are a single `0029` migration. TOCTOU carryover has negligible blast radius given strict rate-limit. No tenant isolation gaps in delta surface.
