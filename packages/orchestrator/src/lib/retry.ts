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

  constructor(message: string, status: number, isRetryable = true) {
    super(message);
    this.name = 'RetryableError';
    this.status = status;
    this.isRetryable = isRetryable;
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

      // Calculate backoff with exponential growth + jitter
      const baseDelay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = baseDelay * jitterFactor * (Math.random() * 2 - 1);
      const delay = Math.max(0, baseDelay + jitter);

      log.warn('Retry attempt failed', { attempt: attempt + 1, maxRetries, status, delayMs: Math.round(delay) });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
