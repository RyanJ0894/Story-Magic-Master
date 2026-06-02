import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { log } from '@/lib/logger';

// Lazy initialization to avoid build-time errors when STRIPE_SECRET_KEY is not set
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key);
}

const CreatePaymentSchema = z.object({
  price: z.literal(5, { errorMap: () => ({ message: 'Price must be $5' }) }),
  scriptName: z.string().max(200).optional(),
});

// POST /api/reader/upload/create-payment - Create Stripe Checkout Session for upload
export const POST = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, CreatePaymentSchema);
  if ('error' in parsed) return parsed.error;
  const { price, scriptName } = parsed.data;

  try {
    const stripe = getStripe();
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';

    // Create purchase record first so we can pass its ID to Stripe metadata.
    // stripePaymentIntentId is filled in by the checkout.session.completed webhook
    // once payment succeeds — we don't have a pi_... ID at checkout creation time.
    const purchase = await prisma.purchase.create({
      data: {
        userId,
        purchaseType: 'upload',
        amountCents: price * 100,
        status: 'pending',
      },
    });

    // Create Stripe Checkout Session (hosted payment page)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: price * 100,
            product_data: {
              name: `Script Processing: ${scriptName || 'Upload'}`,
              description: 'Standard processing',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        type: 'reader_upload',
        purchaseId: purchase.id,
      },
      success_url: `${origin}/reader/upload/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/reader/upload`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    log.error('Error creating checkout session', error);
    return errorResponse('Failed to create payment', 500);
  }
});
