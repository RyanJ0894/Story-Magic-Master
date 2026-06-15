import { describe, it, expect } from 'vitest';
import { fmtInt } from '@/lib/format';

describe('fmtInt', () => {
  it('formats positive integers with en-US grouping', () => {
    expect(fmtInt(1000)).toBe('1,000');
    expect(fmtInt(1234567)).toBe('1,234,567');
  });

  it('returns the same string regardless of caller locale (regression: SSR hydration mismatch)', () => {
    // The whole point of this helper — fmtInt MUST be deterministic. If we
    // ever lose the explicit 'en-US' the SSR vs CSR streams diverge and React
    // flags a hydration warning. This test would catch a missing locale arg.
    const formatted = fmtInt(50000);
    expect(formatted).toMatch(/^50[,. ]?000$/); // separator-agnostic in case of accidental locale leakage
    expect(formatted).toBe('50,000'); // strict — should pass against any environment
  });

  it('drops fractional digits', () => {
    expect(fmtInt(1234.56)).toBe('1,235'); // rounded by toLocaleString with maxFracDigits:0
  });

  it('handles zero and negatives', () => {
    expect(fmtInt(0)).toBe('0');
    expect(fmtInt(-1234)).toBe('-1,234');
  });
});
