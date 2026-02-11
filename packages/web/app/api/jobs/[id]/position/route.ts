/**
 * Job Queue Position API Route
 *
 * GET /api/jobs/[id]/position - Get job's position in queue
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getQueuePosition } from '@/lib/queue/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // Verify user owns this job
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, userId: true, status: true },
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

  // If job is not queued, return null position
  if (job.status !== 'queued') {
    return NextResponse.json({
      jobId,
      status: job.status,
      position: null,
      estimatedWaitSeconds: null,
      jobsAhead: null,
    });
  }

  try {
    const position = await getQueuePosition(jobId);

    return NextResponse.json({
      jobId,
      status: job.status,
      position: position?.position ?? null,
      estimatedWaitSeconds: position?.estimatedWaitSeconds ?? null,
      jobsAhead: position?.jobsAhead ?? null,
    });
  } catch (error) {
    console.error('[Queue] Position error:', error);
    return NextResponse.json(
      { error: 'Failed to get queue position', code: 'QUEUE_ERROR' },
      { status: 500 }
    );
  }
}
