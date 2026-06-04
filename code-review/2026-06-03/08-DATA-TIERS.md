# Data Tiers Audit — 2026-06-03

**Scope:** Delta from 2026-05-29. One new migration: `0029_subscription_user_indexes`.
Schema: `packages/shared/prisma/schema.prisma`. New routes: `admin/tier`, `admin/stats`,
`admin/users`, `enterprise/team-comments`, `upgrade`, `referral/upgrade`.

## Carryover Status

| ID | Status |
|----|--------|
| DT-29-NEW-1 | RESOLVED — `Subscription @@index([userId])` + `@@index([userId, status])` in schema + migration 0029 |
| DT-29-NEW-2 | OPEN — `Purchase` no `onDelete` (FK Restrict blocks user deletion) |
| DT-29-2/3 | OPEN — `ScriptShare` sharedBy/sharedWith no `onDelete` |
| DT-29-1 | OPEN — Corpus export unbounded `findMany` |
| CONTENT-LOG-RETENTION | OPEN — no cleanup job |
| PLAY-TOCTOU | OPEN — play route TOCTOU |
| DT-27-2/4/5 | OPEN (LOW) |
| DT-29-4/5 | OPEN (LOW) |

## CRITICAL Findings

### [NEW] DT-30-C-1 — `admin/stats` raw SQL uses PascalCase table/column names — **FIXED this session**

**Where:** `packages/web/app/api/admin/stats/route.ts:35–44`

**Issue:** `FROM "Profile"`, `FROM "Subscription"`, etc. — Prisma maps all models to snake_case
(`profiles`, `subscriptions`). PostgreSQL quoted identifiers are case-sensitive. Every query threw
`ERROR: relation "Profile" does not exist` on first load. Admin stats dashboard was completely broken.

**Fix applied:** All table + column names replaced with `@@map` equivalents:
`profiles`, `subscriptions`, `projects`, `script_shares`, `user_type`, `created_at`.

## HIGH Findings

### [CARRYOVER] PLAY-TOCTOU — play route TOCTOU on maxPlays

**Where:** `packages/web/app/api/shares/access/[code]/play/route.ts:40–73`

Two-step read+write without atomic guard. Fix (pending PR): atomic `$executeRaw` UPDATE with
`WHERE play_count < max_plays` guard.

### [CARRYOVER] CONTENT-LOG-RETENTION — ContentAccessLog no retention job

Unbounded append-only table. Fix: nightly `DELETE WHERE created_at < NOW() - INTERVAL '90 days'` cron.

### [CARRYOVER] DT-29-NEW-2 — Purchase no `onDelete` blocks GDPR user deletion

`packages/shared/prisma/schema.prisma:299–300`. Fix (pending PR): `onDelete: SetNull` + `userId?`.

### [CARRYOVER] DT-29-2/3 — ScriptShare FK relations no `onDelete`

`packages/shared/prisma/schema.prisma:376–377`. Fix (pending PR): `onDelete: SetNull` on both.

### [NEW] DT-30-H-1 — TeamShare.sharedBy no `onDelete` blocks user deletion

**Where:** `packages/shared/prisma/schema.prisma:810`

Same GDPR blocker class as DT-29-2/3 introduced with enterprise collaboration feature.
`sharer Profile @relation(...)` has no `onDelete` directive (defaults to Restrict).

**Fix (pending PR):**
```prisma
sharedBy  String?  @map("shared_by")
sharer    Profile? @relation(fields: [sharedBy], references: [id], onDelete: SetNull)
```

## Backlog (MEDIUM/LOW)

| ID | Sev | Status | Title | Fix |
|----|-----|--------|-------|-----|
| DT-30-M-2 | MED | [NEW] **FIXED** | Hardcoded referral codes in source (`referral/upgrade/route.ts:7-13`) | Built-in codes removed; env-only via `REFERRAL_CODES` |
| DT-30-M-1 | MED | [NEW] | `admin/tier`+`upgrade`+`referral/upgrade` set profile.subscriptionTier without subscriptions upsert | Add `subscription.upsert` after profile.update in each route |
| DT-29-1 | MED | [CARRYOVER] | Corpus export unbounded `findMany` | Add `take: 500` |
| DT-30-L-1 | LOW | [NEW] | `admin/users/[userId]` 3 sequential DB round-trips | `Promise.all` + `_count` |
| DT-30-L-2 | LOW | [NEW] | `admin/users` search missing `email` field | Add `{ email: { contains: search } }` to OR |
| DT-27-2 | LOW | [CARRYOVER] | Invite-accept TOCTOU | `$transaction` + catch P2002 |
| DT-27-4 | LOW | [CARRYOVER] | `ensureProfile` email backfill overwrites | Gate on null check |
| DT-27-5 | LOW | [CARRYOVER] | Migration 0027 non-partial index | Recreate as partial WHERE share_id IS NOT NULL |
| DT-29-4 | LOW | [CARRYOVER] | ImpactStory viewCount dedup | Redis SETNX |
| DT-29-5 | LOW | [CARRYOVER] | Orchestrator schema mirror drift | CI diff check |

## Priority for Next PR

1. DT-30-H-1 + DT-29-NEW-2 + DT-29-2/3 — consolidate FK cascade migrations (team_shares, purchases, script_shares)
2. DT-30-M-1 — subscriptions upsert in tier provisioning routes
3. PLAY-TOCTOU — atomic play route guard
