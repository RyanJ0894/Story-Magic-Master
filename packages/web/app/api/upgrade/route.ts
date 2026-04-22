/**
 * Direct plan upgrade — testing/dev use.
 * Upgrades the current user's subscription tier without Stripe.
 * Gated by ALLOW_DIRECT_UPGRADE=true env var (must be set to enable).
 */
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const VALID_TIERS = new Set(['creator', 'pro', 'studio', 'enterprise', 'university']);

const TIER_NAMES: Record<string, string> = {
  creator: 'Starter Enterprise',
  pro: 'Professional Simulation',
  studio: 'Studio Enterprise',
  enterprise: 'Enterprise Unlimited',
  university: 'University Program',
};

export async function POST(req: NextRequest) {
  // Safety gate — only allow when explicitly enabled
  if (process.env.ALLOW_DIRECT_UPGRADE !== 'true') {
    return NextResponse.json({ error: 'Direct upgrade is not enabled' }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json() as { tier?: string };
  const tier = (body.tier || '').toLowerCase();

  if (!VALID_TIERS.has(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: tier,
      subscriptionStatus: 'active',
    },
  });

  return NextResponse.json({
    success: true,
    tier,
    tierName: TIER_NAMES[tier] ?? tier,
  });
}
