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
| **Story Adviser (web)** | `gpt-4o` (raw OpenAI SDK) | _(none yet — see TODO)_ | **Cost leak**. Should be migrated to `lib/ai/providers.ts` + Claude. Tracked but not fixed in this PR. |
| **Web `callLLMAndParse` utility** | `gpt-4o` (raw OpenAI SDK) | passed-in `model` param | Currently unused based on grep. Migrate when reanimated. |
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
openrouter/openai/gpt-4.1     [if OPENROUTER_API_KEY set]
  ↓ (on same conditions)
openai/gpt-4.1                [if OPENAI_API_KEY set]
  ↓ (final attempt; rethrows on failure)
ERROR
```

Logic: `packages/orchestrator/src/lib/llm-client.ts::buildFailoverChain()`

---

## Cost Levers (in order of impact)

### Production
1. **Anthropic is primary**: set `DIRECTOR_MODEL=anthropic/claude-sonnet-4-6`, ensure `ANTHROPIC_API_KEY` is set on Render. Already done.
2. **OpenRouter as relief valve**: add `OPENROUTER_API_KEY` to absorb Anthropic billing spikes without hitting raw OpenAI. Not yet wired.
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
