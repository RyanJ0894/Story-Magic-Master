# Test Generation Report — 2026-06-14

## Coverage Delta

| Package | 2026-06-09 | 2026-06-14 | Δ |
|---------|-----------|-----------|---|
| Orchestrator | 713 | 881 | +168 |
| Web (unit + component) | 1,273 | 1,343 | +70 |
| **Total** | **1,986** | **2,224** | **+238** |

All 2,224 passing on main. 0 TS errors. 59 orch test files + 102 web test files.

## Notable Tests Added Since Prior Review

The +238 tests were not written by the review process — they shipped with feature PRs:

- **H1-H8 hardening sprint** — boot-seed framework tests, safeUpdate race tests, manifest endpoint tests, fixture corpus parse harness (Fountain/FDX/plain text)
- **Voice catalog integrity** — voice_id uniqueness invariant (no longer `.fails`), gender inference unit tests
- **SW version injector** — 3 unit tests in `packages/web/tests/unit/inject-sw-version.test.ts` covering placeholder presence, injector regex match, regex idempotency
- **Listen flow regression** — `packages/web/tests/e2e/listen-back-link.spec.ts` (PR #275) — closes #206 in CI
- **Notification feed** — backend feed-types, producer wiring tests, frontend NotificationBell component tests (PRs #199/#200/#201 if merged; verify)
- **Health endpoint** — Whisper + Groq alignment readiness (#268)

## Tests Written By Review Process This Session

None. All findings either resolve to existing tests (carryovers verified via PR diffs) or are gated on Sprint A code changes that don't ship today.

## Recommended New Tests (gated on Sprint A PR)

| Test File | Purpose | Tied to Finding |
|-----------|---------|-----------------|
| `packages/web/tests/unit/api/projects-route.test.ts` (NEW or extend) | Sub-account in team with two shares, only one has `ProjectAssignment` — list returns exactly that one | DT-32-H-1 |
| `packages/web/tests/unit/lib/services/projects-list.test.ts` | Direct unit test on `listProjects()` predicate composition | DT-32-H-1 |
| `packages/orchestrator/tests/lib/cleanup-content-access-log.test.ts` | 90-day retention cron deletes rows older than threshold | CONTENT-LOG-RETENTION |
| `packages/web/tests/unit/api/admin-tier-subscription-upsert.test.ts` | After tier change via admin/tier, `subscriptions` row exists for user | DT-30-M-1 |

## Still Uncovered (Backlog)

| Module | Reason |
|--------|--------|
| Direct integration tests against Stripe live mode | Manual UAT only — covered by `STRIPE-LIVE-WALKTHROUGH-2026-06-13.md` |
| Cross-package E2E against R2 audio + SW interaction | Requires production-like environment |
| Whisper.cpp model corruption recovery | Hard to simulate in CI; manual UAT instead |
