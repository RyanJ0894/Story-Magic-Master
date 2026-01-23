/**
 * Cancel Job API Route
 *
 * POST /api/jobs/[id]/cancel - Cancel a queued job
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cancelJob } from '@/lib/queue/service';

export async function POST(
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

  // Verify user owns this job and it's cancellable
  const { data: job } = await supabase
    .from('jobs')
    .select('id, user_id, status, project_id')
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
    const cancelled = await cancelJob(jobId, user.id);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Failed to cancel job', code: 'CANCEL_FAILED' },
        { status: 500 }
      );
    }

    // Reset project status to draft
    await supabase
      .from('projects')
      .update({ status: 'draft' })
      .eq('id', job.project_id);

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job cancelled successfully',
    });
  } catch (error) {
    console.error('[Queue] Cancel error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel job', code: 'CANCEL_ERROR' },
      { status: 500 }
    );
  }
}
