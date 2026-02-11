import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

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
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Verify user owns this job
  if (job.project.userId !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
}
