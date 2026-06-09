/**
 * Wall-clock budget wrapper (T3-5 of cost-opt Phase 2).
 *
 * Background: Peter reported "shocking log volume on a 5-page script" during
 * testing — a symptom of retry storms inside the LLM client chasing a
 * transient provider issue. The downstream cost (tokens spent, dollars
 * billed) keeps climbing as long as the request keeps running.
 *
 * This wrapper caps the total time a top-level operation can spend. On
 * timeout the underlying promise is left to settle in the background (we
 * don't have AbortController plumbing on every code path yet) but the
 * caller sees a `BudgetExceededError` and can return a 503 to the user.
 *
 * The dangling background work is not free — it can still rack up token
 * costs until it completes or errors. The benefit is twofold:
 *   1. The user is told the request failed quickly (no 90-second silent wait).
 *   2. The next request can't pile on while the runaway is still in flight.
 *
 * Future hardening (out of scope here): thread AbortSignal through the AI
 * SDK calls so cancellation actually stops token spending mid-flight.
 */

export class BudgetExceededError extends Error {
  constructor(
    public readonly label: string,
    public readonly budgetMs: number,
  ) {
    super(`${label} exceeded ${budgetMs}ms wall-clock budget`);
    this.name = 'BudgetExceededError';
  }
}

/**
 * Race `promise` against `budgetMs`. Resolves with the promise's value if it
 * wins; rejects with `BudgetExceededError` if the timer wins.
 *
 * `label` shows up in the error message and logs so operators can identify
 * which operation tripped the budget.
 */
export function withWallClockBudget<T>(
  promise: Promise<T>,
  budgetMs: number,
  label: string,
): Promise<T> {
  // budget <= 0 disables the wrapper — useful for tests that want to
  // exercise the underlying promise without timer interference.
  if (budgetMs <= 0) return promise;

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new BudgetExceededError(label, budgetMs));
    }, budgetMs);
    // Don't block process exit on this timer (e.g. during graceful shutdown).
    if (typeof timer.unref === 'function') timer.unref();
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Read the budget for a named operation from process.env. Returns 0
 * (disabled) when unset, NaN, or non-positive. Callers should treat 0 as
 * "no budget — let it run".
 */
export function getWallClockBudgetMs(envVar: string, defaultMs: number): number {
  const raw = process.env[envVar];
  if (!raw) return defaultMs;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return defaultMs;
  return n;
}
