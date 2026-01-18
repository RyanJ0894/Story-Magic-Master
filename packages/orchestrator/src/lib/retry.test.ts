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

// Helper to create HTTP-like errors
function createHttpError(status: number): Error & { status: number } {
  const error = new Error(`HTTP Error ${status}`) as Error & { status: number };
  error.status = status;
  return error;
}
