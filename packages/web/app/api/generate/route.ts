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
      const errorBody = await directorResponse.text();
      console.error('Director Agent error response:', errorBody);
      throw new Error(`Director Agent failed: ${errorBody}`);
    }

    const directorResponse_json = await directorResponse.json();

    // Extract the actual director JSON (it's nested in the response)
    const directorJson = directorResponse_json.director_json || directorResponse_json;

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
        scenes: directorJson.scenes || [],
      }),
    });

    if (!orchestratorResponse.ok) {
      const errorBody = await orchestratorResponse.text();
      console.error('Orchestrator error response:', errorBody);
      throw new Error(`Orchestrator failed: ${errorBody}`);
    }

    const orchestratorResult = await orchestratorResponse.json();

    // Update job progress
    await supabase
      .from('jobs')
      .update({
        progress: { step: 'uploading', percent: 80 },
      })
      .eq('id', jobId);

    // Step 3: Store audio output records
    // The orchestrator returns audio_urls and playback_manifest
    const audioUrls = orchestratorResult.audio_urls || [];
    const manifest = orchestratorResult.playback_manifest;

    // Create audio output records for each generated file
    for (const audioUrl of audioUrls) {
      if (!audioUrl) continue; // Skip null/undefined entries
      const fileName = audioUrl.split('/').pop() || 'output.mp3';
      await supabase
        .from('audio_outputs')
        .insert({
          project_id: projectId,
          job_id: jobId,
          file_name: fileName,
          file_path: audioUrl,
          duration_seconds: manifest?.total_duration || null,
          format: fileName.endsWith('.m4a') ? 'm4a' : 'mp3',
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
