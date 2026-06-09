# Model Matrix — Story Magic LLM Usage

**Last updated:** 2026-06-08
**Owner:** chris@servicevision.net

This is the single source of truth for which AI model each operation uses, how to swap it via env var, and the cost/quality rationale. Read this **before** adding a new LLM call.

---

## Provider Strategy

| Provider | Role | Cost tier | Failover position |
|----------|------|-----------|-------------------|
| **Anthropic Claude** | Primary for all reasoning/generation | $$ | 1st (default) |
| **OpenRouter** | Anthropic relief valve (different billing account) | $$ | 2nd (if `OPENROUTER_API_KEY` set) |
| **OpenAI** | Last-resort fallback + embeddings (no Claude alternative) + optional Whisper | $$$ | 3rd |
| **Groq** | Cheap fast inference; recommended for batch corpus scoring | $ | (manual selection) |
| **Google Gemini** | Batch corpus scoring (1M context) | $ | (manual selection) |

The failover chain is implemented in `packages/orchestrator/src/lib/llm-client.ts` (`buildFailoverChain`). Any operation that goes through `runAgentLoop()` or `generateStructuredOutput()` automatically benefits from it.

---

## Operation Matrix

| Operation | Model (default) | Env var override | Cost rationale |
|-----------|-----------------|------------------|----------------|
| **Director: character extraction** | `anthropic/claude-sonnet-4-6` | `DIRECTOR_MODEL` | Reasoning-heavy. Sonnet is the right cost/quality tradeoff. Don't drop to Haiku — character inference quality suffers. |
| **Director: voice assignment** | `anthropic/claude-sonnet-4-6` | `DIRECTOR_MODEL` | Tool-use heavy (search_voices, commit_voice). Sonnet's tool reasoning matters here. |
| **Director: scene construction** | `anthropic/claude-sonnet-4-6` | `DIRECTOR_MODEL` | Heaviest call (~18K tokens of JSON per chunk). Needs Sonnet. |
| **Director: legacy single-pass** | `anthropic/claude-sonnet-4-6` | `DIRECTOR_MODEL` | Fallback path only; rarely hit. |
| **Director: Advanced Analysis (paid)** | `anthropic/claude-opus-4-6` | `DIRECTOR_MODEL_ADVANCED` | Paid $9.99 add-on. Opus only for users who paid for the upgrade. Server-side gated. |
| **Audio director** | `anthropic/claude-haiku-4-5` | `AUDIO_DIRECTOR_MODEL` | Tool-heavy + shallow per-decision (each `search_music/ambience/sfx` picks from a short ranked list). Haiku 4.5 = ~1/12 the cost of Sonnet. **Was `openai/gpt-4.1` until 2026-06-09** — another raw-OpenAI bypass missed in #178. |
| **Script Score (writing/story/commercial/production)** | `anthropic/claude-sonnet-4-6` | `SCRIPT_SCORE_MODEL` → `DIRECTOR_MODEL` | **Was `openai/gpt-4o` until 2026-06-08** — caused dual billing on every analysis. Now uses Claude with full failover chain. |
| **Script Score (dialogue/structural deep dive)** | `anthropic/claude-sonnet-4-6` | `SCRIPT_SCORE_MODEL` | Opt-in via `include_dialogue_deep_dive` / `include_structural_analysis` request flags. Expensive — keep off for tests. |
| **Script Score (quick triage)** | `anthropic/claude-sonnet-4-6` | `SCRIPT_SCORE_MODEL` | Light single-call summary. |
| **Story Adviser (web)** | `claude-sonnet-4-6` (via `lib/ai/providers.ts`) | `options.model` param | **Migrated 2026-06-09** (T3-2 of cost-opt Phase 2). Was raw OpenAI `gpt-4o`. Uses the same provider abstraction as scoring service. |
| **Web `callLLMAndParse` utility** | _(removed 2026-06-09)_ | — | File deleted in T3-2 PR. Was unused; replaced by direct `providers.ts` calls in callers. |
| **Scoring service (web)** | `claude-sonnet-4-6` | `MODELS.PRODUCTION` | Already on Claude via `resolveModel()`. |
| **Corpus batch scoring** | `gemini-2.5-flash` | `MODELS.BATCH` | 1M context + cheap. Right tool for the job. |
| **Embeddings (comparables, queries)** | `openai/text-embedding-ada-002` | _(hardcoded)_ | **Anthropic does not offer embeddings.** OpenAI is mandatory here. |
| **Whisper alignment (primary)** | `whisper.cpp` local | `WHISPER_CPP_PATH` | Free, run on disk. |
| **Whisper alignment (fallback)** | duration estimator (no LLM) | `ENABLE_OPENAI_WHISPER_FALLBACK=true` to enable paid OpenAI Whisper | **Was unconditional OpenAI Whisper fallback** — billed every time whisper.cpp failed. Now opt-in. |

