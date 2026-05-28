# Data Tiers Audit — 2026-05-27 (delta vs 2026-05-26)

**Scope:** Delta files touching data since 2026-05-26:
- `packages/web/app/api/invite/[token]/route.ts` (invite accept — team membership writes)
- `packages/web/lib/ensure-profile.ts` (profile upsert backfill)
- `packages/web/app/enterprise/team/page.tsx` (team member list — client component)

**Plus the data-access surface they exercise:** `lib/services/teams.ts`, `app/api/teams/route.ts`, `app/api/teams/[teamId]/members/route.ts`, schema models `Team` / `TeamMember` / `Profile` / `Alert`.

**Prior review:** `code-review/2026-05-26/08-DATA-TIERS.md`

---

## Carryover Status from 2026-05-26 Review

| Prior Finding | Status |
|---|---|
| play/route.ts — no `expiresAt`/`maxPlays` guard (CRITICAL) | OUT OF DELTA SCOPE — not re-verified (play route unchanged this cycle) |
| play/route.ts — non-atomic `playCount` increment (CRITICAL) | OUT OF DELTA SCOPE — not re-verified |
| ContentAccessLog `shareId` index (HIGH) | FIXED — migration `0027_content_access_log_share_idx` applied. Note: migration omits the `WHERE share_id IS NOT NULL` partial predicate that the prior fix recommended (full index instead — acceptable, slightly larger). |
| ContentAccessLog retention/cleanup (HIGH) | NOT VERIFIED — out of delta scope |
| AccessType enum drift / redundant share indexes (MEDIUM) | OUT OF DELTA SCOPE |

The delta files are **all in the team/invite tenant-isolation surface**, which the prior review did not cover. Findings below are new to this surface.

---

## CRITICAL Findings

None. No tenant-isolation gap was found in the delta surface — every team/member read and write is correctly scoped (see Tenant-Isolation Verification below).

---

## HIGH Findings

### [NEW] `addMember` 500s on re-invite of a previously-removed registered user (unique-constraint violation)
**Where:** `packages/web/lib/services/teams.ts:336–372` (create at :363), constraint `team_members_team_id_user_id_key` (`prisma/migrations/0001_init/migration.sql:638`; schema `@@unique([teamId, userId])` at `schema.prisma:786`)

**Issue:** `addMember` pre-checks for an existing row **by `invitedEmail` only**, and only blocks when status is `accepted` or `pending`:

```ts
const existing = await prisma.teamMember.findFirst({
  where: { teamId, invitedEmail: email },
  select: { id: true, status: true },
});
if (existing) {
  if (existing.status === 'accepted') throw ...ALREADY_MEMBER;
  if (existing.status === 'pending')  throw ...INVITE_PENDING;
  // status === 'removed' falls through ↓
}
...
const existingUser = await prisma.profile.findFirst({ where: { email } });
const member = await prisma.teamMember.create({
  data: { teamId, userId: existingUser?.id || null, invitedEmail: email, ... },
});
```

A member who joined and was later removed keeps `status='removed'` **with `userId` still set** (`removeMember` only flips `status`, never nulls `userId` — `teams.ts:423`). Re-inviting that same person:
1. `existing.status === 'removed'` → neither guard throws → falls through.
2. `existingUser.id` resolves to the same profile.
3. `create` writes a second row with the same `(teamId, userId)` → violates `team_members_team_id_user_id_key` → unhandled → HTTP 500 to the team owner.

This is the **write-side mirror** of the exact bug the invite-accept route was just hardened against (the accept route now reactivates instead of duplicating). The invite *creation* path was not given the same treatment.

**Fix:** Reactivate the removed row instead of inserting a duplicate. Match on `(teamId, userId)` when the invitee is a known user, else on `(teamId, invitedEmail)`:

```ts
const existing = await prisma.teamMember.findFirst({
  where: existingUser?.id
    ? { teamId, OR: [{ userId: existingUser.id }, { invitedEmail: email }] }
    : { teamId, invitedEmail: email },
  select: { id: true, status: true },
});
if (existing?.status === 'accepted') throw new TeamServiceError('This person is already a team member', 'ALREADY_MEMBER', 400);
if (existing?.status === 'pending')  throw new TeamServiceError('An invitation is already pending for this email', 'INVITE_PENDING', 400);

const member = existing
  ? await prisma.teamMember.update({
      where: { id: existing.id },
      data: { status: 'pending', role: input.role || 'member', invitedEmail: email, invitedBy: userId, invitedAt: new Date(), acceptedAt: null },
    })
  : await prisma.teamMember.create({
      data: { teamId, userId: existingUser?.id || null, invitedEmail: email, role: input.role || 'member', status: 'pending', invitedBy: userId },
    });
```

Note: re-using an existing row means `inviteToken` is unchanged; if a fresh token per re-invite is desired, also set `inviteToken: null` then let the default regenerate (or generate explicitly).

**Severity:** HIGH — Owner-facing 500 on a normal workflow (re-inviting someone removed earlier); blocks re-onboarding.

---

## Backlog (MEDIUM / LOW)

