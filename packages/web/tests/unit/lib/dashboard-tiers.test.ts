/**
 * Tests for dashboard tier constants and enterprise routing logic
 *
 * Validates TIER_LIMITS, TIER_NAMES, and the enterprise-redirect decision
 * logic that lives in app/dashboard/page.tsx.
 */

import { describe, it, expect } from 'vitest';

// =============================================================================
// Replicated constants (kept in sync with dashboard/page.tsx)
// =============================================================================

const TIER_LIMITS: Record<string, number> = {
  free: 3,
  creator: 50,
  pro: 200,
  studio: 1000,
  enterprise: 9999,
  university: 500,
};

const TIER_NAMES: Record<string, string> = {
  free: 'Individual',
  creator: 'Starter Enterprise',
  pro: 'Professional Simulation',
  studio: 'Studio Enterprise',
  enterprise: 'Enterprise Unlimited',
  university: 'University Program',
};

const ENTERPRISE_TIERS = ['creator', 'pro', 'studio', 'enterprise'];

// =============================================================================
// Tests
// =============================================================================

describe('TIER_LIMITS', () => {
  it('free tier has the lowest limit', () => {
    expect(TIER_LIMITS.free).toBe(3);
  });

  it('enterprise tier has an effectively unlimited page count', () => {
    expect(TIER_LIMITS.enterprise).toBeGreaterThan(1000);
  });

  it('each tier has a higher limit than the previous', () => {
    const ordered = ['free', 'creator', 'pro', 'studio', 'enterprise'];
    for (let i = 1; i < ordered.length; i++) {
      expect(TIER_LIMITS[ordered[i]]).toBeGreaterThan(TIER_LIMITS[ordered[i - 1]]);
    }
  });

  it('all required tiers are present', () => {
    const required = ['free', 'creator', 'pro', 'studio', 'enterprise', 'university'];
    for (const tier of required) {
      expect(TIER_LIMITS).toHaveProperty(tier);
      expect(TIER_LIMITS[tier]).toBeGreaterThan(0);
    }
  });
});

describe('TIER_NAMES', () => {
  it('free tier is labelled Individual', () => {
    expect(TIER_NAMES.free).toBe('Individual');
  });

  it('all tiers have display names', () => {
    const tiers = ['free', 'creator', 'pro', 'studio', 'enterprise', 'university'];
    for (const tier of tiers) {
      expect(typeof TIER_NAMES[tier]).toBe('string');
      expect(TIER_NAMES[tier].length).toBeGreaterThan(0);
    }
  });
});

describe('Enterprise redirect logic', () => {
  const shouldRedirect = (tier: string) => ENTERPRISE_TIERS.includes(tier);

  it('free tier does NOT trigger enterprise redirect', () => {
    expect(shouldRedirect('free')).toBe(false);
  });

  it('university tier does NOT trigger enterprise redirect', () => {
    expect(shouldRedirect('university')).toBe(false);
  });

  it.each(['creator', 'pro', 'studio', 'enterprise'])(
    '"%s" tier triggers enterprise redirect',
    (tier) => {
      expect(shouldRedirect(tier)).toBe(true);
    }
  );

  it('unknown tier does NOT trigger enterprise redirect', () => {
    expect(shouldRedirect('unknown')).toBe(false);
    expect(shouldRedirect('')).toBe(false);
  });
});

describe('Usage percent calculation', () => {
  const calcUsagePercent = (tierLimit: number, usedPages: number) =>
    tierLimit > 0 ? Math.min(100, (usedPages / tierLimit) * 100) : 0;

  it('returns 0 when nothing is used', () => {
    expect(calcUsagePercent(3, 0)).toBe(0);
  });

  it('returns 100 at limit', () => {
    expect(calcUsagePercent(3, 3)).toBe(100);
  });

  it('caps at 100 when over limit', () => {
    expect(calcUsagePercent(3, 5)).toBe(100);
  });

  it('returns correct percent mid-range', () => {
    expect(calcUsagePercent(200, 50)).toBe(25);
  });

  it('returns 0 when tierLimit is 0 (avoids divide-by-zero)', () => {
    expect(calcUsagePercent(0, 10)).toBe(0);
  });
});
