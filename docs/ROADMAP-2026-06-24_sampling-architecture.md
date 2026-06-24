# Sampling-Based Director Architecture — Roadmap

**Date:** 2026-06-24
**Companion to:** `docs/SAMPLING_ARCHITECTURE_DESIGN_2026-06-24.md`
**Status:** Phase A execution starting now

---

## What Peter's PR #407 teaches us (added 2026-06-24)

While drafting Phase B, Peter shipped #407 fixing a class of failure we
hadn't surfaced in the design doc: `NoObjectGeneratedError` on dense
15-scene chunks exceeding the 16 K output token cap. His fix made
`SCENES_PER_CHUNK` and `SCENE_CONSTRUCTION_MAX_TOKENS` env-tunable with
new defaults of 10 and 32768 respectively.

The architectural lesson: **output-token budget management is as
important as input** for the director pipeline. Our sampling work has
focused on shrinking *input* (Phase A's regex Pass 0, Phase B's stitched
sample for Pass 2). Output budget was implicit. After #407 it has to be
explicit:

1. **Dense scenes can blow the output cap** — high dialogue density (lots
   of short lines per scene) means high output tokens per scene. The
   chunk size that's safe for a sparse procedural is unsafe for a
   dialogue-driven drama.
2. **Streaming vs non-streaming changes the safe ceiling.** Per #407's
   `render.yaml` comment, non-streaming requests should stay under ~16 K
   to avoid SDK HTTP timeouts. 32 K is configured but actual runs may
   still need to stay lower unless `generateStructuredOutput` is
   streaming.
3. **Chunk size belongs in the same decision tree as `CharacterIndex`.**
   Pass 0 already tells us chars-per-scene density; Phase D should use
   that to *pick* the chunk size per script instead of hardcoding a
   global default.

Phase D has been revised (5 SP, up from 3) to fold this in — see below.

---

## Honest framing (refined from the design doc)

The architectural argument holds, with these corrections to my initial numbers:

| Claim in design doc | Refined reality |
|---|---|
| 100-page run costs ~$1.03 today | Closer to $0.50–0.70 |
| Savings of ~$0.30 per run | More like $0.10–0.20 per run |
| Wall-clock savings of 60–120 s | Wall-clock savings of 30–60 s (Pass 1 elimination); Pass 3 dominates and is irreducible |
| Tonight's "scripts fail at 26 min" problem | Already solved by PR #406 (undici headers-timeout bump). This roadmap is for *cost* and *voice quality*, not the timeout failure. |

The savings are still meaningful at scale (1000 long runs/month → ~$100–200/mo saved) and the voice-quality improvement is the real unlock. But framing it as "saves $0.30 per run" was optimistic.

---

## Sprint plan

5 phases, 26 SP, sequenced for low-risk rollout. Phase A is starting tonight.

### Phase A — Foundation: deterministic CharacterIndex + IntroStitcher (5 SP)

**Status:** in progress
**Owner:** Claude / Chris
**Dependencies:** none
**Risk to live pipeline:** zero — runs in shadow mode only

| Task | SP |
|---|----|
| A-1 | `packages/orchestrator/src/director/sampling/character-index.ts` — regex + state machine to detect character cues, build `CharacterIndex` with confidence score |
| A-2 | `packages/orchestrator/src/director/sampling/intro-stitcher.ts` — interval-merge dedup, `StitchedSample` output |
| A-3 | Characterization tests against `Samples/` PDFs (already in repo) |
| A-4 | Shadow-mode telemetry hook in `director-agent.ts` — log `pass0.confidence`, `sample.original_chars`, `sample.stitched_chars`, `pass0.regex_vs_llm_character_overlap` — no behavior change |
| A-5 | Hard rule: regex MUST operate on offsets only, never modify `scriptText`. Test asserts byte-identity of any scene-text slice taken before/after Pass 0. |

**Exit criteria:**
- All tests green
- Shadow telemetry deployed to dev
- 1 week of shadow data collected on real uploads → discrepancy rate vs current LLM Pass 1 documented

### Phase B — Voice assignment from sample (5 SP)

**Status:** queued
**Owner:** Claude / Chris
**Dependencies:** Phase A complete + shadow data shows < 5 % discrepancy
**Risk:** medium — quality-affecting change to the voice path

