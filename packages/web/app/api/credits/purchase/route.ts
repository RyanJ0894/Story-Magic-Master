/**
 * POST /api/credits/purchase
 *
 * Creates a Stripe Checkout session for a 20-credit pack at $9.99 (one-time).
 * On success the Stripe webhook (checkout.session.completed, type=credit_purchase)
 * credits 20 to Profile.credits and records a CreditTransaction.
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { getStripeServer } from '@/lib/stripe/server';

const CREDIT_PACK_PRICE_CENTS = 999;  // $9.99
const CREDIT_PACK_AMOUNT = 20;

export const POST = withAuth(async (request, { userId, prisma }) => {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
  const successUrl = `${origin}/account/credits?purchase=success`;
  const cancelUrl = `${origin}/account/credits`;

  const stripe = getStripeServer();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: CREDIT_PACK_PRICE_CENTS,
          product_data: {
            name: '20 Scene Credits — Story Magic',
            description: 'Generate up to 20 scenes of audio. Credits never expire.',
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(profile?.email ? { customer_email: profile.email } : {}),
    metadata: {
      type: 'credit_purchase',
      userId,
      credits: String(CREDIT_PACK_AMOUNT),
    },
  });

  return NextResponse.json({ url: session.url });
}, { rateLimit: 'strict' });
