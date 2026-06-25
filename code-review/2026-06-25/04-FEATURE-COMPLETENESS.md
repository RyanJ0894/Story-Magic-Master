# Feature Completeness — 2026-06-25

## Completed this cycle

| Feature | Gap filled | PR | Files changed |
|---------|------------|----|---------------|
| Long-script reliability | undici headers timeout on web + orch | #406, #414 | `lib/undici-dispatcher.ts`, `lib/orchestrator-fetch.ts` |
| SSE everywhere | `/analyze`, `/preview`, `/stitch-segments` | #402, #403 | 4 orchestrator routes |
| Progress UX | flat 120 s → per-page estimate | #404 | `generate-button.tsx` |
| Cross-project parse cache | new `director_scene_cache` table | #405 | migration 0043 |
| Sampling architecture | Phases A→E shipped flag-gated | #408–#411, #413 | new `sampling/` folder |
| Operational tuning | env-tunable + strict-int | #407, #412 | `env.ts` `positiveIntEnv` helper |
| Partial-completion threshold | majority-fail throws | #415 | `processor.ts` |
| UI retry tracking | `isRetryImminent` helper | #415 | `job-status.ts`, `generate-button.tsx`, `/api/jobs/[id]` |

## Wiring gaps (Phase 4.5 scan)

| Component | Call site | Missing | Source | SP |
|-----------|-----------|---------|--------|----|
| **(none found)** | — | — | — | — |

Phase 4.5 scan returned 0 mock-fallback placeholders and 0 unwired data props. The codebase is clean of the "built but not connected" class.

## Scale / format issues (Phase 4.5 scan)

| File:Line | Pattern | Fix | SP | Status |
|-----------|---------|-----|----|--------|
| `run-selector.tsx:105,184` | `toLocaleString(undefined,…)` | `'en-US'` | 1 | **Fixed** (UX-D-01) |
| `enterprise/dashboard/page.tsx:309,355` | `max-h-[480px]` on dynamic notification list | switch to flex layout or pagination at N>15 | 2 | P2 backlog |
| `preview-button.tsx:216,228` | `bg-blue-500` not in token palette | `bg-primary` | 0.5 | P2 backlog (UX-D-02) |

## Orchestrator endpoint coverage

| Orch route | Called from web? | Notes |
|------------|------------------|-------|
| `/generate-scenes` | ✓ `processor.ts` + `api/reader/upload/process` | wired |
| `/orchestrate` | ✓ `processor.ts` + `audio-tuning/preview` | wired |
| `/stitch-segments` | ✓ `processor.ts` | wired |
| `/preview` | ✓ `app/api/preview/route.ts` | wired |
| `/analyze` | **no web caller** | Possibly orphaned. `/api/projects/[id]/score` uses Vercel AI SDK directly, not orchestrator's `/analyze`. Flag for design review — should `/analyze` be retired, or `/api/score` be re-routed through it? |
| `/stems` | ✓ `app/api/projects/[id]/export/stems` | wired |
| `/impact` | ✓ `app/api/impact/stories/*` | wired |
| `/internal-manifest` | service-to-service only | by design |
| `/health` | Render probes + worker | by design |

## Still incomplete

| Feature | Gap | SP | Sprint |
|---------|-----|----|--------|
| Phase E UI (consistency check premium badge) | DB schema ready (migration 0044), no UI | 3 | When Ryan defines pricing |
| Phase E Stripe SKU | per-project add-on or subscription perk? | 2 | Ryan product decision |
| Phase F (audio cue batching) | speculative; want Phase B+C cost data first | 5 | Post-Ryan-data |
| Voice catalog voice_id placeholders | `hybrid-voice-search.ts:38` BLOCKED on Ryan | 0.5 | When Ryan provides IDs |
| `/analyze` callers | orphaned orchestrator route | review needed | next cycle |

## Blocked (external)

| Feature | Blocked by |
|---------|-----------|
| Phase B / C default-flip | Ryan running 4-task handoff (RYAN_HANDOFF_2026-06-25.md) |
| Phase E productization | Ryan: pricing + UI placement |
| Stripe live walkthrough | Chris |
