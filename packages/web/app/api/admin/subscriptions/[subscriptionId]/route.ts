import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf';
import { logAuditEvent, extractRequestInfo, AuditActions, ResourceTypes } from '@/lib/api/audit';
import { log } from '@/lib/logger';

// =============================================================================
// Route Params
// =============================================================================

interface RouteParams {
  params: Promise<{ subscriptionId: string }>;
}

// =============================================================================
// Admin Auth Helper
// =============================================================================

async function verifyAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });

  if (profile?.userType !== 'admin') {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user: { id: userId }, error: null };
}

// =============================================================================
// GET /api/admin/subscriptions/[subscriptionId] - Get subscription details
// =============================================================================

export async function GET(request: Request, { params }: RouteParams) {
  const { subscriptionId } = await params;

  const { user, error: authError } = await verifyAdmin();
  if (authError) return authError;

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
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  return NextResponse.json({ data: subscription });
}

// =============================================================================
// POST /api/admin/subscriptions/[subscriptionId] - Cancel or Sync subscription
// =============================================================================

export async function POST(request: Request, { params }: RouteParams) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { subscriptionId } = await params;

  const { user, error: authError } = await verifyAdmin();
  if (authError || !user) return authError;

  // Determine action from the request URL path
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const action = pathSegments[pathSegments.length - 1];

  // Fetch existing subscription
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  if (action === 'cancel') {
    return handleCancel(subscription, subscriptionId, user, request);
  } else if (action === 'sync') {
    return handleSync(subscription, subscriptionId, user, request);
  }

  return NextResponse.json({ error: 'Invalid action. Use /cancel or /sync' }, { status: 400 });
}

// =============================================================================
// Cancel Subscription Handler
// =============================================================================

async function handleCancel(
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
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}

// =============================================================================
// Sync Subscription Handler
// =============================================================================

async function handleSync(
  subscription: Record<string, unknown>,
  subscriptionId: string,
  user: { id: string },
  request: Request,
) {
  try {
    // For now, update the timestamp to indicate a sync was attempted
    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {}, // updatedAt auto-updates via @updatedAt
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
        sync_attempted: true,
        target_user_id: subscription.userId,
        note: 'Stripe sync stub - actual Stripe API integration pending',
      },
      ...requestInfo,
    });

    return NextResponse.json({
      data: updated,
      message: 'Sync attempted (stub). Stripe integration pending.',
    });
  } catch (error) {
    log.error('Error syncing subscription', error);
    return NextResponse.json({ error: 'Failed to sync subscription' }, { status: 500 });
  }
}
