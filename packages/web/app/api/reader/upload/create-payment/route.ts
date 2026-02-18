import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { log } from '@/lib/logger';

// Lazy initialization to avoid build-time errors when STRIPE_SECRET_KEY is not set
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key);
}

// POST /api/reader/upload/create-payment - Create Stripe Checkout Session for upload
export const POST = withAuth(async (request, { userId, prisma }) => {
  const body = await request.json();
  const { price, needsOCR, scriptName } = body;

  // Validate price
  const expectedPrice = needsOCR ? 8 : 5;
  if (price !== expectedPrice) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';

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
              description: needsOCR ? 'OCR + standard processing' : 'Standard processing',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        type: 'reader_upload',
        needsOCR: String(needsOCR),
      },
      success_url: `${origin}/reader/upload/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/reader/upload`,
    });

    // Record purchase intent
    await prisma.purchase.create({
      data: {
        userId,
        purchaseType: needsOCR ? 'upload_ocr' : 'upload',
        amountCents: price * 100,
        stripePaymentIntentId: session.id,
        status: 'pending',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    log.error('Error creating checkout session', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
});
