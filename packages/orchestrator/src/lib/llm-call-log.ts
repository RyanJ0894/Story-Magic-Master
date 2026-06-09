/**
 * Per-call LLM cost-attribution log (T3-4 of cost-opt Phase 2).
 *
 * Every `runAgentLoop` and `generateStructuredOutput` call writes one row to
 * `llm_call_log`. Lets us answer "what did this script cost?" with SQL
 * instead of grep + guess.
 *
 * Writes are fire-and-forget — a DB hiccup must NOT take down a request that
 * already succeeded at the provider level. The current call still returns
 * normally; only the logging is lost.
 *
 * Disable via `LLM_CALL_LOG_DISABLED=true` (e.g. while running load tests
 * where the log writes themselves are the noise you're trying to remove).
 */

import { prisma } from './prisma.js';
import { log } from './logger.js';

/**
 * USD per million tokens. Update yearly. Missing models default to 0 —
 * which is a deliberate undercount, not an inflated overcount: better to
 * surface a model we don't have pricing for as a 0 cost row (visible in
 * dashboards as a known-unknown) than to invent a number.
 *
 * Sources (2026-06):
 *   - Anthropic: https://www.anthropic.com/pricing
 *   - OpenAI: https://platform.openai.com/docs/pricing
 *   - OpenRouter: takes a thin markup over upstream — we approximate with the
 *     upstream rate. Real OpenRouter cost is whatever is on the invoice.
 *   - Groq: https://groq.com/pricing
 */
const PRICING_USD_PER_MT: Record<string, { in: number; out: number }> = {
  // Anthropic direct
  'anthropic/claude-sonnet-4-6': { in: 3.0, out: 15.0 },
  'anthropic/claude-haiku-4-5':  { in: 0.8, out: 4.0 },
  'anthropic/claude-opus-4-6':   { in: 15.0, out: 75.0 },

  // OpenAI direct
  'openai/gpt-4.1': { in: 10.0, out: 30.0 },
  'openai/gpt-4o':  { in: 5.0,  out: 15.0 },

  // OpenRouter (Claude via OpenRouter — approximate as upstream Anthropic)
  'openrouter/anthropic/claude-sonnet-4-6': { in: 3.0, out: 15.0 },
  'openrouter/anthropic/claude-haiku-4-5':  { in: 0.8, out: 4.0 },
  'openrouter/anthropic/claude-opus-4-6':   { in: 15.0, out: 75.0 },
  'openrouter/openai/gpt-4.1':              { in: 10.0, out: 30.0 },

  // Groq (cheap)
  'groq/llama-3.3-70b-versatile': { in: 0.59, out: 0.79 },
};

/**
 * Compute the estimated USD cost for a single LLM call. Returns 0 when
 * either token count is missing OR the model is unpriced — see PRICING_USD_PER_MT
 * for the rationale on the 0-default policy.
 */
export function estimateCostUsd(
  model: string,
  inputTokens?: number | null,
  outputTokens?: number | null,
): number {
  const price = PRICING_USD_PER_MT[model];
  if (!price) return 0;
  const inCost = ((inputTokens ?? 0) * price.in) / 1_000_000;
  const outCost = ((outputTokens ?? 0) * price.out) / 1_000_000;
  return inCost + outCost;
}

/**
 * Provider name from a model string. Mirror of `parseModelString` in
 * `llm-client.ts` but kept inline here to avoid a circular import — this
 * module is consumed BY llm-client.ts.
 */
function providerFromModel(model: string): string {
  const slash = model.indexOf('/');
  if (slash === -1) return 'openai';
  return model.slice(0, slash).toLowerCase();
}

export interface LlmCallLogParams {
  /** Project the call belongs to. Null for project-less calls (health checks etc.). */
  projectId?: string | null;
  /** Stable label — `director-character-extraction`, `script-score-writing`, etc. */
  operation: string;
  /** Full model string including provider prefix (e.g. `anthropic/claude-sonnet-4-6`). */
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationMs: number;
  succeeded: boolean;
  errorMessage?: string | null;
}

function isLogDisabled(): boolean {
  return process.env.LLM_CALL_LOG_DISABLED === 'true';
}

/**
 * Persist a single LLM call's cost + timing. Best-effort: a DB failure is
 * logged at WARN but never propagates.
 */
export async function recordLlmCall(params: LlmCallLogParams): Promise<void> {
  if (isLogDisabled()) return;

  try {
    const cost = estimateCostUsd(params.model, params.inputTokens, params.outputTokens);
    await prisma.llmCallLog.create({
      data: {
        projectId: params.projectId ?? null,
        operation: params.operation,
        model: params.model,
        provider: providerFromModel(params.model),
        inputTokens: params.inputTokens ?? null,
        outputTokens: params.outputTokens ?? null,
        // Decimal — Prisma will coerce a JS number; if cost is exactly 0 we
        // still write it so downstream queries get a row even for free calls.
        costEstimateUsd: cost,
        durationMs: params.durationMs,
        succeeded: params.succeeded,
        errorMessage: params.errorMessage ?? null,
      },
    });
  } catch (err) {
    log.warn('[llm-call-log] write failed; not fatal', {
      err: err instanceof Error ? err.message : String(err),
      operation: params.operation,
      model: params.model,
    });
  }
}
