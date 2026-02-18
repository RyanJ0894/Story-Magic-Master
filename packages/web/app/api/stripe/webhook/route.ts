import { constructWebhookEvent } from '@/lib/stripe/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { log } from '@/lib/logger';

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
      log.error('Webhook signature verification failed', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId && customerId && subscriptionId) {
          // Update user profile with Stripe customer ID and subscription
          await prisma.profile.update({
            where: { id: userId },
            data: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              subscriptionStatus: 'active',
            },
          });
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
        const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;

        if (userId) {
          await prisma.profile.update({
            where: { id: userId },
            data: {
              subscriptionTier: tier,
              subscriptionStatus: subscription.status,
              stripeSubscriptionId: subscription.id,
              currentPeriodEnd: periodEnd
                ? new Date(periodEnd * 1000)
                : null,
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (userId) {
          // Downgrade to free tier
          await prisma.profile.update({
            where: { id: userId },
            data: {
              subscriptionTier: 'free',
              subscriptionStatus: 'canceled',
              stripeSubscriptionId: null,
              currentPeriodEnd: null,
            },
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceData = invoice as unknown as {
          subscription?: string | { id: string };
          period_start?: number;
          period_end?: number;
        };
        const subscriptionId = typeof invoiceData.subscription === 'string'
          ? invoiceData.subscription
          : invoiceData.subscription?.id ?? null;

        if (subscriptionId) {
          // Update subscription status
          await prisma.profile.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { subscriptionStatus: 'active' },
          });

          // Reset usage for new billing period
          const profile = await prisma.profile.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
            select: { id: true },
          });

          if (profile) {
            // Create new usage record for the billing period
            const periodStart = invoiceData.period_start;
            const periodEnd = invoiceData.period_end;

            if (periodStart && periodEnd) {
              const period = new Date(periodStart * 1000).toISOString().slice(0, 7);
              await prisma.usage.upsert({
                where: { userId_period: { userId: profile.id, period } },
                create: {
                  userId: profile.id,
                  period,
                  pagesUsed: 0,
                },
                update: {
                  pagesUsed: 0,
                },
              });
            }
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceData = invoice as unknown as {
          subscription?: string | { id: string };
        };
        const subscriptionId = typeof invoiceData.subscription === 'string'
          ? invoiceData.subscription
          : invoiceData.subscription?.id ?? null;

        if (subscriptionId) {
          await prisma.profile.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { subscriptionStatus: 'past_due' },
          });
        }
        break;
      }

      default:
        // Unhandled event type
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error('Webhook error', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
