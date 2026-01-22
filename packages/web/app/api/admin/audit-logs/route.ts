import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Query params schema
const GetAuditLogsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(30),
  action: z.string().optional(),
  resource: z.string().optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * GET /api/admin/audit-logs
 * List audit log entries with filtering and pagination
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
  const parseResult = GetAuditLogsQuerySchema.safeParse({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    action: searchParams.get('action'),
    resource: searchParams.get('resource'),
    userId: searchParams.get('userId'),
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
  });

  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const { page, limit, action, resource, userId, startDate, endDate } = parseResult.data;
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('audit_logs')
    .select(`
      id,
      user_id,
      action,
      resource_type,
      resource_id,
      details,
      ip_address,
      user_agent,
      created_at,
      profiles(full_name)
    `, { count: 'exact' });

  // Apply filters
  if (action) {
    query = query.ilike('action', `%${action}%`);
  }
  if (resource) {
    query = query.eq('resource_type', resource);
  }
  if (userId) {
    query = query.eq('user_id', userId);
  }
  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  // Apply pagination and ordering
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: logs, count, error } = await query;

  if (error) {
    // Check if table doesn't exist
    if (error.code === '42P01') {
      return NextResponse.json({
        error: 'Audit logs table not configured',
        message: 'Please run the audit_logs migration in Supabase',
      }, { status: 503 });
    }
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }

  return NextResponse.json({
    data: logs,
    pagination: {
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      hasMore: page * limit < (count || 0),
    },
  });
}
