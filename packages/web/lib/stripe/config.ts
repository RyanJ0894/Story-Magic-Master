// Stripe configuration and pricing tiers

export const STRIPE_CONFIG = {
  // These will be set in Stripe Dashboard
  prices: {
    creator: {
      monthly: process.env.STRIPE_PRICE_CREATOR_MONTHLY || '',
      yearly: process.env.STRIPE_PRICE_CREATOR_YEARLY || '',
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
    },
    studio: {
      monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY || '',
      yearly: process.env.STRIPE_PRICE_STUDIO_YEARLY || '',
    },
  },
};

// Stripe tier IDs are kept stable (free/creator/pro/studio) for backward compatibility.
// Display names and features reflect the updated product lineup.
export type SubscriptionTier = 'free' | 'creator' | 'pro' | 'studio';

export interface PricingTier {
  name: string;
  tagline: string;
  tier: SubscriptionTier;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  scriptsPerMonth: number | null; // null = unlimited
  maxPagesPerScript: number;
  features: string[];
  limitations: string[];
  highlighted?: boolean;
  trialDays?: number;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Free',
    tagline: 'Discovery',
    tier: 'free',
    description: 'Experience cinematic audio — once. No credit card required.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    scriptsPerMonth: 1,
    maxPagesPerScript: 150,
    features: [
      '1 script upload per month',
      'Up to 150 pages per script',
      '50+ AI voice library',
      'Complete music library (100+ tracks)',
      'Full ambience & SFX library',
      'Unlimited voice recasting',
      'No watermark on exports',
      'M4A download',
      '7-day project storage',
    ],
    limitations: [
      'No voice cloning',
      'No commercial use rights',
      'No collaboration',
      'No priority processing',
    ],
  },
  {
    name: 'Starter',
    tagline: 'Individual',
    tier: 'creator',
    description: 'For writers and actors who need reliable access.',
    monthlyPrice: 30,
    yearlyPrice: 24,
    scriptsPerMonth: 5,
    maxPagesPerScript: 150,
    trialDays: 7,
    features: [
      '5 scripts per month',
      'Up to 150 pages per script',
      '50+ AI voice library',
      'Complete music library',
      'Full ambience & SFX library',
      'Unlimited voice recasting',
      'No watermark on exports',
      'M4A + MP3 download',
      '30-day project storage',
    ],
    limitations: [
      'No voice cloning',
      'No commercial licensing',
      'No collaboration',
      'No priority processing',
    ],
  },
  {
    name: 'Pro',
    tagline: 'Professional',
    tier: 'pro',
    description: 'For working professionals bringing scripts to life.',
    monthlyPrice: 60,
    yearlyPrice: 48,
    scriptsPerMonth: 15,
    maxPagesPerScript: 150,
    highlighted: true,
    trialDays: 7,
    features: [
      '15 scripts per month',
      'Up to 150 pages per script',
      '100+ premium AI voice library',
      'Custom voice cloning (3 voices)',
      'Premium music library (300+ tracks)',
      'Advanced SFX library (500+ effects)',
      'Commercial use rights',
      'Collaboration (up to 3 people)',
      'Priority processing (2× faster)',
      'M4A + MP3 + WAV download',
      '90-day project storage',
    ],
    limitations: [],
  },
  {
    name: 'Creator',
    tagline: 'Elite',
    tier: 'studio',
    description: 'Unlimited creative freedom for serious filmmakers.',
    monthlyPrice: 100,
    yearlyPrice: 80,
    scriptsPerMonth: 25,
    maxPagesPerScript: 150,
    trialDays: 7,
    features: [
      '25 scripts per month',
      'Up to 150 pages per script',
      '150+ premium AI voice library',
      'Custom voice cloning (10 voices)',
      'Exclusive voice marketplace access',
      'Genre sound packs (Horror, Sci-Fi, Romance, etc.)',
      'Real-time script collaboration rooms',
      'Casting simulation mode',
      'White-label audio (your branding)',
      'Multi-format exports (M4A, WAV, MP3)',
      'Unlimited project storage',
      'StoryScore + Story Adviser',
    ],
    limitations: [],
  },
];

export function getTierByName(tier: SubscriptionTier): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.tier === tier);
}

export function getScriptLimit(tier: SubscriptionTier): number | null {
  return getTierByName(tier)?.scriptsPerMonth ?? 1;
}

/** @deprecated Use getScriptLimit. Pages-based limits are replaced by per-script limits. */
export function getPageLimit(tier: SubscriptionTier): number {
  return getTierByName(tier)?.maxPagesPerScript ?? 150;
}
