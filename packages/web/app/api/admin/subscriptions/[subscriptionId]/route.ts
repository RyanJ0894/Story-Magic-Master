import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCsrf } from '@/lib/csrf';
import { logAuditEvent, extractRequestInfo, AuditActions, ResourceTypes } from '@/lib/api/audit';

// =============================================================================
// Route Params
// =============================================================================

interface RouteParams {
  params: Promise<{ subscriptionId: string }>;
}

// =============================================================================
// Admin Auth Helper
// =============================================================================

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (profile?.user_type !== 'admin') {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user, error: null };
}

// =============================================================================
// GET /api/admin/subscriptions/[subscriptionId] - Get subscription details
// =============================================================================

export async function GET(request: Request, { params }: RouteParams) {
  const { subscriptionId } = await params;
  const supabase = await createClient();

  const { user, error: authError } = await verifyAdmin(supabase);
  if (authError) return authError;

  // Fetch subscription with related profile
  const { data: subscription, error } = await supabase
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
      profiles(id, full_name, user_type, writer_code, reader_code)
    `)
    .eq('id', subscriptionId)
    .single();

  if (error || !subscription) {
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
  const supabase = await createClient();

  const { user, error: authError } = await verifyAdmin(supabase);
  if (authError || !user) return authError;

  // Determine action from the request URL path
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const action = pathSegments[pathSegments.length - 1];

  // Fetch existing subscription
  const { data: subscription, error: fetchError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  if (fetchError || !subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  if (action === 'cancel') {
    return handleCancel(supabase, subscription, subscriptionId, user, request);
  } else if (action === 'sync') {
    return handleSync(supabase, subscription, subscriptionId, user, request);
  }

  return NextResponse.json({ error: 'Invalid action. Use /cancel or /sync' }, { status: 400 });
}

// =============================================================================
// Cancel Subscription Handler
// =============================================================================

async function handleCancel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subscription: Record<string, unknown>,
  subscriptionId: string,
  user: { id: string; email?: string },
  request: Request,
) {
  // TODO: Integrate with Stripe API to cancel the subscription on Stripe's end.
  // When implementing, call stripe.subscriptions.update(subscription.stripe_subscription_id,
  //   { cancel_at_period_end: true }) to gracefully cancel at period end,
  // or stripe.subscriptions.cancel() for immediate cancellation.

  const { data: updated, error: updateError } = await supabase
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .select()
    .single();

  if (updateError) {
    console.error('Error canceling subscription:', updateError);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }

  // Log audit event
  const requestInfo = extractRequestInfo(request);
  await logAuditEvent({
    user_id: user.id,
    action: AuditActions.SUBSCRIPTION_CANCEL,
    resource_type: ResourceTypes.SUBSCRIPTION,
    resource_id: subscriptionId,
    details: {
      admin_action: true,
      admin_email: user.email,
      target_user_id: subscription.user_id,
      previous_status: subscription.status,
    },
    ...requestInfo,
  });

  return NextResponse.json({
    data: updated,
    message: 'Subscription canceled (database updated). Stripe integration pending.',
  });
}

// =============================================================================
// Sync Subscription Handler
// =============================================================================

async function handleSync(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subscription: Record<string, unknown>,
  subscriptionId: string,
  user: { id: string; email?: string },
  request: Request,
) {
  // TODO: Integrate with Stripe API to fetch the latest subscription state.
  // When implementing:
  //   1. Call stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
  //   2. Map Stripe status to local status
  //   3. Update current_period_start, current_period_end, cancel_at_period_end, plan, status
  //   4. Handle cases where the Stripe subscription no longer exists

  // For now, update the timestamp to indicate a sync was attempted
  const { data: updated, error: updateError } = await supabase
    .from('subscriptions')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .select()
    .single();

  if (updateError) {
    console.error('Error syncing subscription:', updateError);
    return NextResponse.json({ error: 'Failed to sync subscription' }, { status: 500 });
  }

  // Log audit event
  const requestInfo = extractRequestInfo(request);
  await logAuditEvent({
    user_id: user.id,
    action: AuditActions.ADMIN_SUBSCRIPTION_MODIFY,
    resource_type: ResourceTypes.SUBSCRIPTION,
    resource_id: subscriptionId,
    details: {
      admin_action: true,
      admin_email: user.email,
      sync_attempted: true,
      target_user_id: subscription.user_id,
      note: 'Stripe sync stub - actual Stripe API integration pending',
    },
    ...requestInfo,
  });

  return NextResponse.json({
    data: updated,
    message: 'Sync attempted (stub). Stripe integration pending.',
  });
}
