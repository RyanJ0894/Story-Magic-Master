/**
 * GET  /api/projects/[id]/advanced-analysis — check purchase status
 * POST /api/projects/[id]/advanced-analysis — create Stripe checkout session
 *
 * SECURITY: model selection is NEVER influenced by client input.
 * This route only creates the checkout; model selection happens in the
 * orchestrator by looking up the Purchase record in the DB.
 */

import { NextResponse } from 'next/server';
import { withProjectAuth } from '@/lib/api/middleware';
import { getStripeServer } from '@/lib/stripe/server';

const ADVANCED_ANALYSIS_PRICE_CENTS = 999; // $9.99

// ---------------------------------------------------------------------------
// GET — returns { purchased: boolean, price: number }
// ---------------------------------------------------------------------------

export const GET = withProjectAuth(async (_request, { prisma, projectId }) => {
  const purchase = await prisma.purchase.findFirst({
    where: {
      projectId,
      purchaseType: 'advanced_analysis',
      status: 'completed',
    },
    select: { id: true },
  });

  return NextResponse.json({
    purchased: !!purchase,
    price: ADVANCED_ANALYSIS_PRICE_CENTS,
  });
});

// ---------------------------------------------------------------------------
// POST — creates a Stripe checkout session for the one-time $9.99 upgrade
// ---------------------------------------------------------------------------

export const POST = withProjectAuth(async (request, { userId, prisma, projectId }) => {
  // Guard: already purchased — idempotent
  const existing = await prisma.purchase.findFirst({
    where: {
      projectId,
      purchaseType: 'advanced_analysis',
      status: 'completed',
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ purchased: true, alreadyOwned: true });
  }

  // Look up the user's email for the Stripe checkout prefill
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  // Derive the project page URL for redirect
  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
  const successUrl = `${origin}/projects/${projectId}?advanced=success`;
  const cancelUrl = `${origin}/projects/${projectId}`;

  const stripe = getStripeServer();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: ADVANCED_ANALYSIS_PRICE_CENTS,
          product_data: {
            name: 'Advanced Analysis — Story Magic',
            description:
              'Deeper character insight, richer scene construction, and more nuanced voice matching — powered by Claude Opus.',
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(profile?.email ? { customer_email: profile.email } : {}),
    metadata: {
      type: 'advanced_analysis',
      userId,
      projectId,
    },
  });

  return NextResponse.json({ url: session.url });
});
