import { NextResponse } from 'next/server';
import { withAdminAuth, errorResponse } from '@/lib/api/middleware';
import { logAuditEvent, extractRequestInfo, AuditActions, ResourceTypes } from '@/lib/api/audit';
import { log } from '@/lib/logger';
import { getSubscription } from '@/lib/stripe/server';

// =============================================================================
// GET /api/admin/subscriptions/[subscriptionId] - Get subscription details
// =============================================================================

export const GET = withAdminAuth(async (request, { userId, prisma, params }) => {
  const { subscriptionId } = params;

  // Fetch subscription with related profile
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          userType: true,
          writerCode: true,
          readerCode: true,
        },
      },
    },
  });

  if (!subscription) {
    return errorResponse('Subscription not found', 404, { code: 'NOT_FOUND' });
  }

  return NextResponse.json({ data: subscription });
});

// =============================================================================
// POST /api/admin/subscriptions/[subscriptionId] - Cancel or Sync subscription
// =============================================================================

export const POST = withAdminAuth(async (request, { userId, prisma, params }) => {
  const { subscriptionId } = params;

  // Determine action from the request URL path
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const action = pathSegments[pathSegments.length - 1];

  // Fetch existing subscription
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return errorResponse('Subscription not found', 404, { code: 'NOT_FOUND' });
  }

  if (action === 'cancel') {
    return handleCancel(prisma, subscription, subscriptionId, { id: userId }, request);
  } else if (action === 'sync') {
    return handleSync(prisma, subscription, subscriptionId, { id: userId }, request);
  }

  return errorResponse('Invalid action. Use /cancel or /sync', 400, { code: 'INVALID_ACTION' });
}, { rateLimit: 'strict' });

// =============================================================================
// Cancel Subscription Handler
// =============================================================================

async function handleCancel(
  prisma: import('@story-magic/shared').PrismaClient,
  subscription: Record<string, unknown>,
  subscriptionId: string,
  user: { id: string },
  request: Request,
) {
  try {
    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancelAtPeriodEnd: true,
        status: 'canceled',
      },
    });

    // Log audit event
    const requestInfo = extractRequestInfo(request);
    await logAuditEvent({
      user_id: user.id,
      action: AuditActions.SUBSCRIPTION_CANCEL,
      resource_type: ResourceTypes.SUBSCRIPTION,
      resource_id: subscriptionId,
      details: {
        admin_action: true,
        target_user_id: subscription.userId,
        previous_status: subscription.status,
      },
      ...requestInfo,
    });

    return NextResponse.json({
      data: updated,
      message: 'Subscription canceled (database updated). Stripe integration pending.',
    });
  } catch (error) {
    log.error('Error canceling subscription', error);
    return errorResponse('Failed to cancel subscription', 500);
  }
}

// =============================================================================
// Sync Subscription Handler
// =============================================================================

async function handleSync(
  prisma: import('@story-magic/shared').PrismaClient,
  subscription: Record<string, unknown>,
  subscriptionId: string,
  user: { id: string },
  request: Request,
) {
  try {
    const stripeSubscriptionId = subscription.stripeSubscriptionId as string | null;

    if (!stripeSubscriptionId) {
      return errorResponse('No Stripe subscription ID linked to this subscription', 400, { code: 'MISSING_STRIPE_ID' });
    }

    // Fetch the current subscription state from Stripe
    const stripeSubscription = await getSubscription(stripeSubscriptionId);

    if (!stripeSubscription) {
      return errorResponse('Subscription not found in Stripe', 404, { code: 'STRIPE_NOT_FOUND' });
    }

    // Map Stripe subscription data to local database fields
    const firstItem = stripeSubscription.items?.data?.[0];
    const syncData: Record<string, unknown> = {
      status: stripeSubscription.status,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      currentPeriodStart: firstItem?.current_period_start
        ? new Date(firstItem.current_period_start * 1000)
        : undefined,
      currentPeriodEnd: firstItem?.current_period_end
        ? new Date(firstItem.current_period_end * 1000)
        : undefined,
    };

    // Sync plan from the first subscription item's price if available
    if (firstItem?.price?.id) {
      syncData.stripePriceId = firstItem.price.id;
    }
    if (firstItem?.price?.lookup_key) {
      syncData.plan = firstItem.price.lookup_key;
    }

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: syncData,
    });

    // Log audit event
    const requestInfo = extractRequestInfo(request);
    await logAuditEvent({
      user_id: user.id,
      action: AuditActions.ADMIN_SUBSCRIPTION_MODIFY,
      resource_type: ResourceTypes.SUBSCRIPTION,
      resource_id: subscriptionId,
      details: {
        admin_action: true,
        sync_completed: true,
        target_user_id: subscription.userId,
        stripe_status: stripeSubscription.status,
        synced_fields: Object.keys(syncData),
      },
      ...requestInfo,
    });

    return NextResponse.json({
      data: updated,
      message: 'Subscription synced from Stripe successfully.',
    });
  } catch (error) {
    log.error('Error syncing subscription from Stripe', error);
    return errorResponse('Failed to sync subscription from Stripe', 500);
  }
}
