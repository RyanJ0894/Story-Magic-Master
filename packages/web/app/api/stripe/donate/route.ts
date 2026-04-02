import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripeServer } from '@/lib/stripe/server';

const VALID_AMOUNTS = [500, 1500, 2500, 5000]; // cents: $5, $15, $25, $50

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  const body = await req.json();
  const amount: number = body.amount;

  if (!VALID_AMOUNTS.includes(amount)) {
    return NextResponse.json({ error: 'Invalid donation amount' }, { status: 400 });
  }

  const stripe = getStripeServer();
  const origin = req.headers.get('origin') || 'https://story-magic-web.onrender.com';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          product_data: {
            name: 'Story Magic Impact — Support a Story',
            description:
              'Your gift helps trauma survivors, recovery advocates, and housing-insecure voices create professional audio stories — completely free for them.',
            images: [],
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/impact/donate?success=true`,
    cancel_url: `${origin}/impact/donate`,
    metadata: {
      type: 'impact_donation',
      userId: userId ?? 'anonymous',
      amount_cents: String(amount),
    },
    payment_intent_data: {
      metadata: {
        type: 'impact_donation',
        userId: userId ?? 'anonymous',
      },
    },
  });

  return NextResponse.json({ url: session.url });
}
