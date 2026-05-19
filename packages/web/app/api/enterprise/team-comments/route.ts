import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const skip = parseInt(searchParams.get('skip') ?? '0', 10);
  const take = 20;

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const team = await prisma.team.findFirst({
    where: { ownerId: userId },
    select: {
      teamShares: { select: { project: { select: { id: true } } } },
    },
  });

  if (!team) return NextResponse.json({ comments: [], hasMore: false });

  const projectIds = team.teamShares.map((s) => s.project.id);
  if (projectIds.length === 0) return NextResponse.json({ comments: [], hasMore: false });

  const [comments, total] = await Promise.all([
    prisma.projectComment.findMany({
      where: { projectId: { in: projectIds } },
      include: {
        author: { select: { fullName: true, email: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.projectComment.count({ where: { projectId: { in: projectIds } } }),
  ]);

  return NextResponse.json({ comments, hasMore: skip + take < total, total });
}
