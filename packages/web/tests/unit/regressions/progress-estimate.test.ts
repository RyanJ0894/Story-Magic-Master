/**
 * Regression guard for the page-aware progress-bar estimate.
 *
 * Background: ESTIMATED_DURATION_MS was a flat 120 000 ms constant. The
 * client-side smooth-progress timer (generate-button.tsx) interpolated
 * 0 → 95 % across that window, then capped. For typical jobs (~50 s/page),
 * the bar hit 95 % roughly 70 s in and sat there for the bulk of the
 * 8-minute run — Chris reported "stuck at 95 % for 90 % of the time" on
 * 2026-06-24.
 *
 * If a future refactor silently re-introduces a flat constant or breaks
 * the per-page scaling, these tests go red.
 */
import { describe, it, expect } from 'vitest';
import { estimateDurationMs } from '@/app/projects/[id]/generate-button';

describe('estimateDurationMs — page-aware progress estimate', () => {
  it('is monotonic in pageCount (more pages → longer estimate)', () => {
    const a = estimateDurationMs(1);
    const b = estimateDurationMs(10);
    const c = estimateDurationMs(100);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('floors at the 1-page estimate for 0 / negative / NaN inputs', () => {
    const onePage = estimateDurationMs(1);
    expect(estimateDurationMs(0)).toBe(onePage);
    expect(estimateDurationMs(-5)).toBe(onePage);
    expect(estimateDurationMs(NaN)).toBe(onePage);
  });

  it('is calibrated to real dev-run measurements (~50 s/page sustained)', () => {
    // Real data: jobId 8d8b3b71 on dev 2026-06-24 — 10-page script,
    // 492 s wall clock end-to-end. Our estimate for 10 pages must land
    // within ±25 % of that to remain useful as a progress-bar target.
    const estimateSec = estimateDurationMs(10) / 1000;
    const realSec = 492;
    expect(estimateSec).toBeGreaterThan(realSec * 0.75);
    expect(estimateSec).toBeLessThan(realSec * 1.25);
  });

  it('is NOT a flat constant — the old bug was a fixed 120 000 ms', () => {
    // The whole point of this PR: a 90-page script must estimate a much
    // larger duration than a 5-page script. If these are equal, we have
    // silently regressed to the flat constant.
    expect(estimateDurationMs(5)).not.toBe(estimateDurationMs(90));
    expect(estimateDurationMs(90)).toBeGreaterThan(estimateDurationMs(5) * 5);
  });
});