| Task | SP |
|---|----|
| B-1 | New `VoiceAssignmentAgent` mode: `assignFromSample(stitchedSample, characterIndex)` |
| B-2 | Feature flag `DIRECTOR_VOICE_FROM_SAMPLE` (default OFF) |
| B-3 | Side-by-side comparison logging when both old + new paths run |
| B-4 | Snapshot tests on representative scripts (DIG, ANSWERS, others from `Samples/`) |
| B-5 | A/B canary on dev: 10 % of jobs use new path; compare voice-pick stability per project across re-runs |

**Exit criteria:**
- Snapshot tests pass on all `Samples/` scripts
- A/B shows new path produces ≥ as varied a voice cast (entropy metric)
- Ryan + Peter sign off on a sample comparison

### Phase C — Pass 0 regex replacement (5 SP)

**Status:** queued
**Owner:** Claude / Chris
**Dependencies:** Phase A complete + shadow telemetry shows confidence high on > 95 % of uploads
**Risk:** medium — removes an LLM call from the live path

| Task | SP |
|---|----|
| C-1 | Feature flag `DIRECTOR_CHARACTER_EXTRACTION_MODE=regex\|llm\|hybrid` |
| C-2 | Hybrid mode runs both; compares output; prefers regex when confidence high; logs delta |
| C-3 | 2 weeks of `hybrid` data on dev |
| C-4 | Switch default to `regex` if discrepancy < 2 % |
| C-5 | Fallback path: low confidence → LLM Pass 1 (existing code retained, gated by confidence not feature flag) |

**Exit criteria:**
- Discrepancy rate < 2 % over 2 weeks
- Peter approval to flip default

### Phase D — Pass 3 prompt refinement + adaptive chunk sizing (5 SP, revised after PR #407)

