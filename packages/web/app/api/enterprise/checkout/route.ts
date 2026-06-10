import { NextResponse } from 'next/server';
import { withAuth, errorResponse } from '@/lib/api/middleware';
import { createCheckoutSession } from '@/lib/stripe/server';
import { log } from '@/lib/logger';

/**
 * POST /api/enterprise/checkout
 * Creates a Stripe Checkout session for enterprise subscription self-serve signup.
 * On payment success the Stripe webhook (customer.subscription.created/updated)
 * sets subscriptionTier = 'enterprise' automatically via getTierFromPriceId.
 */
export const POST = withAuth(async (request, { userId, prisma }) => {
  const priceId = process.env.STRIPE_ENTERPRISE_PRICE_ID;
  if (!priceId) {
    return errorResponse('Enterprise plan not configured', 500, { code: 'CONFIG_ERROR' });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { email: true, subscriptionTier: true },
  });

  if (profile?.subscriptionTier === 'enterprise') {
    return errorResponse('Already on enterprise plan', 400, { code: 'ALREADY_ENTERPRISE' });
  }

  const origin = request.headers.get('origin') || 'https://storymagicapp.net';

  try {
    const session = await createCheckoutSession({
      priceId,
      userId,
      userEmail: profile?.email || '',
      successUrl: `${origin}/enterprise/dashboard?upgraded=true`,
      cancelUrl: `${origin}/enterprise/contact?canceled=true`,
    });

    log.info('[Enterprise] checkout session created', { userId, sessionId: session.id });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    log.error('[Enterprise] checkout session creation failed', error);
    return errorResponse('Failed to create checkout session', 500);
  }
}, { rateLimit: 'strict' });
