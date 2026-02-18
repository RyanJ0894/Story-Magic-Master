import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { mapDbStatsToAdminStats } from '@/lib/api/mappers';

/**
 * GET /api/admin/stats
 * Get platform-wide statistics for admin dashboard
 */
export const GET = withAuth(async (request, { userId, prisma }) => {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });

  if (profile?.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Calculate date ranges
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all stats in parallel
  const [
    totalUsers,
    writerCount,
    readerCount,
    activeSubscriptionCount,
    projectCount,
    shareCount,
    newUsersToday,
    newUsersWeek,
    newUsersMonth,
  ] = await Promise.all([
    prisma.profile.count(),
    prisma.profile.count({ where: { userType: 'writer' } }),
    prisma.profile.count({ where: { userType: 'reader' } }),
    prisma.subscription.count({ where: { status: { in: ['active', 'trialing'] } } }),
    prisma.project.count(),
    prisma.scriptShare.count(),
    prisma.profile.count({ where: { createdAt: { gte: today } } }),
    prisma.profile.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.profile.count({ where: { createdAt: { gte: last30Days } } }),
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
});
