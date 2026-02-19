import { constructWebhookEvent } from '@/lib/stripe/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { log } from '@/lib/logger';
import { errorResponse } from '@/lib/api/error-response';

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

// Generation and download limits per tier
const TIER_LIMITS: Record<string, { generations: number; downloads: number }> = {
  free:    { generations: 1,  downloads: 0 },
  creator: { generations: 5,  downloads: 1 },
  pro:     { generations: 20, downloads: 5 },
  studio:  { generations: 100, downloads: 50 },
};

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return errorResponse('Missing stripe-signature header', 400, { code: 'MISSING_SIGNATURE' });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(body, signature);
    } catch (error) {
      log.error('Webhook signature verification failed', error);
      return errorResponse('Invalid signature', 400, { code: 'INVALID_SIGNATURE' });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId && customerId && subscriptionId) {
          // Update both Profile and Subscription in parallel
          await Promise.all([
            prisma.profile.update({
              where: { id: userId },
              data: {
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                subscriptionStatus: 'active',
              },
            }),
            prisma.subscription.upsert({
              where: { stripeSubscriptionId: subscriptionId },
              create: {
                userId,
                plan: 'free', // Updated on subscription.created/updated event
                status: 'active',
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
              },
              update: {
                status: 'active',
                stripeCustomerId: customerId,
              },
            }),
          ]);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        const priceId = subscription.items.data[0]?.price.id;
        const tier = getTierFromPriceId(priceId);

        const firstItem = subscription.items.data[0];
        const periodStart = firstItem?.current_period_start;
        const periodEnd = firstItem?.current_period_end;
        const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

        if (userId) {
          await Promise.all([
            prisma.profile.update({
              where: { id: userId },
              data: {
                subscriptionTier: tier,
                subscriptionStatus: subscription.status,
                stripeSubscriptionId: subscription.id,
                currentPeriodEnd: periodEnd
                  ? new Date(periodEnd * 1000)
                  : null,
              },
            }),
            prisma.subscription.upsert({
              where: { stripeSubscriptionId: subscription.id },
              create: {
                userId,
                plan: tier,
                status: subscription.status,
                stripeCustomerId: subscription.customer as string,
                stripeSubscriptionId: subscription.id,
                stripePriceId: priceId,
                currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
                currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
                cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
                generationsLimit: limits.generations,
                downloadsLimit: limits.downloads,
              },
              update: {
                plan: tier,
                status: subscription.status,
                stripePriceId: priceId,
                currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
                currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
                cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
                generationsLimit: limits.generations,
                downloadsLimit: limits.downloads,
              },
            }),
          ]);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (userId) {
          // Downgrade to free tier on both models
          const updates: Promise<unknown>[] = [
            prisma.profile.update({
              where: { id: userId },
              data: {
                subscriptionTier: 'free',
                subscriptionStatus: 'canceled',
                stripeSubscriptionId: null,
                currentPeriodEnd: null,
              },
            }),
          ];
          if (subscription.id) {
            updates.push(
              prisma.subscription.updateMany({
                where: { stripeSubscriptionId: subscription.id },
                data: {
                  status: 'canceled',
                  cancelAtPeriodEnd: false,
                },
              }),
            );
          }
          await Promise.all(updates);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = subRef
          ? (typeof subRef === 'string' ? subRef : subRef.id)
          : null;

        if (subscriptionId) {
          // Update subscription status on both models
          await Promise.all([
            prisma.profile.updateMany({
              where: { stripeSubscriptionId: subscriptionId },
              data: { subscriptionStatus: 'active' },
            }),
            prisma.subscription.updateMany({
              where: { stripeSubscriptionId: subscriptionId },
              data: { status: 'active', generationsUsed: 0, downloadsUsed: 0 },
            }),
          ]);

          // Reset usage for new billing period
          const profile = await prisma.profile.findFirst({
            where: { stripeSubscriptionId: subscriptionId },
            select: { id: true },
          });

          if (profile) {
            // Create new usage record for the billing period
            const periodStart = invoice.period_start;
            const periodEnd = invoice.period_end;

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
        const failedSubRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = failedSubRef
          ? (typeof failedSubRef === 'string' ? failedSubRef : failedSubRef.id)
          : null;

        if (subscriptionId) {
          await Promise.all([
            prisma.profile.updateMany({
              where: { stripeSubscriptionId: subscriptionId },
              data: { subscriptionStatus: 'past_due' },
            }),
            prisma.subscription.updateMany({
              where: { stripeSubscriptionId: subscriptionId },
              data: { status: 'past_due' },
            }),
          ]);
        }
        break;
      }

      default:
        // Unhandled event type
        log.info(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error('Webhook error', error);
    return errorResponse('Webhook handler failed', 500);
  }
}
