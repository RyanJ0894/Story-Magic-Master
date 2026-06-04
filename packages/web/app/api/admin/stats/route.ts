import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/middleware';
import { mapDbStatsToAdminStats } from '@/lib/api/mappers';
import { Prisma } from '@story-magic/shared';

/**
 * GET /api/admin/stats
 * Get platform-wide statistics for admin dashboard.
 *
 * Optimised: fetches all counts in a single raw SQL round-trip instead of
 * 9 separate Prisma COUNT queries (TD-058).
 */
export const GET = withAdminAuth(async (request, { userId, prisma }) => {
  // Calculate date boundaries
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Single round-trip: all counts via one raw SQL query
  const rows = await prisma.$queryRaw<
    Array<{
      total_users: bigint;
      writer_count: bigint;
      reader_count: bigint;
      active_subscription_count: bigint;
      project_count: bigint;
      share_count: bigint;
      new_users_today: bigint;
      new_users_week: bigint;
      new_users_month: bigint;
    }>
  >(
    Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM profiles)::bigint                                                   AS total_users,
        (SELECT COUNT(*) FROM profiles WHERE user_type = 'writer')::bigint                        AS writer_count,
        (SELECT COUNT(*) FROM profiles WHERE user_type = 'reader')::bigint                        AS reader_count,
        (SELECT COUNT(*) FROM subscriptions WHERE status IN ('active','trialing'))::bigint         AS active_subscription_count,
        (SELECT COUNT(*) FROM projects)::bigint                                                   AS project_count,
        (SELECT COUNT(*) FROM script_shares)::bigint                                              AS share_count,
        (SELECT COUNT(*) FROM profiles WHERE created_at >= ${today})::bigint                      AS new_users_today,
        (SELECT COUNT(*) FROM profiles WHERE created_at >= ${last7Days})::bigint                  AS new_users_week,
        (SELECT COUNT(*) FROM profiles WHERE created_at >= ${last30Days})::bigint                 AS new_users_month
    `,
  );

  const r = rows[0];

  const totalUsers = Number(r.total_users);
  const activeSubscriptionCount = Number(r.active_subscription_count);

  // Calculate estimated MRR ($15 average)
  const mrrCents = (activeSubscriptionCount || 0) * 1500;

  const dbStats = {
    total_users: totalUsers || 0,
    writer_count: Number(r.writer_count) || 0,
    reader_count: Number(r.reader_count) || 0,
    active_subscription_count: activeSubscriptionCount || 0,
    project_count: Number(r.project_count) || 0,
    share_count: Number(r.share_count) || 0,
    mrr_cents: mrrCents,
    new_users_today: Number(r.new_users_today) || 0,
    new_users_week: Number(r.new_users_week) || 0,
    new_users_month: Number(r.new_users_month) || 0,
  };

  const stats = mapDbStatsToAdminStats(dbStats);

  return NextResponse.json(stats);
});
