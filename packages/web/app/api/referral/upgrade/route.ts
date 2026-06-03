import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Referral code → tier mapping comes exclusively from the REFERRAL_CODES env var
// (JSON object, e.g. {"MYCODE":"studio","OTHERCODE":"enterprise"}).
// No built-in codes — hard-coded codes in source are a supply-chain security risk.
function getValidCodes(): Record<string, string> {
  try {
    const env = process.env.REFERRAL_CODES;
    if (env) return JSON.parse(env) as Record<string, string>;
  } catch {
    // ignore malformed JSON
  }
  return {};
}

const TIER_NAMES: Record<string, string> = {
  creator: 'Starter Enterprise',
  pro: 'Professional Simulation',
  studio: 'Studio Enterprise',
  enterprise: 'Enterprise Unlimited',
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json() as { code?: string };
  const code = (body.code || '').trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
  }

  const validCodes = getValidCodes();
  const targetTier = validCodes[code];

  if (!targetTier) {
    return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
  }

  await prisma.profile.update({
    where: { id: userId },
    data: {
      subscriptionTier: targetTier,
      subscriptionStatus: 'active',
    },
  });

  return NextResponse.json({
    success: true,
    tier: targetTier,
    tierName: TIER_NAMES[targetTier] ?? targetTier,
  });
}
