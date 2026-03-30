/**
 * Cancel Job API Route
 *
 * POST /api/jobs/[id]/cancel - Cancel a queued job
 */

import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { cancelJob } from '@/lib/queue/service';
import { log } from '@/lib/logger';

export const POST = withAuth(async (_request, { userId, prisma, params }) => {
  const jobId = params.id;

  // Verify user owns this job and it's cancellable
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, userId: true, status: true, projectId: true },
  });

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  if (job.userId !== userId) {
    return NextResponse.json(
      { error: 'Forbidden', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  if (job.status !== 'queued' && job.status !== 'processing') {
    return NextResponse.json(
      {
        error: 'Only queued or processing jobs can be cancelled',
        code: 'INVALID_STATUS',
        currentStatus: job.status,
      },
      { status: 400 }
    );
  }

  try {
    const cancelled = await cancelJob(jobId, userId);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Failed to cancel job', code: 'CANCEL_FAILED' },
        { status: 500 }
      );
    }

    // Reset project status to draft
    await prisma.project.update({
      where: { id: job.projectId },
      data: { status: 'draft' },
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job cancelled successfully',
    });
  } catch (error) {
    log.error('[Queue] Cancel error', error);
    return NextResponse.json(
      { error: 'Failed to cancel job', code: 'CANCEL_ERROR' },
      { status: 500 }
    );
  }
});
