# Cost Optimization Plan — Phase 2

**Date:** 2026-06-09
**Owner:** chris@servicevision.net
**Tracking issue:** [#182](https://github.com/dbbuilder-org/story-magic/issues/182)
**Builds on:** `docs/MODEL_MATRIX.md`, `docs/ROADMAP-2026-06-09.md`

> Phase 1 (#178, #179, #181) eliminated dual-billing, shifted voice-assignment to Haiku, and restored audio search.
> Phase 2 attacks **token volume** (not model choice) — the unspent savings are in *how* we feed the models, not *which* model.

---

## Token-Centric Insight

We pay for input tokens far more than output. Every `/analyze` re-sends an identical ~5K-token system prompt + tool definitions across 4–6 score calls and 1+ scene calls. Anthropic prompt caching, batched calls, and a Haiku swap on shallow tool-use paths together cut input token volume an estimated 60–70% on the common path.

---

## Tier 1 — Ship This Sprint (3 PRs)

### PR A — Audio director → Haiku 4.5
**Goal:** Shift the audio director (music/ambience/SFX selection via tool calls) from Sonnet 4.6 → Haiku 4.5. Direct analog to #179 (voice-assignment Haiku).

**Why it's first:** Smallest blast radius. Proven pattern. Reversible via env var.

**Approach:**
- Add `AUDIO_DIRECTOR_MODEL` env (already defined in matrix but not yet wired) defaulting to `anthropic/claude-haiku-4-5`
- Update audio director agent to use `AUDIO_DIRECTOR_MODEL` first, fall back to `DIRECTOR_MODEL`
- Mirror the test pattern from `voice-assignment-agent.test.ts` model-selection block
- Update `MODEL_MATRIX.md` row

**Risk:** Audio search picks might dip in quality. Mitigation: A/B against current Sonnet picks on 3 smoke scripts before flipping default; can revert via env var if quality regresses.

**Est:** 1 SP. ~12× cheaper on the audio search path.

---

### PR B — Anthropic prompt caching on director system prompts
**Goal:** Mark the static prefix (system prompt + tool defs + audio catalog excerpts) as cached. Subsequent calls within the 5-min TTL pay ~10% input cost on those tokens.

**Why second:** Foundation for PR C. Affects every Claude call routed through `llm-client.ts`.

**Approach:**
- Add `cache_control: { type: 'ephemeral' }` breakpoint on system message in `runAgentLoop` and `generateStructuredOutput` (per `@ai-sdk/anthropic` v3 syntax — uses `providerOptions: { anthropic: { cacheControl: ... } }`)
- Detect via env: `ENABLE_PROMPT_CACHE` defaulted on for Anthropic models, no-op for OpenAI/OpenRouter (they don't support it)
- Test: cache control passed correctly via mocked `runAgentLoop`/`generateObject`; no behavior change on cache miss
- Document estimated savings in `MODEL_MATRIX.md` cost-levers section

**Risk:** AI SDK syntax may have caveats with structured-output + cache control. Mitigation: feature-flag the cache; can disable instantly if it breaks `generateObject` shape.

**Est:** 2 SP. Estimated 40–70% input-token reduction on repeat calls within a `/analyze`.

---

### PR C — Batched script-score dimensions (4 calls → 1)
**Goal:** Today `script-score-service.ts` makes 4 separate `generateStructuredOutput` calls (writing / story / commercial / production), each re-paying the full system-prompt + script-text cost. Merge into one call returning the union shape.

**Why last:** Benefits multiplicatively from PR B (cached prefix means single call gets cache hit AND fewer calls). Schema change is biggest in this PR.

**Approach:**
- New `ScriptScoreAllDimensionsSchema` returning `{ writing, story, commercial, production }`
- Single `generateStructuredOutput` call with merged rubric prompt
- Post-LLM splitter writes 4 score records (keeps DB shape backward-compatible)
- Tests: contract check on `generateStructuredOutput` call count (was 4, now 1); retry test still works as 1-call contract

**Risk:** Composite quality may dip slightly — Claude has to context-switch between rubrics. Mitigation: gate behind `BATCHED_SCORING_ENABLED=true` env (off by default in this PR; flip on after corpus A/B). Worst case revert via env.

**Est:** 3 SP. ~75% cost cut on `/analyze` once enabled.

---

## Tier 2 — Next Sprint (after measuring Tier 1)

| ID | Item | Effort | Why wait |
|----|------|--------|----------|
| T2-1 | Embedding query cache (LRU/Redis) | 2 SP | Measure repeat rate first using `llm_call_log` (T3-3) |
| T2-2 | Scene-level idempotency cache | 5 SP | Highest value with real iteration traffic — staging is too synthetic |
| T2-3 | Tiered model selection by script complexity | 2 SP | Needs Tier-1 baseline measurements to pick boundary |
| T2-4 | Groq Whisper as fallback layer | 2 SP | Local whisper.cpp covers most cases; lower priority |

---

## Tier 3 — Defensive / already-tracked

Carried from `ROADMAP-2026-06-09.md` follow-ups:

| ID | Item | Effort |
|----|------|--------|
| T3-1 | TEST_MODE mock provider (Peter's iteration loop) | 3 SP |
| T3-2 | Migrate `web/lib/adviser/service.ts` + `web/lib/ai/llm-call.ts` to llm-client | 4 SP |
| T3-3 | Wire OpenRouter as Anthropic relief valve | 3 SP |
| T3-4 | `llm_call_log` table for per-script cost attribution | 3 SP |
| T3-5 | Per-operation wall-clock budget on `/analyze` | 1 SP |
| T3-6 | Lint rule: ban `.min()`/`.max()` on Zod passed to `generateObject` | 2 SP |

---

## Acceptance Criteria for Phase 2

1. All Tier 1 PRs merged.
2. No regression in audio quality (manual A/B on 3 smoke scripts).
3. No regression in script-score quality vs. existing corpus baseline.
4. Cache hit rate observable in orchestrator logs (debug-level OK).
5. `MODEL_MATRIX.md` updated with Phase 2 entries + new history row.

---

## Sequence Rationale

Risk-ordered execution:
- **A** (Haiku) is a proven pattern (mirrors #179) and reversible via env var. If it ships breaking quality, revert is one Render env update.
- **B** (caching) is foundational and affects every Claude call. Ship before C so C inherits the cache.
- **C** (batched scoring) is the biggest single-PR shape change. Ship last with B's cache infrastructure already live.

Each PR opens, gets reviewed, and merges before the next opens (matches the 3-PR session ceiling in CLAUDE.md and avoids file conflicts in `llm-client.ts`).

---

## Out of Scope for Phase 2

- Streaming partial scenes (reliability concern, not cost)
- Smaller chunks for long scripts (needs measurement)
- Migration of Adviser to Claude (in T3, separate session)
- Production cost dashboards (depends on T3-4 first)
