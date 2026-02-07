import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { mode } = await request.json();

  if (!mode || !['automatic', 'fine_tuned'].includes(mode)) {
    return NextResponse.json(
      { error: 'Invalid workflow mode' },
      { status: 400 }
    );
  }

  // Verify project belongs to user
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', params.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Update preferred workflow mode
  const { error: updateError } = await supabase
    .from('projects')
    .update({ preferred_workflow_mode: mode })
    .eq('id', params.id);

  if (updateError) {
    console.error('Error updating workflow mode:', updateError);
    return NextResponse.json(
      { error: 'Failed to update workflow mode' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, mode });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get project with workflow mode
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, preferred_workflow_mode, current_run_number')
    .eq('id', params.id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({
    preferredMode: project.preferred_workflow_mode,
    currentRunNumber: project.current_run_number,
  });
}
