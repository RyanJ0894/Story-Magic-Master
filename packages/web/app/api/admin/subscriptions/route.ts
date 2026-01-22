import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { logAuditEvent, extractRequestInfo, AuditActions, ResourceTypes } from '@/lib/api/audit';

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
export async function GET(request: Request) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (profile?.user_type !== 'admin') {
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

  // Build query
  let query = supabase
    .from('subscriptions')
    .select(`
      id,
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      plan,
      status,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      created_at,
      updated_at,
      profiles(id, full_name, user_type)
    `, { count: 'exact' });

  // Apply filters
  if (status) {
    query = query.eq('status', status);
  }
  if (plan) {
    query = query.eq('plan', plan);
  }

  // Apply pagination and ordering
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: subscriptions, count, error } = await query;

  if (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }

  // Get summary stats
  const [
    { count: totalActive },
    { count: totalTrialing },
    { count: totalCanceled },
  ] = await Promise.all([
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'trialing'),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'canceled'),
  ]);

  return NextResponse.json({
    data: subscriptions,
    summary: {
      active: totalActive || 0,
      trialing: totalTrialing || 0,
      canceled: totalCanceled || 0,
    },
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      hasMore: page * limit < (count || 0),
    },
  });
}

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
export async function PATCH(request: Request) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (profile?.user_type !== 'admin') {
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
  const { data: subscription, error: fetchError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  if (fetchError || !subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  let updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let auditAction: string = AuditActions.ADMIN_SUBSCRIPTION_MODIFY;

  switch (action) {
    case 'cancel':
      updates = {
        ...updates,
        cancel_at_period_end: true,
      };
      auditAction = AuditActions.SUBSCRIPTION_CANCEL;
      break;

    case 'resume':
      updates = {
        ...updates,
        cancel_at_period_end: false,
      };
      auditAction = AuditActions.SUBSCRIPTION_RESUME;
      break;

    case 'update_plan':
      if (!plan) {
        return NextResponse.json({ error: 'Plan is required for update_plan action' }, { status: 400 });
      }
      updates = {
        ...updates,
        plan,
      };
      break;
  }

  // Perform update
  const { data: updatedSubscription, error: updateError } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', subscriptionId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating subscription:', updateError);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }

  // Log audit event
  const requestInfo = extractRequestInfo(request);
  await logAuditEvent({
    user_id: user.id,
    action: auditAction,
    resource_type: ResourceTypes.SUBSCRIPTION,
    resource_id: subscriptionId,
    details: {
      action,
      changes: updates,
      admin_email: user.email,
      target_user_id: subscription.user_id,
    },
    ...requestInfo,
  });

  return NextResponse.json(updatedSubscription);
}
