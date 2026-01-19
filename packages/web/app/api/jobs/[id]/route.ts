import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobId = params.id;

  // Fetch job with project info
  const { data: job, error } = await supabase
    .from('jobs')
    .select(`
      *,
      projects!inner (
        id,
        name,
        user_id,
        status
      )
    `)
    .eq('id', jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Verify user owns this job
  if (job.projects.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Return job status with progress details
  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress || { step: 'unknown', percent: 0 },
    error: job.error,
    started_at: job.started_at,
    completed_at: job.completed_at,
    created_at: job.created_at,
    project_id: job.project_id,
    project_status: job.projects.status,
  });
}
