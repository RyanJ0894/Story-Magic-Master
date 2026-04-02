import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { userType: true } });
  return profile?.userType === 'admin' ? userId : null;
}

// GET /api/admin/impact — dashboard stats
export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [totalStories, pendingApproval, totalPartners, prizeEligible] = await Promise.all([
    prisma.impactStory.count(),
    prisma.impactStory.count({ where: { isPublic: true, isApproved: false } }),
    prisma.impactPartner.count({ where: { isActive: true } }),
    prisma.impactStory.count({ where: { prizeEligible: true, status: 'complete' } }),
  ]);

  const byCategory = await prisma.impactStory.groupBy({
    by: ['category'],
    _count: { id: true },
  });

  const byStatus = await prisma.impactStory.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  return NextResponse.json({
    totalStories,
    pendingApproval,
    totalPartners,
    prizeEligible,
    byCategory: Object.fromEntries(byCategory.map(r => [r.category, r._count.id])),
    byStatus: Object.fromEntries(byStatus.map(r => [r.status, r._count.id])),
  });
}