---

## Failover Chain (orchestrator)

Everything that calls `runAgentLoop()` or `generateStructuredOutput()` inherits this:

```
DIRECTOR_MODEL (anthropic/claude-sonnet-4-6 by default)
  ↓ (on 402/429/529 or "credit balance" / "overloaded" error)
openrouter/anthropic/<same Claude model>   [if OPENROUTER_API_KEY set]
   ↓ (same Claude model via OpenRouter — preserves quality + cost tier;
      OpenRouter has a separate billing account so direct-Anthropic
      throttling doesn't cascade here)
  ↓ (on same conditions)
openai/gpt-4.1                [if OPENAI_API_KEY set]
   ↓ (last-resort escape — quality + cost shift here; meant to keep
      the user unblocked, not as a default operating mode)
  ↓ (final attempt; rethrows on failure)
ERROR
```

Logic: `packages/orchestrator/src/lib/llm-client.ts::buildFailoverChain()`

---

## Cost Levers (in order of impact)

### Production
1. **Anthropic is primary**: set `DIRECTOR_MODEL=anthropic/claude-sonnet-4-6`, ensure `ANTHROPIC_API_KEY` is set on Render. Already done.
2. **OpenRouter as relief valve**: set `OPENROUTER_API_KEY` and the failover chain routes Anthropic 429/529 to the SAME Claude model via OpenRouter (preserves quality + cost) before falling back to raw OpenAI. Wired 2026-06-09 (T3-3).
3. **Cap script size**: `MAX_SCRIPT_PAGES=150`, `MAX_SCRIPT_CHARS=75000` — already enforced pre-flight.

### Testing / staging
1. **Don't request deep dives**: leave `include_dialogue_deep_dive` and `include_structural_analysis` off (they add 2 extra full-script LLM calls each).
2. **Cap iteration budgets via env**: not currently exposed; consider adding `MAX_AGENT_ITERATIONS` if testing burns excessive iterations.
3. **Set `LOG_LEVEL=debug` only locally**: per-iteration logs are debug-level (post-2026-06-08); INFO is summary-only.
4. **Use page-limited scripts for smoke tests**: a 5-page sample exercises every pipeline stage and is ~1/30th the cost of a full 90-page feature script.

### Future cost cuts (not done yet)
- **Migrate Adviser to Claude**: web `lib/adviser/service.ts` is still raw `gpt-4o`. Probably saves $0.05–0.20 per request once moved.
- **Whisper via Groq**: Groq offers Whisper at a fraction of OpenAI's cost. Add a `groq/whisper-large-v3` path before the duration-estimator fallback.
- **Haiku for tool calls**: voice-search is tool-heavy but each individual decision is shallow. A test branch with `DIRECTOR_MODEL=anthropic/claude-haiku-4-5` is worth measuring — Haiku is 1/12 the cost of Sonnet.

---

## Adding a New LLM Call (checklist)

1. **Route through `llm-client.ts`** (orchestrator) or `providers.ts` (web). Do **not** import `@ai-sdk/openai` directly.
2. **Default the model from env**, not a string literal. Pattern: `process.env.X_MODEL || process.env.DIRECTOR_MODEL || 'anthropic/...'`.
3. **No `.min()`/`.max()`/`.minItems()` on Zod schemas passed to `generateObject` / `generateStructuredOutput`** — Anthropic rejects them. Use `.describe()` and validate server-side after the call. (See examples in `script-score-service.ts`.)
4. **Add a row to this matrix** in the same PR.
5. **Update env optional list in `lib/env-validation.ts`** if you introduce a new API key.

---

## History

