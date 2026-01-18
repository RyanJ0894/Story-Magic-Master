import { constructWebhookEvent } from '@/lib/stripe/server';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

// Use service role client for webhook handling
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(url, serviceKey);
}

// Map Stripe price IDs to subscription tiers
function getTierFromPriceId(priceId: string): string {
  const priceToTier: Record<string, string> = {
    [process.env.STRIPE_PRICE_CREATOR_MONTHLY || '']: 'creator',
    [process.env.STRIPE_PRICE_CREATOR_YEARLY || '']: 'creator',
    [process.env.STRIPE_PRICE_PRO_MONTHLY || '']: 'pro',
    [process.env.STRIPE_PRICE_PRO_YEARLY || '']: 'pro',
    [process.env.STRIPE_PRICE_STUDIO_MONTHLY || '']: 'studio',
    [process.env.STRIPE_PRICE_STUDIO_YEARLY || '']: 'studio',
  };

  return priceToTier[priceId] || 'free';
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(body, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId && customerId && subscriptionId) {
          // Update user profile with Stripe customer ID and subscription
          await supabase
            .from('profiles')
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_status: 'active',
            })
            .eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        const priceId = subscription.items.data[0]?.price.id;
        const tier = getTierFromPriceId(priceId);

        // Access current_period_end from the subscription object
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const periodEnd = (subscription as any).current_period_end;

        if (userId) {
          await supabase
            .from('profiles')
            .update({
              subscription_tier: tier,
              subscription_status: subscription.status,
              stripe_subscription_id: subscription.id,
              current_period_end: periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : null,
            })
            .eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (userId) {
          // Downgrade to free tier
          await supabase
            .from('profiles')
            .update({
              subscription_tier: 'free',
              subscription_status: 'canceled',
              stripe_subscription_id: null,
              current_period_end: null,
            })
            .eq('id', userId);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscriptionId = (invoice as any).subscription as string | null;

        if (subscriptionId) {
          // Update subscription status
          await supabase
            .from('profiles')
            .update({
              subscription_status: 'active',
            })
            .eq('stripe_subscription_id', subscriptionId);

          // Reset usage for new billing period
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_subscription_id', subscriptionId)
            .single();

          if (profile) {
            // Create new usage record for the billing period
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const periodStart = (invoice as any).period_start;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const periodEnd = (invoice as any).period_end;

            if (periodStart && periodEnd) {
              await supabase.from('usage').upsert({
                user_id: profile.id,
                billing_period_start: new Date(periodStart * 1000).toISOString(),
                billing_period_end: new Date(periodEnd * 1000).toISOString(),
                pages_used: 0,
              });
            }
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscriptionId = (invoice as any).subscription as string | null;

        if (subscriptionId) {
          await supabase
            .from('profiles')
            .update({
              subscription_status: 'past_due',
            })
            .eq('stripe_subscription_id', subscriptionId);
        }
        break;
      }

      default:
        // Unhandled event type
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
