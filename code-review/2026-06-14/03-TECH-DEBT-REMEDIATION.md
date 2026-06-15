# Tech Debt Remediation — 2026-06-14

## Summary

| Pattern | Count | Real (app code) | Action |
|---------|-------|-----------------|--------|
| TODO/FIXME/HACK | 5 | 1 (`hybrid-voice-search.ts:38`) | Blocked by Ryan — DEBT-01 |
| `console.log` / `.debug` | 20 | 1 (`BuildStamp.tsx:21`) | Intentional; environment banner + dev-only build stamp |
| `: any` / `as any` | 101 | 14 | Sprint A — TS-CLEANUP-01 + small follow-ups |

## Detail

### TODO/FIXME

- `packages/orchestrator/src/director/tools/hybrid-voice-search.ts:38` — PLACEHOLDER for Ryan's female teen voice IDs. Blocked since 2026-05-19 — still blocked.
- 2 entries in `generated/prisma/runtime/library.d.ts` — generated client; don't touch.
- 1 in `director-validator.ts:30` — `/^TODO/i` regex used to flag user-supplied script TODO markers; intentional.

### console.log breakdown

| File | Count | Verdict |
|------|-------|---------|
| `orchestrator/src/lib/env.ts:221-239` | 19 | Boot banner only — keeps stdout-discoverable environment summary on cold start. INTENTIONAL — leave. |
| `web/lib/logger.ts` | 1 | This IS the logger module; production passes go through it. INTENTIONAL. |
| `web/components/BuildStamp.tsx:21` | 1 | Browser-only "Build: <ts>" stamp printed once on mount in dev preview. Acceptable. |

No P0/P1 cleanup. The pattern catches nothing actionable since the prior round.

### `as any` cast distribution (app code only — generated Prisma excluded)

| File | Count | Notes |
|------|-------|-------|
| `orchestrator/src/middleware/rate-limit.ts` | 3 | rate-limiter-flexible options shape unstable across versions; eslint-disable inline. |
| `orchestrator/src/lib/logger.ts` | 3 | structured-log meta passthrough; Logger interface narrows downstream. |
| `web/lib/generation/processor.ts` | 2 | `directorJson: any` × 2 — TS-CLEANUP-01 carryover. 1 SP to type via `DirectorJSON` shared schema. |
| `web/app/projects/[id]/project-workflow.tsx` | 1 | `directorJson: any` at line ~107 (drifted from prior 107). Same fix. |
| `web/app/projects/[id]/improvement-wizard-button.tsx` | 1 | `existingScore: any` — same fix. |
| `web/lib/api/rate-limit.ts` | 1 | Same rate-limiter-flexible reason. |
| `web/lib/ai/providers.ts` | 1 | OpenRouter wrapper cast — narrow but tolerable. |

**Sprint A budget:** 1 SP for `directorJson: any` → shared `DirectorJSON` type across 3 sites.

## Deferred

| File:Line | Pattern | Reason | Sprint |
|-----------|---------|--------|--------|
| `rate-limit.ts` × 4 | `as any` | Upstream type ambiguity in rate-limiter-flexible | Backlog |
| `logger.ts` × 3 | `any` in meta passthrough | Acceptable narrow surface | Backlog |

## Recommendation

No emergency cleanup needed. Bundle TS-CLEANUP-01 (3 `directorJson: any` sites) with the upcoming UI sprint that will already touch `project-workflow.tsx`. Estimated total: 1 SP.
