# Security & Quality — 2026-06-25

Combined findings from all three review parts: data-tier ownership, code-review V3 input validation, UX form-error coverage.

## Ownership / authorization

- **`withProjectAuth` patterns verified** (data-tier agent confirmed sub-account project-leakage prevention solid)
- **404 routes** under `packages/web/app/api/` — every user-scoped route reviewed in the past 4 cycles uses `withAuth` or `withProjectAuth` middleware
- **No new ownership-check gaps** flagged this cycle

## FK / cascade safety

| Finding | Severity | Status |
|---------|----------|--------|
| `CreditTransaction.jobId` has no FK | HIGH | **FIXED** — migration 0045 adds FK with `ON DELETE SET NULL` (preserves cost-ledger audit history) |
| `ContentAccessLog` back-relations missing `onDelete` (default RESTRICT) | MEDIUM | **FIXED** — migration 0045 sets `ON DELETE SET NULL` on `user_id` + `share_id` so Profile / ScriptShare deletions don't silently fail |
| Other 71 FK constraints | — | Verified by data-tier agent — properly defined or intentionally omitted |

## Input validation

- **`positiveIntEnv` helper (#412)** — strict integer parsing on env-driven knobs catches the `SCENES_PER_CHUNK=abc → NaN` silent-failure class
- **Zod schemas at API boundary** — `/generate-scenes`, `/orchestrate`, `/analyze`, `/preview`, `/stitch-segments` all validate body schema; reject with structured error
- **CSRF** — origin-allowlist check in `csrf.ts` with security-event console.warn (intentional, not debt)
- **No XSS-risk patterns** detected: 0 `dangerouslySetInnerHTML` in non-content surfaces; markdown rendering goes through sanitizer

## Token / connection limits

- undici headers timeout raised to 15 min (orch) / 25 min (web) — closes the 5-min silent-drop class
- SCENE_CONSTRUCTION_MAX_TOKENS bumped 16K → 32K with documented streaming caveat (Peter's #407)
- AbortController on every long-running fetch in `orchestratorFetch` — caller-set ceiling

## CSP / security headers

No changes this cycle. Last touched in PR #295 (06-22 cycle) — CSP `form-action` whitelist landed.

## Real-data risk register

| Risk | Likelihood | Status |
|------|-----------|--------|
| Phase D `chunkStartOffset` via `indexOf` could O(N) on huge scripts | low | flagged in #413 review as cosmetic; current path correct |
| Phase E verifier false-positives flood the repair pathway | unknown | telemetry to be collected; verifier currently per-scene-failure-tolerant |
| MAX_SCRIPT_CHARS=500000 may stress director context window | low | Peter's 32K output cap + Phase D adaptive sizing absorb |

## Recommended pre-GTM

1. `pnpm audit` rerun (carryover from 06-22 — Chris)
2. CSP `report-only` → enforced flip review (next cycle)
3. Phase E ConsistencyVerifier dev-mode opt-in for one Ryan test project (handoff doc Task 4)
