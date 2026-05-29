# Sprint Plan — 2026-05-28

## Sprint A: Polish + Verification (~5 SP, unblocked)

| ID | SP | Task | File:Line | Source |
|----|----|------|-----------|--------|
| UX-D-02 | 1 | Invite: add proactive sign-up CTA (redirect before POST for signed-out users) | `app/invite/[token]/page.tsx` | 07-UX-INFO-DESIGN |
| UX-D-03 | 1 | Team member list: add `overflow-y-auto max-h-64` scroll container | `app/settings/teams/page.tsx` | 07-UX-INFO-DESIGN |
| UX-E-05 | 1 | Stepper labels: hide on `xs` screens (`hidden sm:block`) | `components/StepIndicator` or equivalent | 07-UX-INFO-DESIGN |
| DB-APPLY | 1 | Apply migration 0029 to production DB (via Render deploy) | `prisma/migrations/0029_*/migration.sql` | 06-SECURITY |
| DT-28-4 | 1 | Add WARNING comment to orchestrator schema re: missing 8 columns | `packages/orchestrator/prisma/schema.prisma` | 08-DATA-TIERS |

## Sprint B: Security Hardening (~3 SP, targeted)

| ID | SP | Task | File:Line | Source |
|----|----|------|-----------|--------|
| DT-27-2 | 2 | Invite-accept TOCTOU: wrap `findFirst` + `update` in `$transaction({ isolationLevel: 'Serializable' })` | `app/invite/[token]/route.ts:196` | 08-DATA-TIERS |
| SEC-01 | 1 | Verify migration 0029 applied cleanly (check index exists in prod) | `psql $DATABASE_URL -c "\di subscriptions_user_id_idx"` | 06-SECURITY |

## Sprint C: Feature Completion (~8 SP, requires design decisions)

| ID | SP | Task | File:Line | Source |
|----|----|------|-----------|--------|
| FEAT-01 | 3 | Real PDF preview: replace `mockPreview` placeholder | `app/upload-client.tsx:95` | 04-FEATURE-COMPLETENESS |
| TEST-01 | 2 | `web/lib/services/teams.ts` tests (Prisma transaction mocking) | New file | 05-TEST-GENERATION |
| TEST-02 | 2 | `web/lib/scoring/service.ts` tests (LLM mock patterns established) | New file | 05-TEST-GENERATION |
| TEST-03 | 1 | `orchestrator/src/lib/env.ts` tests (env var isolation harness) | New file | 05-TEST-GENERATION |

## External (Blocked — Ryan)

| ID | Task | Owner |
|----|------|-------|
| DEBT-01 | Female-teen voice IDs for `hybrid-voice-search.ts:38` | Ryan |
| POST-02 | Corpus ingestion at `/admin/corpus` (AI key enrollment) | Ryan |

## Deferred (Not Scheduled)

| ID | Task | Reason |
|----|------|--------|
| TEST-PROC | `generation/processor.ts` tests | Needs job queue + orchestrator mocking (Sprint C+) |
| UX-MOBILE | Advanced mobile layout review | Below polish threshold for current sprint |
