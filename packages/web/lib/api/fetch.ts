/**
 * Shared fetch wrappers for client-side API calls.
 *
 * - `apiFetch`: thin wrapper that adds the X-Requested-With header required
 *   by CSRF validation when Origin/Referer headers are missing or stripped.
 *
 * - `apiFetchWithRetry`: opt-in retry layer for transient infrastructure
 *   failures. Used by long-running or user-facing POST surfaces that get
 *   caught in the Render rolling-restart cutover window (~1–2 min of 524s
 *   per redeploy on starter plans). See issue #368 for the dev incident
 *   on 2026-06-22 that motivated this — Ryan's uploads 524'd twice in
 *   the same 17-minute window while three back-to-back redeploys cycled.
 */

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'story-magic');
  }
  return fetch(input, { ...init, headers });
}

/**
 * Statuses that almost always mean "origin restart / cutover / overloaded"
 * — never the application's response. Safe to retry because the request
 * either didn't reach app code (524, 502, 503) or timed out at the proxy
 * layer (504). We deliberately exclude 500 (application error) and 5xx
 * codes that may have side-effects.
 */
const TRANSIENT_STATUSES = new Set([502, 503, 504, 524]);

const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 1000;

export interface ApiFetchRetryOptions {
  /** Total retries after the first attempt (default: 2 → 3 attempts max). */
  retries?: number;
  /** Initial backoff delay; doubles each retry (default: 1000ms → 1s, 2s, 4s). */
  baseDelayMs?: number;
  /** Optional AbortSignal — aborts mid-backoff as well as mid-request. */
  signal?: AbortSignal;
  /** Injectable for tests so we don't actually wait in unit tests. */
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Fetch wrapper that transparently retries on transient infrastructure
 * failures (524 / 502 / 503 / 504 and network errors). Returns the FINAL
 * response — callers handle non-transient 4xx/5xx normally.
 *
 * Safe to use with non-idempotent POSTs ONLY when the retried statuses are
 * cutover-class (the request never reached app code). For 524 from
 * Cloudflare specifically this is reliably true; for 502/503 it is usually
 * true on a Render/Vercel-style platform where the LB rejects before the
 * app instance accepts. We accept the small dup-write risk in exchange for
 * survival of the cutover window — uploads are far more likely to be
 * silently dropped today than to be processed twice.
 */
export async function apiFetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: ApiFetchRetryOptions,
): Promise<Response> {
  const retries = opts?.retries ?? DEFAULT_RETRIES;
  const baseDelay = opts?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const sleep = opts?.sleep ?? ((ms: number) => defaultSleep(ms, opts?.signal));

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (opts?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const res = await apiFetch(input, init);
      if (!TRANSIENT_STATUSES.has(res.status) || attempt === retries) {
        return res;
      }
      // Drain the body so the underlying connection can be reused.
      try {
        await res.text();
      } catch {
        // ignore — best-effort drain
      }
    } catch (e) {
      lastError = e;
      // Don't swallow user-initiated aborts as a network error.
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      if (attempt === retries) throw e;
    }
    await sleep(baseDelay * 2 ** attempt);
  }
  // Unreachable: the loop either returns or throws on the last attempt.
  /* istanbul ignore next */
  throw lastError ?? new Error('apiFetchWithRetry: exhausted retries');
}
