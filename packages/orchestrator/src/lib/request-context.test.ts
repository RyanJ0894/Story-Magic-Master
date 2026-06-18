// @vitest-environment node

/**
 * Tests for request-context — the per-request AsyncLocalStorage that lets
 * us thread a requestId through the entire orchestration chain so any log
 * line or downstream HTTP call can pick it up without explicit plumbing.
 *
 * 2026-06-17 (Peter): "Being able to associate requests with failures in
 * the logs would have helped debug this issue."
 */

import { describe, it, expect } from 'vitest';
import {
  generateRequestId,
  getRequestContext,
  runWithRequestContext,
} from './request-context.js';

describe('generateRequestId', () => {
  it('produces a sm_-prefixed id', () => {
    const id = generateRequestId();
    expect(id).toMatch(/^sm_[a-z0-9]+_[a-f0-9]{6}$/);
  });

  it('produces unique ids on rapid calls', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(generateRequestId());
    // 6 hex chars of randomness = 16M possible per ms — collisions
    // negligible at our request rate
    expect(ids.size).toBe(100);
  });

  it('sorts by epoch — newer ids sort after older ones in lexical order', async () => {
    const a = generateRequestId();
    await new Promise((r) => setTimeout(r, 5));
    const b = generateRequestId();
    // Take the time part (between the two _) — that's the base36 epoch
    const timeA = a.split('_')[1];
    const timeB = b.split('_')[1];
    expect(timeB >= timeA).toBe(true);
  });
});

describe('runWithRequestContext / getRequestContext', () => {
  it('returns undefined outside of a context', () => {
    expect(getRequestContext()).toBeUndefined();
  });

  it('exposes the requestId inside the run', async () => {
    await runWithRequestContext({ requestId: 'sm_test_abc123' }, async () => {
      expect(getRequestContext()).toEqual({ requestId: 'sm_test_abc123' });
    });
  });

  it('preserves the context across awaited async boundaries', async () => {
    await runWithRequestContext({ requestId: 'sm_x_y', projectId: 'p1' }, async () => {
      await new Promise((r) => setTimeout(r, 10));
      expect(getRequestContext()?.requestId).toBe('sm_x_y');
      expect(getRequestContext()?.projectId).toBe('p1');
    });
  });

  it('isolates concurrent runs from each other', async () => {
    const observed: string[] = [];
    await Promise.all([
      runWithRequestContext({ requestId: 'A' }, async () => {
        await new Promise((r) => setTimeout(r, 20));
        observed.push(getRequestContext()?.requestId ?? '?');
      }),
      runWithRequestContext({ requestId: 'B' }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        observed.push(getRequestContext()?.requestId ?? '?');
      }),
    ]);
    expect(observed.sort()).toEqual(['A', 'B']);
  });

  it('context goes back to undefined after the run exits', async () => {
    await runWithRequestContext({ requestId: 'inside' }, async () => {
      // present inside
    });
    expect(getRequestContext()).toBeUndefined();
  });

  it('returns the inner fn return value', async () => {
    const result = await runWithRequestContext({ requestId: 'x' }, async () => 42);
    expect(result).toBe(42);
  });
});
