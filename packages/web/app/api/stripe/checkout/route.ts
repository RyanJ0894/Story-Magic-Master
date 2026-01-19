import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe/server';
import { STRIPE_CONFIG } from '@/lib/stripe/config';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tier, interval } = await request.json();

    // Validate tier and interval
    if (!['creator', 'pro', 'studio'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    if (!['monthly', 'yearly'].includes(interval)) {
      return NextResponse.json({ error: 'Invalid interval' }, { status: 400 });
    }

    // Get the price ID
    const priceId =
      STRIPE_CONFIG.prices[tier as keyof typeof STRIPE_CONFIG.prices]?.[
        interval as 'monthly' | 'yearly'
      ];

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price not configured. Please contact support.' },
        { status: 500 }
      );
    }

    // Create checkout session
    const origin = request.headers.get('origin') || 'http://localhost:22000';

    const session = await createCheckoutSession({
      priceId,
      userId: user.id,
      userEmail: user.email || '',
      successUrl: `${origin}/billing?success=true`,
      cancelUrl: `${origin}/pricing?canceled=true`,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
