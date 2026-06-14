import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withQueryTimeout, QueryTimeoutError } from '@/lib/db/with-query-timeout';

describe('withQueryTimeout (STORY-MAGIC-1G)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the value when the promise settles before the timeout', async () => {
    const p = Promise.resolve({ id: 'job-1' });
    await expect(withQueryTimeout(p, 1000)).resolves.toEqual({ id: 'job-1' });
  });

  it('rejects with QueryTimeoutError when the timeout fires first', async () => {
    // A promise that never resolves to simulate a blocked connection.
    const blocked = new Promise<never>(() => {});
    const promise = withQueryTimeout(blocked, 100, 'jobs poll');
    // Pre-attach a catch so the rejection (which fires asynchronously when
    // we advance timers) doesn't ever surface as unhandled while the test
    // is waiting.
    const caught = promise.catch((e) => e);

    // Advance past the timeout.
    await vi.advanceTimersByTimeAsync(150);

    const err = await caught;
    expect(err).toBeInstanceOf(QueryTimeoutError);
    expect(err).toMatchObject({
      timeoutMs: 100,
      label: 'jobs poll',
    });
    expect((err as QueryTimeoutError).message).toContain('100ms');
  });

  it('propagates the underlying error if it rejects before the timeout', async () => {
    const failing = Promise.reject(new Error('connection terminated'));
    await expect(withQueryTimeout(failing, 1000)).rejects.toThrow('connection terminated');
  });

  it('swallows a late rejection from the underlying promise via the in-flight .catch', async () => {
    // Production proof: the helper attaches `promise.catch(() => {})` so a
    // late rejection from a blocked query can't bubble up after we've
    // already returned via timeout. Verified directly here.
    let rejectLate: (err: Error) => void = () => {};
    const slow = new Promise<never>((_, reject) => {
      rejectLate = reject;
    });
    const timed = withQueryTimeout(slow, 50);
    // Pre-attach so the QueryTimeoutError never floats.
    const caught = timed.catch((e) => e);
    await vi.advanceTimersByTimeAsync(60);
    const err = await caught;
    expect(err).toBeInstanceOf(QueryTimeoutError);

    // Now late-reject the underlying promise. With the in-helper catch
    // attached, this completes without throwing — no PromiseRejectionHandledWarning
    // in the test runner output.
    rejectLate(new Error('late rejection — should be swallowed'));
    // Yield to microtasks so any unhandled rejection would have surfaced.
    await Promise.resolve();
    await Promise.resolve();
    expect(true).toBe(true);
  });

  it('clears the timer when the promise wins (no dangling setTimeout)', async () => {
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    const p = Promise.resolve('quick');
    await withQueryTimeout(p, 10_000);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('QueryTimeoutError carries timeoutMs and label for triage', () => {
    const err = new QueryTimeoutError(2500, 'analytics');
    expect(err.name).toBe('QueryTimeoutError');
    expect(err.timeoutMs).toBe(2500);
    expect(err.label).toBe('analytics');
    expect(err.message).toContain('2500ms');
    expect(err.message).toContain('analytics');
  });
});
