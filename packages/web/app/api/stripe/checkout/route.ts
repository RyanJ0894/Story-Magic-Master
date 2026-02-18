import { withAuth, parseBody } from '@/lib/api/middleware';
import { createCheckoutSession } from '@/lib/stripe/server';
import { STRIPE_CONFIG } from '@/lib/stripe/config';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';

const CheckoutRequestSchema = z.object({
  tier: z.enum(['creator', 'pro', 'studio']),
  interval: z.enum(['monthly', 'yearly']),
});

export const POST = withAuth(async (request, { userId, prisma }) => {
  try {
    const parsed = await parseBody(request, CheckoutRequestSchema);
    if ('error' in parsed) return parsed.error;
    const { tier, interval } = parsed.data;

    // Get the price ID
    const priceId =
      STRIPE_CONFIG.prices[tier as keyof typeof STRIPE_CONFIG.prices]?.[
        interval as 'monthly' | 'yearly'
      ];

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price not configured. Please contact support.' },
        { status: 500 }
      );
    }

    // Get user email from profile for Stripe
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    // Create checkout session
    const origin = request.headers.get('origin') || 'http://localhost:22000';

    const session = await createCheckoutSession({
      priceId,
      userId,
      userEmail: profile?.email || '',
      successUrl: `${origin}/billing?success=true`,
      cancelUrl: `${origin}/pricing?canceled=true`,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    log.error('Checkout error', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}, { rateLimit: 'strict' });
