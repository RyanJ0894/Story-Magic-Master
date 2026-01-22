import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Lazy initialization to avoid build-time errors when STRIPE_SECRET_KEY is not set
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key);
}

// POST /api/reader/upload/create-payment - Create payment intent for upload
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { price, needsOCR } = body;

  // Validate price
  const expectedPrice = needsOCR ? 8 : 5;
  if (price !== expectedPrice) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }

  try {
    const stripe = getStripe();

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price * 100, // Convert to cents
      currency: 'usd',
      metadata: {
        user_id: user.id,
        type: 'reader_upload',
        needs_ocr: String(needsOCR),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Record purchase intent
    await supabase
      .from('purchases')
      .insert({
        user_id: user.id,
        purchase_type: needsOCR ? 'upload_ocr' : 'upload',
        amount_cents: price * 100,
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending',
      });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
