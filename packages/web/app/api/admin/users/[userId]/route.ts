import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';
import { logAuditEvent, extractRequestInfo, AuditActions, ResourceTypes } from '@/lib/api/audit';

// =============================================================================
// Input Validation
// =============================================================================

const UpdateUserSchema = z.object({
  user_type: z.enum(['writer', 'reader', 'admin']).optional(),
  suspended: z.boolean().optional(),
});

// =============================================================================
// Route Params
// =============================================================================

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// =============================================================================
// GET /api/admin/users/[userId] - Get user details
// =============================================================================

export async function GET(request: Request, { params }: RouteParams) {
  const { userId } = await params;
  const supabase = await createClient();

  // Verify authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify admin
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (adminProfile?.user_type !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch user profile with related data
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      user_type,
      writer_code,
      reader_code,
      created_at,
      updated_at,
      suspended,
      subscriptions(id, status, plan, current_period_start, current_period_end, cancel_at_period_end)
    `)
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Fetch project count for this user
  const { count: projectCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return NextResponse.json({
    data: {
      ...profile,
      project_count: projectCount || 0,
    },
  });
}

// =============================================================================
// PATCH /api/admin/users/[userId] - Update user (role, suspend, etc.)
// =============================================================================

export async function PATCH(request: Request, { params }: RouteParams) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { userId } = await params;
  const supabase = await createClient();

  // Verify authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify admin
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (adminProfile?.user_type !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = UpdateUserSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({
      error: 'Invalid request body',
      details: parseResult.error.format(),
    }, { status: 400 });
  }

  const updates = parseResult.data;

  // Verify target user exists
  const { data: existingUser, error: fetchError } = await supabase
    .from('profiles')
    .select('id, user_type')
    .eq('id', userId)
    .single();

  if (fetchError || !existingUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent admin from demoting themselves
  if (userId === user.id && updates.user_type && updates.user_type !== 'admin') {
    return NextResponse.json({ error: 'Cannot change your own admin role' }, { status: 400 });
  }

  // Perform update
  const { data: updatedUser, error: updateError } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating user:', updateError);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }

  // Log audit event
  const requestInfo = extractRequestInfo(request);
  await logAuditEvent({
    user_id: user.id,
    action: updates.suspended ? AuditActions.ADMIN_USER_SUSPEND : AuditActions.ADMIN_USER_UPDATE,
    resource_type: ResourceTypes.USER,
    resource_id: userId,
    details: {
      changes: updates,
      admin_email: user.email,
      previous_user_type: existingUser.user_type,
    },
    ...requestInfo,
  });

  return NextResponse.json({ data: updatedUser });
}
