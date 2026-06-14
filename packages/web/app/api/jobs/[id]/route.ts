import { withAuth, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { withQueryTimeout, QueryTimeoutError } from '@/lib/db/with-query-timeout';

// Defensive deadline for the DB lookup. STORY-MAGIC-1G recorded this
// route hanging 5 min while waiting on an exhausted Prisma connection
// pool. A 5-second cap means the client sees a fast 503 and can retry
// instead of an indefinite spinner.
const JOB_POLL_QUERY_TIMEOUT_MS = 5000;

// Polling every 2s = 30 req/min — needs 'loose' (60/min), not default 'normal' (20/min)
export const GET = withAuth(async (_request, { userId, prisma, params }) => {
  const jobId = params.id;

  // Fetch job with project info
  let job;
  try {
    job = await withQueryTimeout(
      prisma.job.findUnique({
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
      }),
      JOB_POLL_QUERY_TIMEOUT_MS,
      'jobs/[id] findUnique',
    );
  } catch (err) {
    if (err instanceof QueryTimeoutError) {
      return new NextResponse(
        JSON.stringify({ error: 'service_busy', message: 'Job lookup timed out. Retry shortly.' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '5' },
        },
      );
    }
    throw err;
  }

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
    // Sprint K: segment-level progress for chunked generation
    segments: job.segments ?? null,
    // Sprint L: first completed segment URL — player can start before full job completes
    firstAudioUrl: job.firstAudioUrl ?? null,
    // Derive top-level audio_url from the completed job result (backwards compat)
    audio_url: job.status === 'completed'
      ? ((job.result as Record<string, unknown>)?.audio_urls as string[] | undefined)?.[0] ?? null
      : null,
  });
}, { rateLimit: 'loose' });
