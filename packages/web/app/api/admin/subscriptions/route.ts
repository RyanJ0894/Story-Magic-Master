import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logAuditEvent, extractRequestInfo, AuditActions, ResourceTypes } from '@/lib/api/audit';
import { log } from '@/lib/logger';

// Query params schema
const GetSubscriptionsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['active', 'trialing', 'canceled', 'past_due', 'incomplete']).optional(),
  plan: z.string().optional(),
});

/**
 * GET /api/admin/subscriptions
 * List all subscriptions with filtering and pagination
 */
export const GET = withAuth(async (request, { userId, prisma }) => {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });

  if (profile?.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const parseResult = GetSubscriptionsQuerySchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    status: searchParams.get('status'),
    plan: searchParams.get('plan'),
  });

  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const { page, limit, status, plan } = parseResult.data;
  const offset = (page - 1) * limit;

  // Build where clause
  const where: Prisma.SubscriptionWhereInput = {};
  if (status) {
    where.status = status;
  }
  if (plan) {
    where.plan = plan;
  }

  try {
    const [subscriptions, count, totalActive, totalTrialing, totalCanceled] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, userType: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.subscription.count({ where }),
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.subscription.count({ where: { status: 'trialing' } }),
      prisma.subscription.count({ where: { status: 'canceled' } }),
    ]);

    return NextResponse.json({
      data: subscriptions,
      summary: {
        active: totalActive,
        trialing: totalTrialing,
        canceled: totalCanceled,
      },
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
        hasMore: page * limit < count,
      },
    });
  } catch (error) {
    log.error('Error fetching subscriptions', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }
});

// Update subscription schema
const UpdateSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  action: z.enum(['cancel', 'resume', 'update_plan']),
  plan: z.string().optional(),
});

/**
 * PATCH /api/admin/subscriptions
 * Perform admin actions on subscriptions
 */
export const PATCH = withAuth(async (request, { userId, prisma }) => {
  const adminProfile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });

  if (adminProfile?.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = UpdateSubscriptionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({
      error: 'Invalid request body',
      details: parseResult.error.format(),
    }, { status: 400 });
  }

  const { subscriptionId, action, plan } = parseResult.data;

  // Get current subscription
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  let updates: Prisma.SubscriptionUpdateInput = {};
  let auditAction: string = AuditActions.ADMIN_SUBSCRIPTION_MODIFY;

  switch (action) {
    case 'cancel':
      updates = { cancelAtPeriodEnd: true };
      auditAction = AuditActions.SUBSCRIPTION_CANCEL;
      break;

    case 'resume':
      updates = { cancelAtPeriodEnd: false };
      auditAction = AuditActions.SUBSCRIPTION_RESUME;
      break;

    case 'update_plan':
      if (!plan) {
        return NextResponse.json({ error: 'Plan is required for update_plan action' }, { status: 400 });
      }
      updates = { plan };
      break;
  }

  try {
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: updates,
    });

    // Log audit event
    const requestInfo = extractRequestInfo(request);
    await logAuditEvent({
      user_id: userId,
      action: auditAction,
      resource_type: ResourceTypes.SUBSCRIPTION,
      resource_id: subscriptionId,
      details: {
        action,
        changes: updates,
        target_user_id: subscription.userId,
      },
      ...requestInfo,
    });

    return NextResponse.json(updatedSubscription);
  } catch (error) {
    log.error('Error updating subscription', error);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
});
