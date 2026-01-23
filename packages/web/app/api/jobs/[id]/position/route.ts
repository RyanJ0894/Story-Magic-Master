/**
 * Job Queue Position API Route
 *
 * GET /api/jobs/[id]/position - Get job's position in queue
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getQueuePosition } from '@/lib/queue/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: jobId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // Verify user owns this job
  const { data: job } = await supabase
    .from('jobs')
    .select('id, user_id, status')
    .eq('id', jobId)
    .single();

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  if (job.user_id !== user.id) {
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
