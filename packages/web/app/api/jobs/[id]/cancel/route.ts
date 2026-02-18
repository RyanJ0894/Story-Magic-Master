/**
 * Cancel Job API Route
 *
 * POST /api/jobs/[id]/cancel - Cancel a queued job
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cancelJob } from '@/lib/queue/service';
import { validateCsrf } from '@/lib/csrf';
import { log } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { id: jobId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

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

  if (job.status !== 'queued') {
    return NextResponse.json(
      {
        error: 'Only queued jobs can be cancelled',
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
}
