/**
 * Tiered director-model selection by script complexity.
 *
 * Background:
 *   Most of Peter's iteration loop is small scripts (1–5 pages) used to
 *   exercise the pipeline shape. Paying Sonnet rates for a 1-page script
 *   that the model could parse in seconds with Haiku is wasted budget.
 *
 *   This helper routes by estimated page count:
 *     - tier 1 (small):  ≤ TIER1_PAGE_THRESHOLD  → TIER1_MODEL (Haiku by default)
 *     - tier 2 (normal): > threshold              → DIRECTOR_MODEL  (Sonnet by default)
 *
 *   Paid "Advanced Analysis" overrides the tier and uses
 *   DIRECTOR_MODEL_ADVANCED (Opus) regardless of size — the user paid for the
 *   upgrade, so we honor it.
 *
 * Env knobs (all optional):
 *   TIER1_PAGE_THRESHOLD  (default 5)
 *   TIER1_MODEL           (default anthropic/claude-haiku-4-5)
 *   DIRECTOR_MODEL        (existing — default anthropic/claude-sonnet-4-6)
 *   DIRECTOR_MODEL_ADVANCED (existing — default anthropic/claude-opus-4-6)
 *
 * Disable tiering entirely with TIER1_PAGE_THRESHOLD=0 — every request then
 * uses DIRECTOR_MODEL.
 *
 * Tracking: Tier 2 of #186 (PR E).
 */

import { log } from './logger.js';

/**
 * Estimated page count from raw script text.
 *
 * Uses the same heuristic as `script-score-service` (~250 words/page) so the
 * two systems agree on how big a script is. Whitespace-only or empty input
 * returns 0 — caller treats that as "no script, pick default model".
 */
export function estimatePageCount(scriptText: string): number {
  const trimmed = scriptText?.trim() ?? '';
  if (trimmed.length === 0) return 0;
  const wordCount = trimmed.split(/\s+/).length;
  return Math.max(1, Math.round(wordCount / 250));
}

export interface SelectModelOptions {
  /** Raw script text. Pass an empty string when there's no script (model defaults to tier-2). */
  scriptText: string;
  /** True if the user has paid for Advanced Analysis. Forces Opus regardless of size. */
  useAdvanced: boolean;
}

export interface SelectModelResult {
  model: string;
  tier: 'advanced' | 'tier1' | 'tier2';
  estimatedPages: number;
}

/**
 * Pick the director model for a single request. Pure function — no I/O.
 * Reads env at call time so tests and operator toggles take effect without
 * an orchestrator restart.
 */
export function selectDirectorModel(opts: SelectModelOptions): SelectModelResult {
  const estimatedPages = estimatePageCount(opts.scriptText);

  if (opts.useAdvanced) {
    const model = process.env.DIRECTOR_MODEL_ADVANCED || 'anthropic/claude-opus-4-6';
    return { model, tier: 'advanced', estimatedPages };
  }

  const threshold = parseThreshold(process.env.TIER1_PAGE_THRESHOLD, 5);
  const tier2Model = process.env.DIRECTOR_MODEL || 'anthropic/claude-sonnet-4-6';

  // threshold = 0 disables tiering entirely.
  if (threshold <= 0) {
    return { model: tier2Model, tier: 'tier2', estimatedPages };
  }

  // Empty/whisper-thin script → tier 2 (we don't have evidence to be cheap).
  if (estimatedPages === 0 || estimatedPages > threshold) {
    return { model: tier2Model, tier: 'tier2', estimatedPages };
  }

  const tier1Model = process.env.TIER1_MODEL || 'anthropic/claude-haiku-4-5';
  log.info('selectDirectorModel: using tier-1 (cost-optimized) model', {
    estimatedPages,
    threshold,
    model: tier1Model,
  });
  return { model: tier1Model, tier: 'tier1', estimatedPages };
}

/**
 * Parse a positive-integer env value; falls back to `def` on missing, empty,
 * non-numeric, or negative input. NaN guards are required here because the
 * Zod env schema does not currently validate this knob (it's read directly
 * from process.env so operators can flip it without a redeploy).
 */
function parseThreshold(raw: string | undefined, def: number): number {
  if (!raw) return def;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return def;
  return n;
}
