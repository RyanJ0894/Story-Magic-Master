# Sprint Plan — 2026-06-25

Unified plan merging all three review parts. Sprint 1 = highest-impact remaining work. Sprint E = blocked items.

## Sprint 1 (immediately actionable, 1–2 SP each)

| ID | SP | Title | Owner | Source |
|----|----|-------|-------|--------|
| MIG-0045 | 0 | Migration 0045 (CreditTransaction FK + ContentAccessLog onDelete) auto-deploys on next Render push | auto | DT-35-H-1 + DT-36-M-1 |
| UX-D-02 | 0.5 | Replace `bg-blue-500` → `bg-primary` in `preview-button.tsx:216,228` | Claude/Chris | UX agent |
| UX-I-05 | 0.5 | Install-prompt dismiss TTL + instrumentation | Claude/Chris | carryover 06-22 |
| ANALYZE-1 | 1 | Decide: retire orchestrator `/analyze` route OR re-route `/api/projects/[id]/score` through it | Claude/Chris | Phase 6 finding |

**Total Sprint 1: ~2 SP**

## Sprint A (post-GTM polish)

| ID | SP | Title | Source |
|----|----|-------|--------|
| TEST-ENV | 1 | env-validation.ts schema-pinning tests | test coverage gap |
| TEST-ADVISER | 2 | adviser/service.ts integration test with LLM mocks | test coverage gap |
| MAX-H-SCALE | 1 | enterprise/dashboard.tsx `max-h-[480px]` → flex layout or pagination | Phase 4.5 |

**Total Sprint A: 4 SP**

## Sprint E (blocked / external)

| ID | Title | Blocked by |
|----|-------|------------|
| RYAN-TASK-1 | 77-page script cache validation | Ryan |
| RYAN-TASK-2 | Phase C `DIRECTOR_CHARACTER_EXTRACTION_MODE=hybrid` runs | Ryan |
| RYAN-TASK-3 | Phase D `DIRECTOR_PASS3_ADAPTIVE_CHUNKS=true` runs | Ryan |
| RYAN-TASK-4 | Phase E verifier opt-in on one project | Ryan |
| T-01 | Voice-ID placeholder in hybrid-voice-search.ts:38 | Ryan |
| STRIPE-LIVE | Stripe live walkthrough (~1h) | Chris |
| UAT-PASS | UAT click-through (~2h) | Chris |
| AUDIT-NPM | `pnpm audit` rerun before GTM | Chris |
| PHASE-E-UI | Premium consistency badge UI + Stripe SKU | Ryan product spec |

## Sprint B (data-tier backlog, unchanged from 06-22)

| ID | SP | Title |
|----|----|-------|
| DT-33-L-2 | 0.5 | Doc: prisma db push vs migrations |
| DT-34-L-1 | 0 | Revisit team-comments pagination if perf complaints |
| DT-31-L-2 | 1 | PLAY-TOCTOU (deferred) |
| DT-27-2/5 | 1 | CONTENT-LOG-RETENTION (deferred) |

## Velocity check

- 06-16 → 06-22 cycle: 8 PRs merged
- 06-22 → 06-25 cycle: 11 PRs merged + 50 commits + full sampling architecture
- Test count +106 over the cycle

Trajectory is good. Sprint 1 above is genuinely 2 SP — most "work" is Ryan-blocked external data collection.
