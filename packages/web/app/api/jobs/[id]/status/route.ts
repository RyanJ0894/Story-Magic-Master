import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';

/**
 * GET /api/jobs/[id]/status
 * Lightweight status endpoint for polling (used by reader upload client)
 */
export const GET = withAuth(async (_request, { userId, prisma, params }) => {
  const jobId = params.id;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      progress: true,
      error: true,
      project: { select: { userId: true } },
    },
  });

  if (!job || job.project.userId !== userId) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const progress = job.progress as Record<string, unknown> | null;

  return NextResponse.json({
    status: job.status,
    progress: progress?.percent ?? 0,
    message: progress?.details ?? job.error ?? '',
    step: progress?.step ?? 'unknown',
  });
});
