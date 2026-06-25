/**
 * Job-status helpers shared between server (`/api/jobs/[id]`) and client
 * (GenerateButton's polling loop).
 *
 * Phase E-adjacent — addresses Peter's 2026-06-24 report:
 *
 *   "the job continues but UI isn't seeing updates on the Retry, and after
 *    the job finishes on the backend a reload in the UI still shows it as
 *    failed."
 *
 * The lifecycle:
 *
 *   1. Chunk fails inside processor.ts → throw
 *   2. processor.ts catches, writes status='failed' + progress.step='failed'
 *      (so logs / Sentry have a snapshot of the failure)
 *   3. Worker catches the rethrow, calls fail_job() SQL proc
 *   4. fail_job() either:
 *        - retries remain → status='queued', retryCount++
 *        - exhausted → status='failed' permanently
 *   5. Worker re-dequeues, processes the retry, eventually 'completed' or 'failed'
 *
 * Between step 2 and step 4 there's a brief window where the row has
 * status='failed' but a worker retry is imminent. Before this helper, the
 * client polling loop saw 'failed', stopped polling, and missed the retry's
 * eventual completion. The fix: keep polling whenever `isRetryImminent`
 * is true.
 */

export interface RetryStateInput {
  status: 'queued' | 'processing' | 'completed' | 'failed' | string;
  retry_count?: number | null;
  max_retries?: number | null;
}

/**
 * True when the job row currently reports 'failed' but the worker is about
 * to retry. Callers should KEEP POLLING when this returns true rather than
 * treating the state as terminal.
 */
export function isRetryImminent(input: RetryStateInput): boolean {
  if (input.status !== 'failed') return false;
  if (typeof input.retry_count !== 'number' || typeof input.max_retries !== 'number') {
    return false;
  }
  return input.retry_count < input.max_retries;
}

/**
 * True when the job has reached a terminal failure (no more retries).
 * Exposed as a positive form for readability at the call site.
 */
export function isTerminalFailure(input: RetryStateInput): boolean {
  if (input.status !== 'failed') return false;
  if (typeof input.retry_count !== 'number' || typeof input.max_retries !== 'number') {
    // No retry telemetry → fall back to treating 'failed' as terminal so we
    // don't poll forever on legacy job rows.
    return true;
  }
  return input.retry_count >= input.max_retries;
}
