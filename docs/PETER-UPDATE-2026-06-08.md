# Peter — Cost / Schema / Testing Cleanup Update

**Date:** 2026-06-08
**From:** Chris
**Re:** Burning quota too fast, Claude schema rejection errors, log volume
**Status:** Three PRs ready for your review, one (#177) already up

---

## TL;DR

You flagged three blocking issues in your testing:

1. **Both OpenAI and Anthropic getting billed per analysis** even though the failover chain should pick one
2. **Claude rejecting our schemas** (min/max on integers, "too many optional parameters")
3. **Shocking log volume on a 5-page script** — can't tell if it's retries or normal progress

All three are fixed. Plus we found a fourth (silent OpenAI Whisper billing on alignment fallback) and a fifth (voice-assignment running on Sonnet when it should be on cheaper Haiku).

**PRs awaiting your review, in suggested merge order:**

| # | Branch | Scope | Risk |
|---|--------|-------|------|
| **178** | `fix/cost-optimization-claude-schemas` | The big one — cost leaks + schema fixes + log cleanup + model matrix doc | Med — touches 12 files but tests pin behavior |
| **179** | `feat/voice-assignment-on-haiku` | Voice-assignment default → Haiku 4.5 (~12x cheaper) | Low — env-overridable, isolated to one agent |
| **177** | `fix/sub-account-project-isolation` | Security: sub-accounts can only see assigned projects (separate concern, batched here) | Med — adds migration + access path |

Plus a 4th already mostly described in #178: the OpenAI Whisper API fallback was unconditional — now opt-in.

---

## PR #178 — `fix/cost-optimization-claude-schemas` (review first)

https://github.com/dbbuilder-org/story-magic/pull/178

### The dual-billing root cause

`packages/orchestrator/src/analysis/script-score-service.ts` was hardcoded:

```ts
import { openai } from '@ai-sdk/openai';
const MODEL = 'gpt-4o'; // Best for structured analysis
// ...
generateObject({ model: openai(MODEL), ... })
```

That ran **4 parallel calls + 1 synthesis** (+ optional 2 deep-dive calls) per `/analyze` request — directly against OpenAI, completely bypassing the Claude → OpenRouter → OpenAI failover chain in `llm-client.ts`.

Net effect: every script analysis was double-billed (one Claude director run + 5–7 OpenAI gpt-4o analysis calls in parallel). When Anthropic ran out, you saw OpenAI errors because that's what was actually being used.

### Fix

- Routes script-score-service through `generateStructuredOutput` from llm-client (which has the failover chain).
- New `SCRIPT_SCORE_MODEL` env var, defaulting to `DIRECTOR_MODEL` → `anthropic/claude-sonnet-4-6`.
- Removed the bespoke retry loop in `analyzeWithRetry` — llm-client's failover replaces it.

### Schema rejection root causes

Two distinct issues you saw:

**1. "Claude not liking max and min settings on integer values"**

Anthropic's structured-output API rejects `minimum`, `maximum`, `minLength`, `maxLength`, `minItems` in JSON Schema. Our Zod schemas were generating those:

```ts
// Reject:
intensity: z.number().min(0).max(1).optional()     // → minimum/maximum
text: z.string().min(1)                            // → minLength
characters: z.array(...).min(1)                    // → minItems
score: z.number().min(1).max(10)                   // → minimum/maximum

// Accept:
intensity: z.number().describe('0.0-1.0 intensity').optional()
text: z.string().describe('Non-empty line of dialogue')
characters: z.array(...).describe('At least one speaking character')
score: z.number().describe('1-10 score')
```

Range/length intent is preserved via `.describe()` (the LLM reads it) and via the prompt. Invariants that **must** hold (non-empty dialogue text, ≥1 character) are now enforced server-side after the LLM call.

**2. "Tool schemas have too many optional parameters"**

The `search_voices` tool had 5 optional params: `gender, label, style, tone, top_k`. Anthropic's tool input schema gets confused by lots of optional fields — the model spends iterations debating which to use.

Fixed by dropping `tone` (voice-quality hints already live in the `query` field — they're matched against voice names and descriptions there). Down to 3 optional + 1 with-default. Cleaner schema, same expressiveness.

### Logs

`runAgentLoop` was logging at **INFO** every iteration + every tool call + every tool result. For a voice-assignment pass with 20 characters and 5 tool calls each, that's **~300 INFO log lines** from one stage alone.

Demoted three to DEBUG:
- `[LLM] iteration` (every loop step)
- `[LLM] executing tool` (every individual tool call)
- `[LLM] tool result` (every tool result)

Kept the per-iteration **summary** at INFO:
- `[LLM] tool calls` (one line per iteration with `count` and `tools: [...]`)
- `[LLM] completed` (final outcome)

Expected ~70% reduction in production log volume per analysis.

### Whisper fallback (bonus fix you mentioned)

`whisper-align.ts` had this:
```ts
} catch (err) {
  log.warn('whisper.cpp failed, trying OpenAI Whisper API');
  if (process.env.OPENAI_API_KEY) {
    return await whisperAPIAlign(audioPath, expectedText);  // ← billed
  }
}
```

Now gated:
```ts
const fallbackEnabled = process.env.ENABLE_OPENAI_WHISPER_FALLBACK === 'true';
if (fallbackEnabled && process.env.OPENAI_API_KEY) {
  return await whisperAPIAlign(audioPath, expectedText);
}
// Otherwise falls through to the free duration-based estimator (was always available).
```

### Model matrix doc

`docs/MODEL_MATRIX.md` — new authoritative table of what model each operation uses, how to override via env, and cost rationale. PRs adding LLM calls are expected to update it. This is meant to prevent the next silent cost leak by making "what does this hit?" a 30-second lookup.

### Test impact

- 655/655 orchestrator ✅
- 1273/1273 web ✅
- Rewrote `script-score-service.test.ts` mocks: previously mocked `ai` SDK + `@ai-sdk/openai`; now mocks llm-client's `generateStructuredOutput` + `runAgentLoop`. Retry tests reframed as a delegation contract — failover/retry logic is the llm-client's job and is covered separately in `llm-failover.test.ts`.
- Two new HTTP-input guard tests via `assertHttpDirectorJSONInvariants()` in pipeline.ts — preserves the "reject empty dialogue text" guarantee that used to come from `.min(1)`.

---

## PR #179 — `feat/voice-assignment-on-haiku` (review second)

https://github.com/dbbuilder-org/story-magic/pull/179

Direct follow-up from #178's model matrix. Voice assignment is **tool-heavy but shallow-decision** — each character does ~4-5 tool calls and each individual decision is "pick the best fit from these 3 candidate voices." Sonnet's deeper reasoning isn't load-bearing.

- New `VOICE_ASSIGNMENT_MODEL` env var, default `anthropic/claude-haiku-4-5`.
- Voice-assignment agent reads it directly (does NOT fall through to `DIRECTOR_MODEL` — the decoupling is the point).
- Two new tests pin the Haiku default and the constructor override.

**Quality safety net:** if casting regresses on a script during your testing, set `VOICE_ASSIGNMENT_MODEL=anthropic/claude-sonnet-4-6` in Doppler — no redeploy. Roll forward by removing the override.

**Expected savings:** 20-character cast at ~5 iterations each → ~100 LLM calls per voice-assignment pass. Haiku is roughly 1/12 the Sonnet token cost, so this is the biggest single per-analysis save after the script-score fix.

657/657 tests pass.

---

## PR #177 — `fix/sub-account-project-isolation` (separate concern, security)

https://github.com/dbbuilder-org/story-magic/pull/177

Unrelated to the cost cleanup but already open and ready. Ryan's Q3=B clarification from the master/sub-account scoping convo: sub-accounts should only see projects they're personally assigned, not the entire team's shared project set.

- New `project_assignments` table (migration 0035) — explicit per-user project access.
- Migration **seeds** existing `team_shares × team_members` so no current sub-account loses access.
- `withProjectAuth` splits team access into two paths:
  1. **Team owner** (master): broad access via `Team.ownerId`
  2. **Team member** (sub-account): requires a ProjectAssignment row

1276/1276 web tests pass. Detailed PR description has the SQL and the auth-path diff.

**Migration note:** main currently has migration `0035_timestamps_to_timestamptz` (just merged via #172). PR #177 was branched before that landed and uses `0035_project_assignment`. Needs a renumber to `0036_project_assignment` before merge. Easy 30-second rebase — not a real conflict.

---

## What's next — three thoughts

### 1. Migrate the web `adviser` and `llm-call` to Claude (next PR, small)

`packages/web/lib/adviser/service.ts` and `packages/web/lib/ai/llm-call.ts` still call OpenAI directly via the raw SDK:

```ts
import { getOpenAI } from '@/lib/ai/openai';
const response = await getOpenAI().chat.completions.create({ model: 'gpt-4o', ... });
```

The web side has `providers.ts` with Claude support but adviser hasn't been migrated. Should be a small PR. Open question for you: does Story-Adviser quality survive the swap to Claude? My read is yes — it's a structured-output task — but worth a manual A/B before flipping the default. I can stage it behind an env flag if you want to test side-by-side.

### 2. OpenRouter as the relief valve

Right now the failover chain is `Anthropic → OpenAI`. Adding OpenRouter in the middle gives us:

```
Anthropic   (primary, our preferred model)
   ↓
OpenRouter  (different billing account, still routes to Claude or any model we want)
   ↓
OpenAI      (last resort)
```

The `llm-client.ts` already supports this — it's just an unused branch if `OPENROUTER_API_KEY` isn't set. We have the key (in my credentials file). The reason to add it: when Anthropic specifically is out of quota or overloaded (529), we want to keep trying Claude via a different billing path before falling back to gpt-4.1 which is a different model with different quality characteristics.

Estimated effort: just set the env var on Render. No code change. Want me to do it as part of the merge of #178?

### 3. Cheap test path for your work

The current `/analyze` endpoint runs 4-6 LLM calls per request. Even with everything on Claude, your testing burns through quota fast because you're hitting full pipelines. Two options worth considering:

**Option A — Test profile env**

```
TEST_MODE=true → forces all models to the cheapest tier:
  DIRECTOR_MODEL=anthropic/claude-haiku-4-5
  SCRIPT_SCORE_MODEL=anthropic/claude-haiku-4-5
  AUDIO_DIRECTOR_MODEL=anthropic/claude-haiku-4-5
```

Pros: trivial to add, lets you test the full pipeline at ~1/12 cost.
Cons: doesn't catch Sonnet-specific schema issues until you flip back.

**Option B — Mock provider for E2E**

A `mock://` provider URL that returns canned responses. Your Playwright runs hit it. Real pipeline code paths exercised, zero LLM cost.

Pros: zero per-test cost, deterministic.
Cons: doesn't catch real-LLM regressions — you'd still want a smaller "smoke" matrix that hits real Claude.

My recommendation: **both**. Mock for the bulk of CI/Playwright, `TEST_MODE` for manual end-to-end smoke testing against real services. Let me know if either is worth a follow-up PR.

---

## What I'd ask of you for the review

For **#178**, the most load-bearing review questions:

1. Are the post-LLM invariant guards (`assertHttpDirectorJSONInvariants`, characters-length check) in the right spots, or do you want them somewhere else in the call graph?
2. Is the `.describe()` substitute for `.min().max()` going to give Claude enough signal? My read is yes (it ends up in the JSON Schema `description` field, which Claude reads), but you might have a stronger opinion.
3. Should `quickScore` and the dialogue/structural deep-dive paths use a cheaper model than the main analyses? They're currently all on `SCRIPT_SCORE_MODEL` → `DIRECTOR_MODEL`. Could be Haiku for quick triage; arguably Sonnet for deep dives. Want me to split them?

For **#179**: spot-check a real screenplay (any small one) to see if Haiku's casting quality holds. If it doesn't, the env override is one-line rollback in Doppler.

For **#177**: standard security review. The seed in the migration is the riskiest part — it backfills existing access so no one loses visibility, but if you spot a tenant boundary I missed, that's the one I most want to know about.

---

## Files touched (for orientation)

**#178** — 12 files in packages/orchestrator + 1 in packages/web + new docs/MODEL_MATRIX.md
**#179** — 3 files in packages/orchestrator (env.ts, voice-assignment-agent.ts + test)
**#177** — schema.prisma + 0035 migration + middleware.ts + middleware.test.ts

Total test impact: ~+15 new tests; 657 + 1276 = 1933 still green.

Thanks for the careful logs you sent — pinpointing "openai used not just as fallback" saved me hours of grep. Ping me with any pushback and I'll iterate.

— Chris
