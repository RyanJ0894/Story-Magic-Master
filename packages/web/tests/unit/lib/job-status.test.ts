/**
 * Tests for the isRetryImminent / isTerminalFailure helpers.
 *
 * These pin down the contract that fixes the 2026-06-24 Peter regression:
 * after a chunk failure the row briefly has status='failed' with
 * retry_count < max_retries before the worker re-dequeues it. The UI must
 * keep polling during that window or it misses the eventual completion
 * and the page stays stuck on "failed" even after a reload.
 */

import { describe, it, expect } from 'vitest';
import { isRetryImminent, isTerminalFailure } from '@/lib/generation/job-status';

describe('isRetryImminent', () => {
  it('returns false for non-failed statuses (queued, processing, completed)', () => {
    expect(isRetryImminent({ status: 'queued', retry_count: 0, max_retries: 3 })).toBe(false);
    expect(isRetryImminent({ status: 'processing', retry_count: 0, max_retries: 3 })).toBe(false);
    expect(isRetryImminent({ status: 'completed', retry_count: 0, max_retries: 3 })).toBe(false);
  });

  it('returns true when failed AND retries remain (the bug-class window)', () => {
    expect(isRetryImminent({ status: 'failed', retry_count: 0, max_retries: 3 })).toBe(true);
    expect(isRetryImminent({ status: 'failed', retry_count: 1, max_retries: 3 })).toBe(true);
    expect(isRetryImminent({ status: 'failed', retry_count: 2, max_retries: 3 })).toBe(true);
  });

  it('returns false when failed and retries exhausted', () => {
    expect(isRetryImminent({ status: 'failed', retry_count: 3, max_retries: 3 })).toBe(false);
    expect(isRetryImminent({ status: 'failed', retry_count: 4, max_retries: 3 })).toBe(false);
  });

  it('returns false when retry telemetry is missing (defensive — legacy rows)', () => {
    // Legacy job rows before this PR didn't expose retry_count / max_retries.
    // Without those fields we can't safely decide to keep polling, so we
    // treat 'failed' as terminal and let the UI surface the error.
    expect(isRetryImminent({ status: 'failed' })).toBe(false);
    expect(isRetryImminent({ status: 'failed', retry_count: null, max_retries: 3 })).toBe(false);
    expect(isRetryImminent({ status: 'failed', retry_count: 0, max_retries: null })).toBe(false);
  });
});

describe('isTerminalFailure', () => {
  it('returns true when failed and retries exhausted', () => {
    expect(isTerminalFailure({ status: 'failed', retry_count: 3, max_retries: 3 })).toBe(true);
  });

  it('returns false when failed but retries remain (NOT terminal — retry incoming)', () => {
    expect(isTerminalFailure({ status: 'failed', retry_count: 1, max_retries: 3 })).toBe(false);
  });

  it('returns true when failed and retry telemetry is missing (legacy fallback)', () => {
    // Without retry telemetry we treat 'failed' as terminal so we don't
    // poll forever on legacy rows that never expose retry_count / max_retries.
    expect(isTerminalFailure({ status: 'failed' })).toBe(true);
  });

  it('returns false for non-failed statuses', () => {
    expect(isTerminalFailure({ status: 'queued', retry_count: 3, max_retries: 3 })).toBe(false);
    expect(isTerminalFailure({ status: 'processing', retry_count: 3, max_retries: 3 })).toBe(false);
    expect(isTerminalFailure({ status: 'completed' })).toBe(false);
  });

  it('isRetryImminent and isTerminalFailure are mutually exclusive on `failed`', () => {
    // For any failed-status input that includes retry telemetry, exactly
    // one of the two helpers must return true. This contract is what makes
    // the UI's polling decision unambiguous.
    const cases = [
      { retry_count: 0, max_retries: 3 },
      { retry_count: 2, max_retries: 3 },
      { retry_count: 3, max_retries: 3 },
      { retry_count: 5, max_retries: 3 },
    ];
    for (const c of cases) {
      const input = { status: 'failed' as const, ...c };
      expect(isRetryImminent(input) !== isTerminalFailure(input)).toBe(true);
    }
  });
});
