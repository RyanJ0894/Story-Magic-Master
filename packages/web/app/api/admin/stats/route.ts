import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mapDbStatsToAdminStats } from '@/lib/api/mappers';

/**
 * GET /api/admin/stats
 * Get platform-wide statistics for admin dashboard
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  // Verify user is authenticated and is admin
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

  // Calculate date ranges
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all stats in parallel
  const [
    { count: totalUsers },
    { count: writerCount },
    { count: readerCount },
    { count: activeSubscriptionCount },
    { count: projectCount },
    { count: shareCount },
    { count: newUsersToday },
    { count: newUsersWeek },
    { count: newUsersMonth },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'writer'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'reader'),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }).in('status', ['active', 'trialing']),
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('script_shares').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', last7Days.toISOString()),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', last30Days.toISOString()),
  ]);

  // Calculate estimated MRR ($15 average)
  const mrrCents = (activeSubscriptionCount || 0) * 1500;

  const dbStats = {
    total_users: totalUsers || 0,
    writer_count: writerCount || 0,
    reader_count: readerCount || 0,
    active_subscription_count: activeSubscriptionCount || 0,
    project_count: projectCount || 0,
    share_count: shareCount || 0,
    mrr_cents: mrrCents,
    new_users_today: newUsersToday || 0,
    new_users_week: newUsersWeek || 0,
    new_users_month: newUsersMonth || 0,
  };

  const stats = mapDbStatsToAdminStats(dbStats);

  return NextResponse.json(stats);
}
