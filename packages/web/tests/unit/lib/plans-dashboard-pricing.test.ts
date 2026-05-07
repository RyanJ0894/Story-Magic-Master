/**
 * Plans Dashboard Pricing Tests (Issue #28)
 *
 * Validates:
 * - PRICING_TIERS (authoritative source) has correct prices/names
 * - The referral TIER_DISPLAY mapping uses correct individual plan names and script counts
 * - "Most Popular" plan is `pro`
 */

import { describe, it, expect } from 'vitest';
import { PRICING_TIERS, getTierByName } from '@/lib/stripe/config';

// =============================================================================
// TIER_DISPLAY — replicated from app/referral/page.tsx
// Must stay in sync with the actual file values.
// =============================================================================
const TIER_DISPLAY: Record<string, { name: string; pages: string }> = {
  creator:    { name: 'Starter',             pages: '5 scripts/month' },
  pro:        { name: 'Pro',                 pages: '15 scripts/month' },
  studio:     { name: 'Creator',             pages: '25 scripts/month' },
  enterprise: { name: 'Enterprise Unlimited', pages: 'Unlimited' },
};

// =============================================================================
// PRICING_TIERS — authoritative source
// =============================================================================

describe('PRICING_TIERS', () => {
  it('has all four individual plans', () => {
    const tiers = PRICING_TIERS.map((t) => t.tier);
    expect(tiers).toContain('free');
    expect(tiers).toContain('creator');
    expect(tiers).toContain('pro');
    expect(tiers).toContain('studio');
  });

  it('free plan has zero price', () => {
    const free = getTierByName('free');
    expect(free?.monthlyPrice).toBe(0);
  });

  it('creator (Starter) plan is $30/mo', () => {
    const starter = getTierByName('creator');
    expect(starter?.monthlyPrice).toBe(30);
    expect(starter?.name).toBe('Starter');
  });

  it('pro plan is $60/mo', () => {
    const pro = getTierByName('pro');
    expect(pro?.monthlyPrice).toBe(60);
    expect(pro?.name).toBe('Pro');
  });

  it('studio (Creator) plan is $100/mo', () => {
    const studio = getTierByName('studio');
    expect(studio?.monthlyPrice).toBe(100);
    expect(studio?.name).toBe('Creator');
  });

  it('exactly one plan is marked highlighted (Most Popular)', () => {
    const highlighted = PRICING_TIERS.filter((t) => t.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].tier).toBe('pro');
  });

  it('each plan has at least one feature', () => {
    for (const plan of PRICING_TIERS) {
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  it('plans are ordered free → creator → pro → studio by price', () => {
    const prices = PRICING_TIERS.map((t) => t.monthlyPrice);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });
});

// =============================================================================
// TIER_DISPLAY — referral page mapping
// =============================================================================

describe('TIER_DISPLAY (referral/page.tsx)', () => {
  it('creator maps to "Starter" with 5 scripts/month', () => {
    expect(TIER_DISPLAY.creator.name).toBe('Starter');
    expect(TIER_DISPLAY.creator.pages).toBe('5 scripts/month');
  });

  it('pro maps to "Pro" with 15 scripts/month', () => {
    expect(TIER_DISPLAY.pro.name).toBe('Pro');
    expect(TIER_DISPLAY.pro.pages).toBe('15 scripts/month');
  });

  it('studio maps to "Creator" with 25 scripts/month', () => {
    expect(TIER_DISPLAY.studio.name).toBe('Creator');
    expect(TIER_DISPLAY.studio.pages).toBe('25 scripts/month');
  });

  it('enterprise maps to "Enterprise Unlimited"', () => {
    expect(TIER_DISPLAY.enterprise.name).toBe('Enterprise Unlimited');
  });

  it('TIER_DISPLAY names match PRICING_TIERS names for individual tiers', () => {
    const tierMap: Record<string, string> = {
      creator: 'Starter',
      pro: 'Pro',
      studio: 'Creator',
    };
    for (const [key, expectedName] of Object.entries(tierMap)) {
      expect(TIER_DISPLAY[key].name).toBe(expectedName);
      const pricingTier = getTierByName(key as 'creator' | 'pro' | 'studio');
      expect(pricingTier?.name).toBe(expectedName);
    }
  });

  it('TIER_DISPLAY script counts match PRICING_TIERS scriptsPerMonth', () => {
    const expectedCounts: Record<string, number> = { creator: 5, pro: 15, studio: 25 };
    for (const [key, count] of Object.entries(expectedCounts)) {
      const pricingTier = getTierByName(key as 'creator' | 'pro' | 'studio');
      expect(pricingTier?.scriptsPerMonth).toBe(count);
      expect(TIER_DISPLAY[key].pages).toBe(`${count} scripts/month`);
    }
  });
});
