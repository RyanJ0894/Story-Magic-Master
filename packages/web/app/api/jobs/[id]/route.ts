import { withAuth, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';

// Polling every 2s = 30 req/min — needs 'loose' (60/min), not default 'normal' (20/min)
export const GET = withAuth(async (_request, { userId, prisma, params }) => {
  const jobId = params.id;

  // Fetch job with project info
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          userId: true,
          status: true,
        },
      },
    },
  });

  if (!job) {
    return errorResponse('Job not found', 404, { code: 'NOT_FOUND' });
  }

  // Verify user owns this job
  if (job.project.userId !== userId) {
    return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
  }

  // Return job status with progress details
  const progress = job.progress as Record<string, unknown> | null;
  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: progress || { step: 'unknown', percent: 0 },
    error: job.error,
    started_at: job.startedAt,
    completed_at: job.completedAt,
    created_at: job.createdAt,
    project_id: job.projectId,
    project_status: job.project.status,
  });
}, { rateLimit: 'loose' });
