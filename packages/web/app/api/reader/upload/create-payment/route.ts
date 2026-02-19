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
  price: z.number().refine(val => val === 5 || val === 8, {
    message: 'Price must be $5 (standard) or $8 (OCR)',
  }),
  needsOCR: z.boolean(),
  scriptName: z.string().max(200).optional(),
});

// POST /api/reader/upload/create-payment - Create Stripe Checkout Session for upload
export const POST = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, CreatePaymentSchema);
  if ('error' in parsed) return parsed.error;
  const { price, needsOCR, scriptName } = parsed.data;

  // Validate price matches OCR selection
  const expectedPrice = needsOCR ? 8 : 5;
  if (price !== expectedPrice) {
    return errorResponse('Invalid price', 400, { code: 'INVALID_PRICE' });
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
    return errorResponse('Failed to create payment', 500);
  }
});
