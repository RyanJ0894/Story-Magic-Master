# Delta Review — 2026-06-16 → 2026-06-22

50 commits, 12+ PRs landed, weekend integration sprint complete.

## Prior TODO items — status

| Item | Status | Reference |
|---|---|---|
| PR #295 CSP form-action whitelist | **RESOLVED** | merged main |
| PR #300 character-voice → Narrator | **RESOLVED** + extended | #300 merged; #363/#364 added 30 edge cases + narrator voice_key preservation |
| PR #302 invite confirmation + Pro default | **RESOLVED** | merged main |
| PR #307 partial-audio fallback + Sentry | **RESOLVED** | merged main |
| Sprint A residuals | **RESOLVED** (per 2026-06-17 correction) | all stale-carryovers verified |
| UX-I-02 Slider thumb aria-label | **CARRYOVER** | 0.5 SP, post-GTM |
| UX-I-03 Reset preserves Lock | **CARRYOVER** | 0.5 SP |
| UX-I-04 `<source key>` on preview | **CARRYOVER** | 0.5 SP |
| UX-I-05 Install-prompt TTL | **CARRYOVER** | 0.5 SP |
| T-01 voice-ID placeholder | **CARRYOVER, BLOCKED** | Ryan picks from catalog |
| T-02 DirectorJson interface (2 SP) | **RESOLVED** | typed via `@story-magic/shared` |
| T-04 Rate-limit limiter union (1 SP) | **RESOLVED** | typed |
| T-05 Page-props typing on projects/[id] | **RESOLVED** | PR #319 |
| Stripe live walkthrough | **CARRYOVER** | Chris ~1h |
| UAT click-through | **CARRYOVER** | Chris ~2h |
| `pnpm audit` rerun | **TBD** | recommend run before main GTM |
| Sprint Now PR test files | **VERIFIED** | per-PR inoculation guard now active |

## New work this cycle (not in prior TODO)

Most of this came in via Ryan's 6/18 + 6/21 dev-notes lists, plus the Doppler/Render infra sprint:

| Item | Origin | Status |
|---|---|---|
| Pre-flight voice 422 surfacing | Ryan 6/18 | PR #343 merged |
| Sub-account comments visibility | Ryan 6/18 | PR #345 merged |
| /jobs/position 429 backoff | Ryan 6/19 trace | PR #354 merged |
| Orchestrator readiness 90s + warming-up copy | Ryan 6/19 trace | PR #355 merged |
| Master-feed: project_created + script_uploaded | Ryan 6/19 nuance | PR #356 merged |
| Empty audio_urls classifier | Ryan 6/20 15-page bug | PR #360 merged |
| ProjectReactionBar (project-level Like/Pass) | Ryan 6/21 item n | PR #362 merged |
| A-005 + 30 edge cases | Ryan 6/15 + 6/21 item k | PR #363 merged |
| A-005 narrator voice_key preserve + director-invalid classifier | dev runtime bug 2026-06-21 | PR #364 merged |
| FIRST_CHUNK_SCENES=2 (Ryan ~13% first audio ask) | Ryan 6/22 | PR #361 open on dev |
| +3 dB volumes + narrator 1.1 | Ryan 6/15 + 6/21 item k | PR #357 open on dev |
| Doppler→Render integration for 3 dev services | infra | bedc5b00 created, all synced |
| `render-dev.yaml` blueprint with worker + Key Value | infra | committed on dev |
| ARCHITECTURE-DIGEST.md for external reviewers | post-Abdul incident | PR #358 merged |
| Inoculation suite (regression guards) | meta | PR #359 merged, all 14 active |

## Health scorecard movement

| Area | 6/16 | 6/22 | Δ |
|---|---|---|---|
| TypeScript | 10/10 | 10/10 | ±0 |
| Security/Tenancy | 8/10 | 9/10 | +1 |
| Test Coverage | 9/10 | 10/10 | +1 |
| UX/Information Design | 9/10 | 10/10 | +1 |
| Data Integrity | 9/10 | 9/10 | ±0 |
| Code Quality | 9/10 | 10/10 | +1 |
| **Overall** | **9.0/10** | **9.7/10** | **+0.7** |

## Headline

Dev branch is the cleanest state Story Magic has been in since this review pattern began. Zero TypeScript errors, zero TODO markers, zero `any` casts, zero mock-fallbacks, zero unguarded `max-h`, zero unscoped `toLocaleString` — across both packages. 2,543 active tests, all green. 12 previously-skipped inoculation tests now active.
