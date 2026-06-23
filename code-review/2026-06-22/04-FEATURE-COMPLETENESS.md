# Feature Completeness — 2026-06-22

## Completed This Session (50 commits since 2026-06-16)

### Ryan's 6/21 list — all 7 items resolved on dev

| Item | PR | Status |
|---|---|---|
| **P** — 15-page audio gen failures | #360 | merged main — empty audio_urls classifier branch |
| **Y** — "perceived instant" progressive playback | #361 | open, on dev — FIRST_CHUNK_SCENES=2 + UX copy |
| **i** — Master sees sub-account activity | #356 | merged main — project_created + script_uploaded producers |
| **k** — Audio quality tuning | #357 + #363 | #357 open on dev, #363 merged — +3 dB / narrator 1.1 / A-005 edges |
| **l** — "+ Add Notes" wording | #344 | merged main |
| **n** — Like/Pass project-level toolbar | #362 | merged main — ProjectReactionBar + ProjectReactionBadge |
| **o** — Team invite logo | #344 | merged main |

### Infrastructure (Doppler→Render, dev environment)

- `render-dev.yaml` blueprint adds story-magic-worker-dev + story-magic-redis-dev
- Doppler→Render native sync wired for all 3 dev services (`bedc5b00-…` integration)
- Dev Doppler config grew 50 → 95 secrets matching prod (with stripe/clerk URLs preserved env-specific)
- Worker-dev / web-dev / orch-dev all healthy on commit `1f7b4c2`

### Late-cycle fixes (post-Ryan 6/22 ask)

- PR #361 amended with FIRST_CHUNK_SCENES=2 → first audio at ~13% (was ~33%)
- A-005 narrator voice_key preservation (PR #364) closed the validator's HTTP 400 that was masking as "no audio produced"

## Wiring Gaps (from Phase 4.5)

**None.** Zero `?? mockX` fallback patterns in production. Every component renders real data at its call site.

## Scale/Format Issues (from Phase 4.5)

**None.** Zero unguarded `max-h-[Npx]` on DB-driven lists. Zero `toLocaleString()` without explicit `'en-US'` locale.

## Still Incomplete

### Open PRs (low-risk, ready)

| PR | Status | SP |
|---|---|---|
| #337 ElevenLabs shape fallback | CONFLICTING — left for Peter to reconcile against #341 instrumentation | medium |
| #357 audio tuning defaults | MERGEABLE — awaiting Peter | 1 |
| #361 progressive playback amendments | MERGEABLE — awaiting Peter | 3 |

### Carryovers (post-GTM polish)

| ID | Title | SP |
|---|---|---|
| UX-I-02 | Slider aria-label | 0.5 |
| UX-I-03 | Reset preserves Lock | 0.5 |
| UX-I-04 | `<source key>` on preview | 0.5 |
| UX-I-05 | Install-prompt TTL | 0.5 |
| T-01 | voice-ID placeholder | 1 (BLOCKED on Ryan) |

## Blocked (External)

| Feature | Blocked By |
|---|---|
| T-01 voice-ID placeholder | Ryan picking which voice IDs are canonical from current 137-voice catalog |
| Stripe live walkthrough | Chris (~1h) — pre-launch checklist |
| UAT click-through | Chris (~2h) — pre-launch checklist |
| Ryan ANSWERS-5-Page-Sample retest | Ready to run; cleared director cache + new A-005 will pick fresh voices |

## Production deploy readiness

Dev has every Ryan-blocker resolved. Once Peter merges #357 + #361 into main, the launch path is:
1. (this session) — dev rebuilt clean, 2,543 tests green
2. Peter merges #357, #361
3. main redeploys to prod (auto via render.yaml)
4. Stripe walkthrough + UAT (non-engineering)
5. Public launch

No engineering blockers remain.
