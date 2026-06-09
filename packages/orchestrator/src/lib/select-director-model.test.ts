/**
 * Tests for selectDirectorModel — the cost-tier router.
 *
 * Pins the decision matrix:
 *   - Advanced purchase → Opus, regardless of script size.
 *   - Small script (≤ threshold) → Haiku.
 *   - Large script (> threshold) → Sonnet.
 *   - Empty script → Sonnet (no evidence to be cheap).
 *   - TIER1_PAGE_THRESHOLD=0 → tiering disabled, always Sonnet.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { selectDirectorModel, estimatePageCount } from './select-director-model.js';

const SMALL_SCRIPT = 'INT. ROOM - DAY\n\nALEX\nHi.'; // tiny
const LARGE_SCRIPT = 'word '.repeat(10_000).trim(); // ~40 pages worth of "words"

describe('estimatePageCount', () => {
  it('returns 0 for empty input', () => {
    expect(estimatePageCount('')).toBe(0);
    expect(estimatePageCount('   ')).toBe(0);
  });

  it('returns at least 1 for non-empty input', () => {
    expect(estimatePageCount('hello world')).toBe(1);
  });

  it('scales roughly to 250 words per page', () => {
    const oneThousandWords = 'word '.repeat(1000).trim();
    expect(estimatePageCount(oneThousandWords)).toBe(4);
  });
});

describe('selectDirectorModel', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.TIER1_PAGE_THRESHOLD;
    delete process.env.TIER1_MODEL;
    delete process.env.DIRECTOR_MODEL;
    delete process.env.DIRECTOR_MODEL_ADVANCED;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('Advanced Analysis: returns Opus regardless of script size', () => {
    const small = selectDirectorModel({ scriptText: SMALL_SCRIPT, useAdvanced: true });
    expect(small.tier).toBe('advanced');
    expect(small.model).toMatch(/opus/i);

    const big = selectDirectorModel({ scriptText: LARGE_SCRIPT, useAdvanced: true });
    expect(big.tier).toBe('advanced');
    expect(big.model).toMatch(/opus/i);
  });

  it('Small script (≤ 5 pages default): selects tier-1 Haiku model', () => {
    const r = selectDirectorModel({ scriptText: SMALL_SCRIPT, useAdvanced: false });
    expect(r.tier).toBe('tier1');
    expect(r.model).toMatch(/haiku/i);
  });

  it('Large script (> threshold): falls back to tier-2 Sonnet', () => {
    const r = selectDirectorModel({ scriptText: LARGE_SCRIPT, useAdvanced: false });
    expect(r.tier).toBe('tier2');
    expect(r.model).toMatch(/sonnet/i);
  });

  it('Empty script: tier-2 (no evidence to be cheap)', () => {
    const r = selectDirectorModel({ scriptText: '', useAdvanced: false });
    expect(r.tier).toBe('tier2');
    expect(r.estimatedPages).toBe(0);
  });

  it('TIER1_PAGE_THRESHOLD=0 disables tiering — small scripts also use tier-2', () => {
    process.env.TIER1_PAGE_THRESHOLD = '0';
    const r = selectDirectorModel({ scriptText: SMALL_SCRIPT, useAdvanced: false });
    expect(r.tier).toBe('tier2');
  });

  it('respects TIER1_MODEL env override', () => {
    process.env.TIER1_MODEL = 'groq/llama-3.3-70b-versatile';
    const r = selectDirectorModel({ scriptText: SMALL_SCRIPT, useAdvanced: false });
    expect(r.model).toBe('groq/llama-3.3-70b-versatile');
    expect(r.tier).toBe('tier1');
  });

  it('respects DIRECTOR_MODEL env override on tier-2', () => {
    process.env.DIRECTOR_MODEL = 'anthropic/claude-sonnet-4-7';
    const r = selectDirectorModel({ scriptText: LARGE_SCRIPT, useAdvanced: false });
    expect(r.model).toBe('anthropic/claude-sonnet-4-7');
  });

  it('respects TIER1_PAGE_THRESHOLD env override (raise threshold to 50)', () => {
    process.env.TIER1_PAGE_THRESHOLD = '50';
    // ~40-page script now counts as tier-1.
    const r = selectDirectorModel({ scriptText: LARGE_SCRIPT, useAdvanced: false });
    expect(r.tier).toBe('tier1');
  });

  it('garbage TIER1_PAGE_THRESHOLD falls back to default (5)', () => {
    process.env.TIER1_PAGE_THRESHOLD = 'not-a-number';
    const r = selectDirectorModel({ scriptText: SMALL_SCRIPT, useAdvanced: false });
    expect(r.tier).toBe('tier1'); // default 5 still applies
  });
});
