/**
 * Tests for mixerTimeoutMs — Sprint 5 BL-011
 *
 * Validates timeout scaling: base 30s + 0.5s/page, capped at 300s.
 */

import { describe, it, expect } from 'vitest';
import { mixerTimeoutMs } from './mixer.js';

describe('mixerTimeoutMs', () => {
  it('returns 120_000 when pageCount is undefined', () => {
    expect(mixerTimeoutMs(undefined)).toBe(120_000);
  });

  it('returns 120_000 when pageCount is 0', () => {
    expect(mixerTimeoutMs(0)).toBe(120_000);
  });

  it('returns 120_000 when pageCount is negative', () => {
    expect(mixerTimeoutMs(-5)).toBe(120_000);
  });

  it('scales linearly: 1 page → 30_500ms', () => {
    expect(mixerTimeoutMs(1)).toBe(30_500);
  });

  it('scales linearly: 90 pages → 30_000 + 45_000 = 75_000ms', () => {
    expect(mixerTimeoutMs(90)).toBe(75_000);
  });

  it('scales linearly: 120 pages → 30_000 + 60_000 = 90_000ms', () => {
    expect(mixerTimeoutMs(120)).toBe(90_000);
  });

  it('caps at 300_000 for very long scripts', () => {
    expect(mixerTimeoutMs(1000)).toBe(300_000);
  });

  it('caps at 300_000 exactly at 540 pages (30_000 + 270_000 = 300_000)', () => {
    expect(mixerTimeoutMs(540)).toBe(300_000);
  });

  it('caps at 300_000 for 541 pages (would be 300_500 uncapped)', () => {
    expect(mixerTimeoutMs(541)).toBe(300_000);
  });

  it('returns 120_000 as safe default for null-like inputs', () => {
    // null is not a valid type but guards against JS callers
    expect(mixerTimeoutMs(null as unknown as number)).toBe(120_000);
  });
});
