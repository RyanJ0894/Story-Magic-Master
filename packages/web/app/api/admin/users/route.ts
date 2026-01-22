import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { logAuditEvent, extractRequestInfo, AuditActions, ResourceTypes } from '@/lib/api/audit';

// Query params schema
const GetUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  type: z.enum(['writer', 'reader', 'admin']).optional(),
  sortBy: z.enum(['created_at', 'full_name', 'user_type']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /api/admin/users
 * List all users with filtering and pagination
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
  const parseResult = GetUsersQuerySchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    search: searchParams.get('search'),
    type: searchParams.get('type'),
    sortBy: searchParams.get('sortBy'),
    sortOrder: searchParams.get('sortOrder'),
  });

  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const { page, limit, search, type, sortBy, sortOrder } = parseResult.data;
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      user_type,
      writer_code,
      reader_code,
      created_at,
      updated_at,
      subscriptions(id, status, plan)
    `, { count: 'exact' });

  // Apply filters
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,writer_code.ilike.%${search}%,reader_code.ilike.%${search}%`);
  }
  if (type) {
    query = query.eq('user_type', type);
  }

  // Apply pagination and ordering
  query = query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  const { data: users, count, error } = await query;

  if (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  return NextResponse.json({
    data: users,
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      hasMore: page * limit < (count || 0),
    },
  });
}

// Update user schema
const UpdateUserSchema = z.object({
  user_type: z.enum(['writer', 'reader', 'admin']).optional(),
  full_name: z.string().max(100).optional(),
  suspended: z.boolean().optional(),
});

/**
 * PATCH /api/admin/users
 * Update a user's profile (for admin actions)
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

  const { userId, ...updateData } = body;

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  const parseResult = UpdateUserSchema.safeParse(updateData);
  if (!parseResult.success) {
    return NextResponse.json({
      error: 'Invalid request body',
      details: parseResult.error.format(),
    }, { status: 400 });
  }

  const updates = parseResult.data;

  // Perform update
  const { data: updatedUser, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user:', error);
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
    },
    ...requestInfo,
  });

  return NextResponse.json(updatedUser);
}
