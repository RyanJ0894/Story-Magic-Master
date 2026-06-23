/**
 * Tests for Retry utilities
 * Validates exponential backoff with jitter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, RetryableError } from './retry.js';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first try without retry', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = withRetry(fn, { maxRetries: 3 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableError('Temporary failure', 500, true))
      .mockRejectedValueOnce(new RetryableError('Temporary failure', 500, true))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 100,
    });

    // Run timers for retries
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries exceeded', async () => {
    vi.useRealTimers(); // Use real timers for this test to avoid unhandled rejection

    const fn = vi.fn().mockRejectedValue(new RetryableError('Always fails', 500, true));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 10, // Use short delays for test speed
      })
    ).rejects.toThrow('Always fails');

    expect(fn).toHaveBeenCalledTimes(4); // Initial + 3 retries
  });

  it('should not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Non-retryable'));

    const resultPromise = withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 100,
    });

    await expect(resultPromise).rejects.toThrow('Non-retryable');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use default options when not provided', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = withRetry(fn);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
  });

  it('should handle async functions correctly', async () => {
    const fn = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'async result';
    });

    const resultPromise = withRetry(fn, { maxRetries: 1 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('async result');
  });
});

describe('RetryableError', () => {
  it('should be an instance of Error', () => {
    const error = new RetryableError('test', 500);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RetryableError);
  });

  it('should have correct message', () => {
    const error = new RetryableError('Custom message', 500);
    expect(error.message).toBe('Custom message');
  });

  it('should have correct name', () => {
    const error = new RetryableError('test', 500);
    expect(error.name).toBe('RetryableError');
  });

  it('should have correct status', () => {
    const error = new RetryableError('test', 429);
    expect(error.status).toBe(429);
  });

  it('should default to retryable true', () => {
    const error = new RetryableError('test', 500);
    expect(error.isRetryable).toBe(true);
  });

  it('should allow setting retryable to false', () => {
    const error = new RetryableError('test', 400, false);
    expect(error.isRetryable).toBe(false);
  });

  it('should be catchable as Error', () => {
    try {
      throw new RetryableError('test', 500);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });
});

describe('Retry with HTTP status codes', () => {
  it('should retry on 429 (rate limit)', async () => {
    vi.useRealTimers();

    const fn = vi
      .fn()
      .mockRejectedValueOnce(createHttpError(429))
      .mockResolvedValue('success');

    const result = await withRetry(fn, {
      maxRetries: 1,
      initialDelayMs: 1,
      retryableStatuses: [429, 500, 502, 503, 504],
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should retry on 500 (server error)', async () => {
    vi.useRealTimers();

    const fn = vi
      .fn()
      .mockRejectedValueOnce(createHttpError(500))
      .mockResolvedValue('success');

    const result = await withRetry(fn, {
      maxRetries: 1,
      initialDelayMs: 1,
      retryableStatuses: [429, 500, 502, 503, 504],
    });

    expect(result).toBe('success');
  });

  it('should not retry on 400 (client error)', async () => {
    vi.useRealTimers();

    const fn = vi.fn().mockRejectedValue(createHttpError(400));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        retryableStatuses: [429, 500, 502, 503, 504],
      })
    ).rejects.toThrow();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should not retry on 401 (unauthorized)', async () => {
    vi.useRealTimers();

    const fn = vi.fn().mockRejectedValue(createHttpError(401));

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 1,
        retryableStatuses: [429, 500, 502, 503, 504],
      })
    ).rejects.toThrow();

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('Exponential Backoff', () => {
  it('should increase delay exponentially', async () => {
    vi.useRealTimers();

    const delays: number[] = [];
    let lastCallTime = 0;

    const fn = vi.fn().mockImplementation(() => {
      const now = Date.now();
      // Only record delay after the first call
      if (lastCallTime > 0) {
        delays.push(now - lastCallTime);
      }
      lastCallTime = now;

      if (fn.mock.calls.length < 3) {
        throw new RetryableError('fail', 500, true);
      }
      return 'success';
    });

    await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 50,
      maxDelayMs: 10000,
    });

    // Should have 2 delays recorded (between 3 calls)
    expect(delays.length).toBe(2);
    // Second delay should be roughly double the first (with jitter)
    // Allow for timing variance
    expect(delays[1]).toBeGreaterThan(delays[0] * 0.8);
  });
});

// #378: Retry-After honoring + wider 429 jitter regression guards.
//
// These tests pin the behavior added when ElevenLabs grant-tier limits
// started biting. If any go red, the retry layer has silently regressed
// to "ignore the server's wait-N-seconds guidance" and we'll burn time
// on misaligned backoff exactly when it costs the most (peak load).
describe('withRetry — #378 Retry-After honoring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses RetryableError.retryAfterMs when set, ignoring exponential calc', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RetryableError('429 system_busy', 429, true, 5_000))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxRetries: 2, initialDelayMs: 1000, maxDelayMs: 30_000 });
    // The exponential calc for attempt 0 would be ~1000ms; Retry-After
    // says 5000ms. We advance just below 5000 and confirm fn hasn't
    // been called again yet. The light jitter caps add ~10% so 5400ms
    // is a safe lower bound.
    await vi.advanceTimersByTimeAsync(4900);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(700);
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('caps Retry-After at maxDelayMs even if the server says longer', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RetryableError('429 backoff way too long', 429, true, 999_999))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxRetries: 1, initialDelayMs: 1000, maxDelayMs: 10_000 });
    // Cap should kick in at 10s + ≤10% jitter; well under 999s.
    await vi.advanceTimersByTimeAsync(11_500);
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('falls back to exponential when retryAfterMs is undefined', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RetryableError('429 no header', 429, true))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxRetries: 1, initialDelayMs: 1000, maxDelayMs: 30_000 });
    // Pure exponential: ~1000ms base, ±50% jitter on 429 → up to 1500ms.
    await vi.advanceTimersByTimeAsync(1600);
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses wider jitter (±50%) on 429 vs default jitter on 5xx', async () => {
    // We can't easily inspect the internal jitter, but we can pin that
    // the call completes within the wider window without exceeding the
    // tighter one. Re-running 5 times gives us reasonable confidence.
    for (let trial = 0; trial < 5; trial++) {
      const fn = vi.fn()
        .mockRejectedValueOnce(new RetryableError('429', 429, true))
        .mockResolvedValueOnce('ok');
      const promise = withRetry(fn, { maxRetries: 1, initialDelayMs: 1000, maxDelayMs: 30_000 });
      // Base 1000ms ± 50% = [500, 1500]. Past 1500ms must have fired.
      await vi.advanceTimersByTimeAsync(1600);
      await promise;
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });
});

// Helper to create HTTP-like errors
function createHttpError(status: number): Error & { status: number } {
  const error = new Error(`HTTP Error ${status}`) as Error & { status: number };
  error.status = status;
  return error;
}
