/**
 * withQueryTimeout — bound a Prisma (or any) promise to a wall-clock
 * deadline so a hot-path endpoint can fail fast instead of holding the
 * HTTP connection open until the client gives up.
 *
 * Why we have this: STORY-MAGIC-1G recorded a /api/jobs/[id] handler
 * that took 296,681 ms to return 200. The body of the handler is a
 * single prisma.job.findUnique against a UUID-keyed table — there's no
 * business reason for it to take 5 minutes. Root cause: the embedded
 * queue worker holds connections during generation processing, the web
 * service's pool empties out, and poll requests stack up waiting for a
 * free connection. Bumping the DB plan / moving the worker out of
 * process is the real fix — but until that lands, callers should see a
 * fast 503 + Retry-After rather than a 5-minute spinner.
 *
 * Behavior:
 *   - Resolves with the promise's value if it settles before the timeout.
 *   - Rejects with QueryTimeoutError if the timeout fires first.
 *   - Does NOT cancel the underlying query — Prisma doesn't expose
 *     cancellation. The query keeps running on the DB until it returns
 *     and the connection is released. This is acceptable because the
 *     point is responsiveness, not load relief.
 *
 * Usage in a Next.js route handler:
 *
 *   try {
 *     const job = await withQueryTimeout(
 *       prisma.job.findUnique({ where: { id } }),
 *       JOB_POLL_TIMEOUT_MS,
 *     );
 *     ...
 *   } catch (e) {
 *     if (e instanceof QueryTimeoutError) {
 *       return new NextResponse(JSON.stringify({ error: 'busy' }), {
 *         status: 503,
 *         headers: { 'Retry-After': '5' },
 *       });
 *     }
 *     throw e;
 *   }
 */

export class QueryTimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    public readonly label?: string,
  ) {
    super(`Query timed out after ${timeoutMs}ms${label ? ` (${label})` : ''}`);
    this.name = 'QueryTimeoutError';
  }
}

/**
 * Resolve-with-sentinel pattern (not reject-after-timeout) so we don't
 * leak an unhandled rejection if the underlying promise wins the race.
 */
export async function withQueryTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label?: string,
): Promise<T> {
  const TIMED_OUT: unique symbol = Symbol('query-timed-out');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
    // .unref() on Node so the timer doesn't keep the event loop alive
    // past a graceful shutdown. Best-effort — undefined on edge runtimes.
    (timer as unknown as { unref?: () => void }).unref?.();
  });

  // Swallow late rejection from the racing promise to avoid
  // PromiseRejectionHandledWarning when we've already returned via timeout.
  promise.catch(() => {});

  try {
    const winner = await Promise.race([promise, timeoutPromise]);
    if (winner === TIMED_OUT) {
      throw new QueryTimeoutError(timeoutMs, label);
    }
    return winner as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