| ID | Severity | Title | Fix |
|---|---|---|---|
| DT-27-1 | MEDIUM | **`profiles.email` unindexed** — `addMember` (`teams.ts:351`) and any email lookup do a full table scan. `profiles` grows with every Clerk user. No `@@index([email])` in `schema.prisma:74–76`; only migration index on `email` is `team_members_invited_email_idx` (different table). [NEW — surfaced by invite/team delta] | Add `@@index([email])` to `Profile` + migration `CREATE INDEX "profiles_email_idx" ON "profiles"("email");`. |
| DT-27-2 | MEDIUM | **Invite-accept membership write not transactional in the "new" branch + a TOCTOU window** — `route.ts:182–218`: the `findFirst` membership check and the subsequent `update` (new branch, :209) are separate statements. Two concurrent accepts of the same token (double-click / retry) both see `existingMembership === null`, both run the new-branch `update` on the same invite row — the second is a no-op (idempotent here, so low blast radius) — but a concurrent accept *by a different already-pending row* for the same `(teamId,userId)` could still race the unique constraint and 500. The reactivate branch *is* wrapped in `$transaction`. [NEW] | Wrap the whole accept in `prisma.$transaction(async (tx) => { ... })`, or rely on the unique constraint and catch P2002 to return a clean "already a member" 200. Low likelihood given the strict rate-limit on the route (`route.ts:96`). |
| DT-27-3 | LOW | **`removeMember` leaves `userId` populated on removed rows** — `teams.ts:423` sets only `status:'removed'`. This is the root cause that makes DT-HIGH above possible and means a removed user still counts against `@@unique([teamId,userId])`. [NEW] | Either keep current behavior and handle re-invite via DT-HIGH fix (preferred — preserves audit trail), or null `userId` on removal (loses history of who was removed). |
| DT-27-4 | LOW | **`ensureProfile` upsert is safe but `email` backfill can overwrite a user-edited email** — `ensure-profile.ts:31` writes `...(email ? { email } : {})` on every call, so a profile email is re-synced from Clerk on each invite/dashboard hit even if the user edited it in-app. Profiles have no in-app email edit today, so no live impact. [NEW] | If in-app email editing is ever added, gate the backfill to only set when the stored value is null: move the null-coalescing decision server-side or use a dedicated webhook-only sync path. The upsert itself is race-safe (atomic on PK). |
| DT-27-5 | LOW | **0027 migration index is non-partial** — prior review recommended `WHERE share_id IS NOT NULL`; shipped migration created a full index over `(share_id, created_at)`. Rows with `share_id NULL` are indexed needlessly (position/stream rows). Cosmetic; minor index bloat. [CARRYOVER] | Optional: recreate as partial index. Not worth a migration on its own. |

---

## Tenant-Isolation Verification (the CRITICAL category — clean)

Audited every team/member/profile read and write in the delta surface for ownership scoping:

| Operation | File:line | Scoping | Verdict |
|---|---|---|---|
| `listTeams` owned | `teams.ts:53` | `where: { ownerId: userId }` | OK |
| `listTeams` memberships | `teams.ts:77` | `where: { userId, status:'accepted' }` | OK |
| `getTeam` | `teams.ts:145–187` | `findUnique` then explicit owner-or-accepted-member gate; throws 403 otherwise | OK |
| `updateTeam` | `teams.ts:203` | `where: { id, ownerId: userId }` | OK |
| `deleteTeam` | `teams.ts:233` | `where: { id, ownerId: userId }` before cascading deletes | OK |
| `listMembers` | `teams.ts:263–308` | owner-or-accepted-member gate before `findMany({ where:{ teamId } })` | OK |
| `addMember` | `teams.ts:324` | `where: { id: teamId, ownerId: userId }` (owner-only) | OK (correctness bug noted above, not an isolation gap) |
| `removeMember` | `teams.ts:414` + `updateMany({ where:{ id: memberId, teamId } })` | owner gate + `teamId` re-scoped on the update so a member of team A cannot remove a member of team B by id | OK |
| invite GET | `route.ts:28` | token is the capability (unguessable, `@unique`, rate-limited) — by design unauthenticated pre-auth lookup | OK |
| invite POST accept | `route.ts:123–245` | requires `auth()`; membership keyed to the authenticated `userId`; alert targets `team.ownerId` | OK |
| `team/page.tsx` | client component | no direct DB access — fetches `/api/teams` (scoped above) | OK |

No `findMany`/`findFirst`/`findUnique`/`update`/`delete` in the delta surface fetches or mutates team/member data without an ownership or membership gate. The team isolation model is enforced consistently in `lib/services/teams.ts`, which all routes delegate to.

---

## Unbounded-Query Check (delta surface)

- `listMembers` `findMany` (`teams.ts:284`) — no `take:`. Bounded in practice (members per team is small, single-team scope). LOW — not flagged.
- `listTeams` `findMany` (`teams.ts:53,77`) — no `take:`, scoped to one user's owned/joined teams. Bounded in practice. Not flagged.
- No comment/job/usage `findMany` in the delta surface.

---

## Migration vs Schema Drift (delta-relevant tables)

| Table | Schema | Migration | Match |
|---|---|---|---|
| `team_members` `@@unique([teamId,userId])` | `schema.prisma:786` | `0001_init:638` `team_members_team_id_user_id_key` | PASS |
| `team_members` indexes (teamId, userId, inviteToken, invitedEmail) | `schema.prisma:787–790` | `0001_init:626–635` | PASS |
| `profiles.email` index | none | none | PASS (consistent — but missing by omission; see DT-27-1) |
| `content_access_log` shareId index | `schema.prisma` (`@@index([shareId,createdAt])`) | `0027` (non-partial) | PASS (predicate differs — DT-27-5) |

No drift that would break runtime. The only "gap" is the intentional absence of a `profiles.email` index (DT-27-1).

---

## Overall (delta) Grade: A-

Tenant isolation across the team/invite surface is **clean** — the most important category has no findings. The one real bug is a write-side unique-constraint 500 in `addMember` on re-invite (HIGH), which is the un-hardened twin of the invite-accept fix that prompted this review. `ensureProfile`'s upsert is race-safe. Recommend shipping the `addMember` reactivate fix + the `profiles.email` index in the next PR.
