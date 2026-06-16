/**
 * Tests for the playback-progress helpers — closes #208.
 *
 * The bug: Reader dashboard "Recently Played" was showing nonsense
 * percentages (>100%, NaN, missing) because two call sites
 * (reader-script-card.tsx lines 64 and 245) did naive
 * `(position / duration) * 100` without clamping or null guards.
 *
 * The most common real-world cause: the audio gets re-generated to a
 * shorter duration while the user's saved playPositionSeconds is from
 * the older longer mix. position > duration, ratio > 1.0, bar overflows.
 *
 * These tests pin every edge case the helper must handle so a future
 * cleanup can't quietly re-introduce raw division anywhere that consumes
 * these values.
 */

import { describe, it, expect } from 'vitest';
import { computePlaybackProgress, formatPercentComplete } from '@/lib/reader/playback-progress';

describe('computePlaybackProgress', () => {
  it('returns the simple ratio when both inputs are valid', () => {
    expect(computePlaybackProgress(30, 60)).toBe(50);
    expect(computePlaybackProgress(45, 90)).toBe(50);
    expect(computePlaybackProgress(15, 60)).toBe(25);
  });

  it('returns 0 when position is null/undefined/missing', () => {
    expect(computePlaybackProgress(null, 60)).toBe(0);
    expect(computePlaybackProgress(undefined, 60)).toBe(0);
  });

  it('returns 0 when duration is null/undefined/missing', () => {
    expect(computePlaybackProgress(30, null)).toBe(0);
    expect(computePlaybackProgress(30, undefined)).toBe(0);
  });

  it('returns 0 when duration is 0 or negative', () => {
    expect(computePlaybackProgress(30, 0)).toBe(0);
    expect(computePlaybackProgress(30, -10)).toBe(0);
  });

  it('returns 0 when position is 0 or negative', () => {
    expect(computePlaybackProgress(0, 60)).toBe(0);
    expect(computePlaybackProgress(-5, 60)).toBe(0);
  });

  it('clamps to 100 when position exceeds duration (the #208 main symptom)', () => {
    // Most common real-world cause: audio re-generated shorter than saved position.
    expect(computePlaybackProgress(120, 60)).toBe(100);
    expect(computePlaybackProgress(999999, 100)).toBe(100);
    // Just barely over
    expect(computePlaybackProgress(61, 60)).toBe(100);
  });

  it('handles NaN inputs without exploding', () => {
    expect(computePlaybackProgress(NaN, 60)).toBe(0);
    expect(computePlaybackProgress(30, NaN)).toBe(0);
    expect(computePlaybackProgress(NaN, NaN)).toBe(0);
  });

  it('handles Infinity inputs without exploding', () => {
    expect(computePlaybackProgress(Infinity, 60)).toBe(0);
    expect(computePlaybackProgress(30, Infinity)).toBe(0);
  });

  it('produces values exactly between 0 and 100 for normal in-progress playback', () => {
    for (let i = 0; i <= 100; i += 10) {
      const result = computePlaybackProgress(i, 100);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    }
  });

  it('preserves fractional precision (callers can round if they need an integer)', () => {
    // 33.333…% should remain a float, not be coerced to int. The label
    // formatter does its own Math.round; the <Progress> bar prefers floats.
    const r = computePlaybackProgress(33, 100);
    expect(r).toBe(33);
    const r2 = computePlaybackProgress(1, 3);
    expect(r2).toBeCloseTo(33.333, 1);
  });
});

describe('formatPercentComplete', () => {
  it('returns "In progress" when duration is unknown', () => {
    expect(formatPercentComplete(30, null)).toBe('In progress');
    expect(formatPercentComplete(30, undefined)).toBe('In progress');
    expect(formatPercentComplete(30, 0)).toBe('In progress');
  });

  it('returns a rounded integer percentage with " complete" suffix', () => {
    expect(formatPercentComplete(30, 60)).toBe('50% complete');
    expect(formatPercentComplete(45, 100)).toBe('45% complete');
  });

  it('rounds rather than truncates', () => {
    // 1/3 → 33.33… → 33%
    expect(formatPercentComplete(1, 3)).toBe('33% complete');
    // 2/3 → 66.66… → 67%
    expect(formatPercentComplete(2, 3)).toBe('67% complete');
  });

  it('caps at "100% complete" for over-the-end positions (#208)', () => {
    expect(formatPercentComplete(120, 60)).toBe('100% complete');
    expect(formatPercentComplete(999, 60)).toBe('100% complete');
  });

  it('shows "0% complete" when position is 0 but duration is valid', () => {
    expect(formatPercentComplete(0, 60)).toBe('0% complete');
  });

  it('handles null/undefined position gracefully', () => {
    expect(formatPercentComplete(null, 60)).toBe('0% complete');
    expect(formatPercentComplete(undefined, 60)).toBe('0% complete');
  });
});
