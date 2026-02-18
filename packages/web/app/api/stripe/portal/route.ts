import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { createPortalSession } from '@/lib/stripe/server';
import { NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';
import { log } from '@/lib/logger';

export async function POST(request: Request) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }

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
}
