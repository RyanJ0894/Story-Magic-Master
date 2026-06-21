/**
 * waitForOrchestratorReady default-timeout regression test.
 *
 * Ryan's 6/19 trace hit "did not become ready within 60000ms (probed 15x)"
 * on a cold-boot deploy. We bumped the default from 60s → 90s. This test
 * pins the default so it can't quietly drift back.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForOrchestratorReady, OrchestratorUnreachableError } from '@/lib/orchestrator-fetch';

describe('waitForOrchestratorReady', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('default deadline is 90s (covers cold-boot + whisper-model load)', async () => {
    // Force every health-check to throw so the loop exhausts the deadline.
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.reject(new Error('connection refused'))
    );

    const promise = waitForOrchestratorReady(undefined, 1_000).catch((err) => err);

    // Advance just past 60s — should NOT have given up yet (the old default).
    await vi.advanceTimersByTimeAsync(60_500);
    // Drain microtasks so any premature rejection materializes.
    await Promise.resolve();

    // Advance to past 90s — now it should reject.
    await vi.advanceTimersByTimeAsync(31_000);
    const result = await promise;

    expect(result).toBeInstanceOf(OrchestratorUnreachableError);
    expect((result as Error).message).toMatch(/within 90000ms/);
  });

  it('throws OrchestratorUnreachableError with probe count', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.reject(new Error('ECONNREFUSED'))
    );

    const promise = waitForOrchestratorReady(6_000, 1_000).catch((err) => err);
    await vi.advanceTimersByTimeAsync(7_000);
    const result = await promise;

    expect(result).toBeInstanceOf(OrchestratorUnreachableError);
    expect((result as Error).message).toMatch(/probed \d+x/);
  });
});
