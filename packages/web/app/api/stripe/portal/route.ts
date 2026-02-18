import { withAuth } from '@/lib/api/middleware';
import { createPortalSession } from '@/lib/stripe/server';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

export const POST = withAuth(async (request, { userId, prisma }) => {
  try {
    // Get user's Stripe customer ID
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!profile?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 400 }
      );
    }

    // Create portal session
    const origin = request.headers.get('origin') || 'http://localhost:22000';

    const session = await createPortalSession({
      customerId: profile.stripeCustomerId,
      returnUrl: `${origin}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    log.error('Portal error', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
});
