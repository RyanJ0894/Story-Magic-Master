import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  // Verify user is authenticated and get session for API calls
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get session token for orchestrator API calls
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const { projectId, jobId } = await request.json();

  if (!projectId || !jobId) {
    return NextResponse.json({ error: 'Missing projectId or jobId' }, { status: 400 });
  }

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Update job status to processing
  await supabase
    .from('jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      progress: { step: 'parsing', percent: 10 },
    })
    .eq('id', jobId);

  try {
    // Step 1: Call Director Agent to parse script
    // Note: Director is now consolidated into Orchestrator service
    const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:22002';
    const directorResponse = await fetch(`${orchestratorUrl}/generate-scenes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
      },
      body: JSON.stringify({
        project_id: projectId,
        script_text: project.script_text,
      }),
    });

    if (!directorResponse.ok) {
      throw new Error('Director Agent failed');
    }

    const directorJson = await directorResponse.json();

    // Update job progress
    await supabase
      .from('jobs')
      .update({
        progress: { step: 'generating_audio', percent: 40 },
      })
      .eq('id', jobId);

    // Save director JSON to project
    await supabase
      .from('projects')
      .update({ director_json: directorJson })
      .eq('id', projectId);

    // Step 2: Call Orchestrator to generate audio
    const orchestratorResponse = await fetch(`${orchestratorUrl}/orchestrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
      },
      body: JSON.stringify({
        project_id: projectId,
        scenes: directorJson.scenes || directorJson,
      }),
    });

    if (!orchestratorResponse.ok) {
      throw new Error('Orchestrator failed');
    }

    const orchestratorResult = await orchestratorResponse.json();

    // Update job progress
    await supabase
      .from('jobs')
      .update({
        progress: { step: 'uploading', percent: 80 },
      })
      .eq('id', jobId);

    // Step 3: Upload audio to Supabase Storage
    // TODO: Implement actual file upload from Orchestrator output
    // For now, we'll store the result metadata

    // Create audio output record
    if (orchestratorResult.output_file) {
      await supabase
        .from('audio_outputs')
        .insert({
          project_id: projectId,
          job_id: jobId,
          file_name: orchestratorResult.output_file,
          file_path: `audio-outputs/${projectId}/${orchestratorResult.output_file}`,
          duration_seconds: orchestratorResult.duration_seconds,
          format: 'mp3',
        });
    }

    // Increment usage
    await supabase.rpc('increment_usage', {
      p_user_id: user.id,
      p_pages: project.page_count,
    });

    // Mark job as completed
    await supabase
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress: { step: 'done', percent: 100 },
        result: orchestratorResult,
      })
      .eq('id', jobId);

    // Update project status
    await supabase
      .from('projects')
      .update({ status: 'completed' })
      .eq('id', projectId);

    return NextResponse.json({ success: true, result: orchestratorResult });

  } catch (error) {
    console.error('Generation error:', error);

    // Mark job as failed
    await supabase
      .from('jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', jobId);

    // Update project status
    await supabase
      .from('projects')
      .update({ status: 'failed' })
      .eq('id', projectId);

    return NextResponse.json(
      { error: 'Generation failed' },
      { status: 500 }
    );
  }
}
