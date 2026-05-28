# Security & Quality — 2026-05-27

## Tenant isolation (from Data-Tiers audit)
**0 critical findings.** Every team/member/profile read and write in the delta
surface (`lib/services/teams.ts` + invite route) is correctly scoped by
`ownerId` / `userId` / membership gate. Auth is Clerk; isolation is enforced in
application Prisma `where` clauses (no RLS in this stack), and the delta paths do
it correctly.

## Information disclosure
| Pri | Finding | Status |
|-----|---------|--------|
| P1 | Dev "Generation Log" panel (job IDs, status, timing) rendered to all prod users — `generate-button.tsx` | ✅ FIXED (gated behind dev) |
| P2 | Invite diagnostics `console.log` ship to prod (token prefix only, low sensitivity) | Deferred — intentional, remove post-verification |

## Reliability / correctness
| Pri | Finding | Status |
|-----|---------|--------|
| HIGH | `addMember` re-invite of removed registered user → 500 (unique constraint) | DATA-01 — documented, needs PR |
| MED | invite-accept "new" branch not transactional (TOCTOU; mitigated by rate-limit) | DATA-03 — documented |
| LOW | `removeMember` leaves `userId` set (root cause of DATA-01) | bundle with DATA-01 |
| LOW | `ensureProfile` email backfill *would* overwrite user-edited email **if** an in-app email edit feature is added (no live impact today — email is Clerk-sourced only) | note for future |

## Input handling / XSS / injection
No new unsafe HTML injection sinks, no custom escaping, and no raw SQL in the
delta. CSP change (eac39ce) correctly scopes the orchestrator into `connect-src`.

## Quality
- 0 TypeScript errors, 0 `any` casts in delta.
- Semgrep: clean on session start (1.151.0).
- Failover infra is the one quality gap (untested) — TEST-02.
