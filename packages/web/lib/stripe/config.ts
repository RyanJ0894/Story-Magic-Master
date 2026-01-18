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

export type SubscriptionTier = 'free' | 'creator' | 'pro' | 'studio';

export interface PricingTier {
  name: string;
  tier: SubscriptionTier;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  pages: number;
  features: string[];
  highlighted?: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Free',
    tier: 'free',
    description: 'Try Story Magic with limited pages',
    monthlyPrice: 0,
    yearlyPrice: 0,
    pages: 3,
    features: [
      '3 pages per month',
      'Basic audio quality',
      'Email support',
    ],
  },
  {
    name: 'Creator',
    tier: 'creator',
    description: 'For indie filmmakers and content creators',
    monthlyPrice: 29,
    yearlyPrice: 290,
    pages: 50,
    features: [
      '50 pages per month',
      'HD audio quality',
      'Priority processing',
      'Download in multiple formats',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    tier: 'pro',
    description: 'For professional screenwriters and studios',
    monthlyPrice: 79,
    yearlyPrice: 790,
    pages: 200,
    highlighted: true,
    features: [
      '200 pages per month',
      'Studio-quality audio',
      'Priority processing',
      'Custom voice selection',
      'Download in multiple formats',
      'Priority email support',
      'API access',
    ],
  },
  {
    name: 'Studio',
    tier: 'studio',
    description: 'For production studios and enterprises',
    monthlyPrice: 199,
    yearlyPrice: 1990,
    pages: 1000,
    features: [
      '1,000 pages per month',
      'Studio-quality audio',
      'Instant processing',
      'Custom voice selection',
      'Custom music library',
      'Download in all formats',
      'Dedicated support',
      'API access',
      'Team collaboration',
    ],
  },
];

export function getTierByName(tier: SubscriptionTier): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.tier === tier);
}

export function getPageLimit(tier: SubscriptionTier): number {
  const tierConfig = getTierByName(tier);
  return tierConfig?.pages || 3;
}
