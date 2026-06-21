/**
 * Job Queue Position API Route
 *
 * GET /api/jobs/[id]/position - Get job's position in queue
 */

import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { getQueuePosition } from '@/lib/queue/service';
import { log } from '@/lib/logger';

// 2026-06-20: bumped from default ('normal' = 20 req/min) to 'loose'
// (60 req/min). Client polls this every 3s while a job is queued, which
// is 20 req/min exactly at the normal ceiling — any jitter or shared-IP
// situation puts the user over the limit. Ryan saw 50+ consecutive 429s
// on the 6/19 7:38 PM test. The endpoint is read-only and userId-scoped,
// so loose rate-limit is safe.
export const GET = withAuth(
  async (_request, { userId, prisma, params }) => {
    const jobId = params.id;

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
      log.error('[Queue] Position error', error);
      return NextResponse.json(
        { error: 'Failed to get queue position', code: 'QUEUE_ERROR' },
        { status: 500 }
      );
    }
  },
  { rateLimit: 'loose' }
);
