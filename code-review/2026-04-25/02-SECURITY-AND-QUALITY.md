# Security & Quality — 2026-04-25

## Overall Security Rating: A

No open CRITICAL or HIGH security issues after this session. All findings from the
concurrent `code-review` agent that ran during this session have been addressed.

---

## Fixed This Session

### SEC-001 (RESOLVED): Download endpoint ownership bypass
`packages/orchestrator/src/index.ts:139`
The `if (userId)` guard on the ownership check could be bypassed if `req.user?.id`
was undefined, allowing unauthenticated users to download project files. Fixed: the
ownership check is now mandatory — 401 is returned immediately if no userId.

### SEC-002 (RESOLVED): Double-encoded path traversal
`packages/orchestrator/src/index.ts:133`
A single `decodeURIComponent()` call was missing before path traversal checks, allowing
`%252e%252e` to bypass the `..` check. Fixed: decode first, then validate.

### SEC-003 (RESOLVED): Global usedVoiceIds race condition
`packages/orchestrator/src/director/tools/voice-search.ts`
A module-level `Set` was shared across concurrent project invocations. Two parallel
project requests would pollute each other's used-voice tracking, potentially causing
voice collisions. Fixed via `createVoiceTools()` factory pattern with scoped Sets.

---

## Open Issues

### CQ-001 (MEDIUM): `comparable/index.ts` and `adviser/index.ts` services have no tests
Both services call external LLMs directly and have complex business logic (vector similarity,
recommendation generation). Without unit tests (mocking the AI call), regressions are
invisible. Priority: medium — these are post-auth services, not directly exploitable.

**Files:** `packages/web/lib/comparable/index.ts`, `packages/web/lib/adviser/index.ts`
**Effort:** 5 SP combined

### CQ-002 (LOW): `referral/upgrade` codes in source + env
Built-in referral codes (STORYMAGIC2026, SMCREATOR, etc.) are hardcoded in
`packages/web/app/api/referral/upgrade/route.ts:10`. This is intentional and the env
override mechanism exists, but the hardcoded codes should be rotated periodically.
Not a security vulnerability since the codes only grant free tier upgrades (no billing).

**File:** `packages/web/app/api/referral/upgrade/route.ts:10`
**Effort:** 0.5 SP (documentation or env migration)

---

## Authentication & Authorization: GREEN

All API routes reviewed:
- `upgrade/route.ts` — auth() checked, 401 returned ✅
- `referral/upgrade/route.ts` — auth() checked, 401 returned ✅
- `teams/[teamId]/members/route.ts` — `withAuth` middleware ✅
- `projects/[id]/voice-assignments/route.ts` — `withProjectAuth` middleware (ownership check built-in) ✅

## Input Validation: GREEN

- `InviteMemberSchema` — fixed `role: z.enum(...)` from `z.string()` this session ✅
- All new routes use Zod schemas ✅

## Type Safety: GREEN

- TypeScript: 0 errors (both packages)
- The one error in `teams/members/route.ts` (role type mismatch) was caught and fixed this session

## Error Handling: GREEN

- All new routes use `try/catch` with structured error returns
- `monitoring.ts` initial ping now uses `.catch(() => {})` to prevent unhandled rejection
