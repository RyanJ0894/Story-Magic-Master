/**
 * GET  /api/projects/[id]/human-review — check purchase status
 * POST /api/projects/[id]/human-review — create Stripe checkout session ($99)
 */

import { NextResponse } from 'next/server';
import { withProjectAuth } from '@/lib/api/middleware';
import { getStripeServer } from '@/lib/stripe/server';

const HUMAN_REVIEW_PRICE_CENTS = 9900; // $99.00

export const GET = withProjectAuth(async (_request, { prisma, projectId }) => {
  const purchase = await prisma.purchase.findFirst({
    where: { projectId, purchaseType: 'human_review', status: 'completed' },
    select: { id: true },
  });

  return NextResponse.json({
    purchased: !!purchase,
    price: HUMAN_REVIEW_PRICE_CENTS,
  });
});

export const POST = withProjectAuth(async (request, { userId, prisma, projectId }) => {
  const existing = await prisma.purchase.findFirst({
    where: { projectId, purchaseType: 'human_review', status: 'completed' },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ purchased: true, alreadyOwned: true });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
  const successUrl = `${origin}/projects/${projectId}?review=success`;
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
          unit_amount: HUMAN_REVIEW_PRICE_CENTS,
          product_data: {
            name: 'White-Glove Review — Story Magic',
            description:
              'A professional audio producer reviews your generated audio and approves or provides notes before delivery.',
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(profile?.email ? { customer_email: profile.email } : {}),
    metadata: {
      type: 'human_review',
      userId,
      projectId,
    },
  });

  return NextResponse.json({ url: session.url });
});