**Status:** queued (after Phase B and Peter's #407)
**Owner:** Claude / Chris
**Dependencies:** Phase B shipped (so voice context is settled pre-Pass-3); PR #407 merged (chunk size + output budget are env-tunable)
**Risk:** medium — touches the largest LLM pass

**Incorporates Peter's #407 insight:** SceneConstructionAgent was crashing
with `NoObjectGeneratedError` because dense 15-scene chunks exceeded the
16K output token cap. His fix moved chunk size + max-tokens to env
(`SCENES_PER_CHUNK=10`, `SCENE_CONSTRUCTION_MAX_TOKENS=32768`) with a
critical caveat: **non-streaming requests should stay under ~16K to avoid
SDK HTTP timeouts. 32K is safe only with streaming.**

Treating output-token budget as a first-class concern reframes Phase D:
the goal isn't just a "tighter prompt"; it's making chunk size **adaptive**
to script density, using Pass 0's `CharacterIndex` as the signal.

| Task | SP |
|---|----|
| D-1 | Strip voice/character preamble from Pass 3 system prompt (voice context is settled in Phase B) |
| D-2 | Pre-tag character cues in chunk input using `CharacterIndex` offsets — Pass 3 doesn't have to re-detect them |
| D-3 | **Adaptive chunk sizing.** Compute chars-per-scene from Pass 0's scene boundaries; if dense (>3K chars/scene avg), drop chunk size to 5–7; if sparse (<1K chars/scene avg), raise to 12–15. Target each chunk's projected output size at ~70% of `SCENE_CONSTRUCTION_MAX_TOKENS`. |
| D-4 | **Output-token telemetry.** Log projected vs actual output size per chunk so we see when chunks come close to the cap *before* they fail. |
| D-5 | Feature flag `DIRECTOR_PASS3_ADAPTIVE_CHUNKS` (default OFF) gates D-3 + D-4. D-1/D-2 trim-prompt changes ship unflagged after A/B. |
| D-6 | Measure: chunks-per-second, output schema validation rate, `NoObjectGeneratedError` rate before/after |

**Exit criteria:**
- No regression in `DirectorJSONValidator` pass rate
- Wall-clock measurable improvement (≥ 5% per-chunk)
- Adaptive sizing reduces output-cap near-miss rate to <1% on dense scripts (signal from D-4 telemetry)

**Open question Peter's PR surfaced:** is `generateStructuredOutput` currently streaming? If not, the 32K cap is only safe to *configure* — actual runs would still need to stay under ~16K to avoid SDK HTTP timeouts. Worth confirming before Phase D ships.

### Phase E — Advanced Consistency Check (8 SP)

**Status:** queued (premium feature)
**Owner:** Claude / Chris + Ryan for product spec
**Dependencies:** Phase A complete (for CharacterIndex), Phase B helpful but not required
**Risk:** low — additive, opt-in only

| Task | SP |
|---|----|
| E-1 | New `ConsistencyVerifierAgent` using Haiku |
| E-2 | DB schema: `profile.advanced_consistency_check_enabled: bool` |
| E-3 | DB schema: `project.is_advanced_check_enabled: bool` (per-project override) |
| E-4 | Pipeline integration: run after Pass 3, before final assembly |
| E-5 | Repair pathway: localized fix vs targeted Pass 3 re-run |
| E-6 | UI surface: badge on project page indicating "Advanced consistency on" |
| E-7 | Stripe SKU if billing per-project (TBD with Ryan) |
| E-8 | Telemetry: verifier failure rate, repair rate, escalation rate |

**Exit criteria:**
- Working end-to-end on dev with feature flag
- Ryan sign-off on UX
- Pricing decision documented

### Phase F — Audio cue batching by representative scene (5 SP)

**Status:** queued (deferred until value confirmed)
**Owner:** Claude / Chris
**Dependencies:** none structural, but should wait until Phases A–D have stabilized
**Risk:** medium — touches audio quality

| Task | SP |
|---|----|
| F-1 | Cluster scenes by `(mood, intensity, location_type)` tuple |
| F-2 | Pick representative scene per cluster, run audio cue selection once |
| F-3 | Apply same cues to similar scenes with minor variation |
| F-4 | A/B compare with current per-scene audio cue selection |
| F-5 | Quality eval: does batched audio reduce variety in a noticeable way? |

**Exit criteria:**
- Telemetry shows cost savings ≥ 20 % on Pass 3 audio cue portion
- No audible regression in spot listens

### Total: 33 SP across 6 phases (+2 for Phase D's #407 incorporation)

---

## Dependency graph

```
Phase A ─┬─▶ Phase B ─┬─▶ Phase D
         │            │
         ├─▶ Phase C  │
         │            ▼
         └─▶ Phase E ◀┘

Phase F: independent, queued after A-D stabilize
```

---

## Sprint-level pacing

| Sprint | Phases | SP |
|---|---|---|
| Sprint 1 (this week) | Phase A + start Phase B prototype | 7 |
| Sprint 2 | Phase B complete, Phase C in hybrid mode | 6 |
| Sprint 3 | Phase D, Phase C flip default | 6 |
| Sprint 4 | Phase E (premium feature) | 8 |
| Sprint 5 | Phase F if value confirmed | 5 |

---

## Quality metrics we'll track from day 1

Even Phase A (shadow mode) logs:

- `pass0.confidence` per upload — distribution over time
- `pass0.regex_chars_found` / `pass1.llm_chars_found` — overlap rate
- `sample.original_chars` / `sample.stitched_chars` — dedup ratio
- `sample.characters_covered` — per script

These telemetry signals are what unblock Phase B/C decisions. Without them we're flying blind on rollout thresholds.

---

## Risk register

| Risk | Mitigation | Phase |
|---|---|---|
| PDF format quirks break regex | Confidence score + LLM fallback | A |
| Scene-cache (#405) hash invalidation | Hard rule: never modify scriptText, only offsets | A |
| Voice picks worse than today on edge cases | A/B canary + Pass 4 spot check + rollback flag | B |
| Pass 3 prompt change regresses parse quality | A/B with `DirectorJSONValidator` rate as gate | D |
| Pass 4 false-positive flood | Tune verifier prompt; raise discrepancy threshold | E |
| Audio cue batching reduces variety audibly | Spot-listen quality eval before default-on | F |

---

## What Phase A produces (executing now)

1. `packages/orchestrator/src/director/sampling/character-index.ts` — regex extractor, `CharacterIndex` data structure, confidence scoring
2. `packages/orchestrator/src/director/sampling/intro-stitcher.ts` — interval-merge dedup, `StitchedSample`
3. Comprehensive test coverage on both modules
4. Shadow-mode hook in `director-agent.ts` that logs telemetry without affecting behavior
5. Byte-identity test ensuring `scriptText` slices stay stable through Pass 0 (cache-hash compatibility guarantee)
6. PR targeting `main`, cherry-picked to `dev`

No behavior change. Pure foundation + observability.
