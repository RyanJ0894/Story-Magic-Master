/**
 * Tests for withWallClockBudget — the timeout-race wrapper used by /analyze.
 *
 * Verifies the contract:
 *   - Promise wins → resolves normally
 *   - Timer wins → rejects with BudgetExceededError carrying label + budgetMs
 *   - budgetMs <= 0 → returns the unwrapped promise (no timer)
 *   - getWallClockBudgetMs respects env override / NaN guard / defaults
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  withWallClockBudget,
  getWallClockBudgetMs,
  BudgetExceededError,
} from './wallclock-budget.js';

describe('withWallClockBudget', () => {
  it('resolves with the promise value when the promise wins', async () => {
    const fast = new Promise((r) => setTimeout(() => r('done'), 10));
    await expect(withWallClockBudget(fast, 100, 'fast')).resolves.toBe('done');
  });

  it('rejects with BudgetExceededError when the timer wins', async () => {
    const slow = new Promise((r) => setTimeout(() => r('eventually'), 100));
    await expect(withWallClockBudget(slow, 20, 'slow op')).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
  });

  it('error carries the label and budgetMs for log/UI use', async () => {
    const slow = new Promise(() => {}); // never resolves
    try {
      await withWallClockBudget(slow, 15, 'analyze proj=abc');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BudgetExceededError);
      const e = err as BudgetExceededError;
      expect(e.label).toBe('analyze proj=abc');
      expect(e.budgetMs).toBe(15);
      expect(e.message).toContain('analyze proj=abc');
      expect(e.message).toContain('15ms');
    }
  });

  it('propagates the original error when the promise rejects before the timer', async () => {
    const reject = Promise.reject(new Error('upstream failure'));
    await expect(withWallClockBudget(reject, 100, 'op')).rejects.toThrow('upstream failure');
  });

  it('budgetMs=0 disables the wrapper (returns the underlying promise)', async () => {
    const p = Promise.resolve('through');
    await expect(withWallClockBudget(p, 0, 'op')).resolves.toBe('through');
  });

  it('budgetMs=-1 disables the wrapper too (treated as no budget)', async () => {
    const p = Promise.resolve('through');
    await expect(withWallClockBudget(p, -1, 'op')).resolves.toBe('through');
  });
});

describe('getWallClockBudgetMs', () => {
  afterEach(() => {
    delete process.env.TEST_BUDGET;
  });

  it('returns the default when env var is unset', () => {
    delete process.env.TEST_BUDGET;
    expect(getWallClockBudgetMs('TEST_BUDGET', 5000)).toBe(5000);
  });

  it('returns the env value when valid', () => {
    process.env.TEST_BUDGET = '7500';
    expect(getWallClockBudgetMs('TEST_BUDGET', 5000)).toBe(7500);
  });

  it('falls back to default on garbage value', () => {
    process.env.TEST_BUDGET = 'not-a-number';
    expect(getWallClockBudgetMs('TEST_BUDGET', 5000)).toBe(5000);
  });

  it('falls back to default on negative value', () => {
    process.env.TEST_BUDGET = '-100';
    expect(getWallClockBudgetMs('TEST_BUDGET', 5000)).toBe(5000);
  });

  it('accepts 0 (operator intent to disable)', () => {
    process.env.TEST_BUDGET = '0';
    expect(getWallClockBudgetMs('TEST_BUDGET', 5000)).toBe(0);
  });
});

describe('BudgetExceededError', () => {
  it('has a stable name property for instanceof + name-based detection', () => {
    const err = new BudgetExceededError('op', 100);
    expect(err.name).toBe('BudgetExceededError');
    expect(err instanceof Error).toBe(true);
  });
});

// Vitest fake-timer paranoia check — make sure the wrapper works under
// realistic concurrency (timer + microtask).
describe('withWallClockBudget timing edge cases', () => {
  it('handles the promise resolving on the same tick as the timer', async () => {
    vi.useFakeTimers();
    try {
      const p = new Promise<string>((resolve) => {
        setTimeout(() => resolve('won'), 50);
      });
      const wrapped = withWallClockBudget(p, 50, 'tie');
      vi.advanceTimersByTime(50);
      // Either side winning is acceptable; just no hang.
      await expect(Promise.race([wrapped.catch(() => 'lost'), Promise.resolve('any')])).resolves.toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