| Date | Change |
|------|--------|
| 2026-06-08 | Initial matrix written. Migrated `script-score-service` off gpt-4o (4-6 OpenAI calls/analysis eliminated). Gated OpenAI Whisper fallback behind `ENABLE_OPENAI_WHISPER_FALLBACK`. Made `OPENAI_API_KEY` optional in env validation. |
| 2026-06-09 | Audio director → Haiku 4.5 (was `openai/gpt-4.1`). PR A of cost-opt Phase 2 (issue #182). |
| 2026-06-09 | Anthropic prompt caching on all `runAgentLoop` + `generateStructuredOutput` calls. System prompt now sent as a cached system message (cache_control: ephemeral, 5-min TTL). Disable via `ENABLE_PROMPT_CACHE=false`. PR B of cost-opt Phase 2 (issue #182). Estimated 40-70% input-token reduction on repeat calls within a `/analyze`. |
| 2026-06-09 | Batched script-score: when `BATCHED_SCORING_ENABLED=true`, the four core dimensions come from ONE LLM call instead of four parallel ones. Default off — A/B against corpus before flipping production. PR C of cost-opt Phase 2 (issue #182). ~3x reduction on the dominant per-call token cost (script text). |
| 2026-06-09 | Embedding query cache: L1 in-process Map + L2 Upstash Redis (7-day TTL) for audio-search queries. Cross-worker + survives restart. Cache key namespaced by model + dimension to prevent cross-model bleed. Disable via `EMBEDDING_CACHE_DISABLED=true`. PR D of cost-opt Phase 2 Tier 2 (issue #186). |
| 2026-06-09 | Tiered director-model selection: `/orchestrate` now routes scripts ≤ `TIER1_PAGE_THRESHOLD` pages (default 5) to `TIER1_MODEL` (Haiku 4.5 by default). Larger scripts use `DIRECTOR_MODEL` (Sonnet). Paid Advanced Analysis bypasses tiers (Opus). Disable with `TIER1_PAGE_THRESHOLD=0`. PR E of cost-opt Phase 2 Tier 2 (issue #186). Eliminates Sonnet rates on Peter's iteration loop of small test scripts. |
| 2026-06-09 | Groq Whisper as middle alignment fallback. `whisper-align.ts` now tries: whisper.cpp → Groq Whisper (default on if `GROQ_API_KEY` set) → OpenAI Whisper (still opt-in via `ENABLE_OPENAI_WHISPER_FALLBACK=true`) → duration estimator. Groq Whisper is ~12× cheaper than OpenAI Whisper for the same `whisper-large-v3` model. Disable Groq path with `ENABLE_GROQ_WHISPER_FALLBACK=false`. PR F of cost-opt Phase 2 Tier 2 (issue #186). |
| 2026-06-09 | OpenRouter relief valve properly wired. `buildFailoverChain` for `anthropic/<model>` primaries now returns `openrouter/anthropic/<same model>` as the first fallback — keeping us on the same Claude model when direct Anthropic 429/529s. Previously this slot was `openrouter/openai/gpt-4.1` (just GPT-4.1 in disguise), which defeated the "relief valve" intent. OpenAI gpt-4.1 stays as the last-resort fallback. T3-3 of cost-opt Phase 2. |
| 2026-06-09 | TEST_MODE=mock provider. When set, `runAgentLoop` + `generateStructuredOutput` return canned/stubbed responses instead of hitting real providers. Zero token spend on Peter's iteration loop. Hard-stops in `NODE_ENV=production` via `assertNotInProduction`. Fixtures load from `packages/orchestrator/test-fixtures/canned-responses/{agent,structured}/<hash>.json`. T3-1 of cost-opt Phase 2. |
| 2026-06-09 | Web Adviser migrated off raw `gpt-4o` to Claude Sonnet via `lib/ai/providers.ts` (`generateSuggestions` + `generateRewrites`). Unused `lib/ai/llm-call.ts` utility deleted. Eliminates the last raw-OpenAI bypass in the web package. Adviser callers can still override `options.model` for experiments. T3-2 of cost-opt Phase 2. |
| 2026-06-09 | LLM call log table for per-call cost attribution. New `llm_call_log` table (Prisma migration 0037). Every `runAgentLoop` + `generateStructuredOutput` call writes one row with operation label, model, provider, token counts, duration, success, and USD cost estimate (lookup table in `lib/llm-call-log.ts`). Best-effort writes — DB failure is logged, never propagated. Disable via `LLM_CALL_LOG_DISABLED=true`. T3-4 of cost-opt Phase 2. |
| 2026-06-09 | Scene-level idempotency cache. `orchestrate()` now hashes each scene's render-defining inputs (dialogue + voice keys + emotion + audio cues + mix params) and short-circuits the alignment + cue + timeline + mix block when the hash matches a previously cached render. New `scene_renders` table (Prisma migration 0036). Disable via `SCENE_CACHE_DISABLED=true`. Sequential pipeline only this PR; parallel pipeline integration in a follow-up. T2-2 of cost-opt Phase 2 (issue #190). |
