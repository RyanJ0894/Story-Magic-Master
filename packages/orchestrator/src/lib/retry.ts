/**
 * Exponential backoff retry wrapper with jitter
 * Prevents rate limit failures and duplicate charges
 */

import { log } from './logger.js';

/**
 * Thrown when an OpenAI embedding call fails due to quota exhaustion.
 * Unlike transient rate limits, this won't resolve with retries — the key's
 * billing limit is reached. Propagates through tool catch blocks so the agent
 * loop aborts instead of calling the tool 20 more times.
 */
export class EmbeddingQuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingQuotaExhaustedError';
  }
}

/**
 * Returns true when an error indicates an OpenAI quota exhaustion (not a
 * transient rate limit). Used to distinguish "retry later" from "stop now".
 */
export function isQuotaExhaustedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('exceeded your current quota') ||
    msg.includes('insufficient_quota') ||
    msg.includes('quota has been exceeded')
  );
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
  retryableStatuses?: number[];
}

/**
 * Custom error class for retryable errors
 */
export class RetryableError extends Error {
  status: number;
  isRetryable: boolean;
  /**
   * #378: when set, the retry layer uses this as the wait-before-next
   * attempt instead of computing an exponential delay. Captured from
   * the `Retry-After` response header (see audio.ts) so we honor the
   * provider's own guidance — pure exponential ignores ElevenLabs
   * telling us "wait 30s" when their infra is degraded.
   */
  retryAfterMs?: number;

  constructor(message: string, status: number, isRetryable = true, retryAfterMs?: number) {
    super(message);
    this.name = 'RetryableError';
    this.status = status;
    this.isRetryable = isRetryable;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    jitterFactor = 0.2,
    retryableStatuses = [429, 500, 502, 503, 504],
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Check if error is retryable
      const errorWithStatus = err as { status?: number; response?: { status?: number } };
      const status = errorWithStatus.status || errorWithStatus.response?.status;
      const isRetryable =
        (status && retryableStatuses.includes(status)) ||
        (err instanceof RetryableError && err.isRetryable);

      if (!isRetryable) {
        throw err;
      }

      // #378: honor `Retry-After` from the server when we have it. The
      // exponential calc is a guess; if ElevenLabs (or anyone else)
      // tells us how long to wait, we should listen — pure exponential
      // either undershoots (next attempt also 429s) or overshoots
      // (wastes seconds the server has already recovered from). Cap at
      // maxDelayMs so a misbehaving server can't pin us indefinitely.
      const serverRetryAfterMs =
        err instanceof RetryableError && typeof err.retryAfterMs === 'number'
          ? Math.min(err.retryAfterMs, maxDelayMs)
          : null;

      let delay: number;
      let strategy: 'retry-after' | 'exponential';
      if (serverRetryAfterMs !== null) {
        // Even when honoring Retry-After, add light jitter so concurrent
        // workers receiving the same Retry-After value don't synchronize
        // on the millisecond — small enough to keep the server's intent.
        const lightJitter = serverRetryAfterMs * 0.1 * Math.random();
        delay = serverRetryAfterMs + lightJitter;
        strategy = 'retry-after';
      } else {
        // Exponential growth + jitter. For 429 specifically we widen
        // the jitter window (±50% vs ±20% default) to spread out
        // concurrent retry waves — the grant-tier concurrency cap means
        // tightly-clustered retries thundering-herd the next attempt.
        const baseDelay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
        const effectiveJitter = status === 429 ? Math.max(jitterFactor, 0.5) : jitterFactor;
        const jitter = baseDelay * effectiveJitter * (Math.random() * 2 - 1);
        delay = Math.max(0, baseDelay + jitter);
        strategy = 'exponential';
      }

      log.warn('Retry attempt failed', {
        attempt: attempt + 1,
        maxRetries,
        status,
        delayMs: Math.round(delay),
        strategy,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
