import { withAuth, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { withQueryTimeout, QueryTimeoutError } from '@/lib/db/with-query-timeout';

const JOB_POLL_QUERY_TIMEOUT_MS = 5000;

/**
 * GET /api/jobs/[id]/status
 * Lightweight status endpoint for polling (used by reader upload client).
 * Fail-fast on connection-pool starvation — see STORY-MAGIC-1G.
 */
export const GET = withAuth(async (_request, { userId, prisma, params }) => {
  const jobId = params.id;

  let job;
  try {
    job = await withQueryTimeout(
      prisma.job.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          status: true,
          progress: true,
          error: true,
          project: { select: { userId: true } },
        },
      }),
      JOB_POLL_QUERY_TIMEOUT_MS,
      'jobs/[id]/status findUnique',
    );
  } catch (err) {
    if (err instanceof QueryTimeoutError) {
      return new NextResponse(
        JSON.stringify({ error: 'service_busy', message: 'Status lookup timed out. Retry shortly.' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '5' },
        },
      );
    }
    throw err;
  }

  if (!job || job.project.userId !== userId) {
    return errorResponse('Job not found', 404, { code: 'NOT_FOUND' });
  }

  const progress = job.progress as Record<string, unknown> | null;

  return NextResponse.json({
    status: job.status,
    progress: progress?.percent ?? 0,
    message: progress?.details ?? job.error ?? '',
    step: progress?.step ?? 'unknown',
  });
});
