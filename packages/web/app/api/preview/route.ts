import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';

const PreviewRequestSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
  sceneId: z.string().min(1, 'Scene ID is required'),
});

export async function POST(request: Request) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({
      error: 'CSRF validation failed',
      code: 'CSRF_ERROR',
    }, { status: 403 });
  }

  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({
      error: 'Unauthorized',
      code: 'AUTH_REQUIRED',
    }, { status: 401 });
  }

  // Get session token for orchestrator calls
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    }, { status: 400 });
  }

  const parseResult = PreviewRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({
      error: 'Invalid request parameters',
      code: 'VALIDATION_ERROR',
      details: parseResult.error.flatten().fieldErrors,
    }, { status: 400 });
  }

  const { projectId, sceneId } = parseResult.data;

  // Fetch project (verify ownership and get director_json)
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, user_id, director_json, audio_overrides, voice_assignments')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({
      error: 'Project not found',
      code: 'PROJECT_NOT_FOUND',
    }, { status: 404 });
  }

  // Extract the requested scene from director_json
  const scenes = project.director_json?.scenes;
  if (!Array.isArray(scenes)) {
    return NextResponse.json({
      error: 'Project has no parsed scenes. Generate scenes first.',
      code: 'VALIDATION_ERROR',
    }, { status: 400 });
  }

  const scene = scenes.find((s: { scene_id: string }) => s.scene_id === sceneId);
  if (!scene) {
    return NextResponse.json({
      error: `Scene ${sceneId} not found in project`,
      code: 'VALIDATION_ERROR',
    }, { status: 404 });
  }

  // Budget check
  const { data: remainingPreviews, error: budgetError } = await supabase.rpc(
    'get_remaining_previews',
    { p_user_id: user.id }
  );

  if (budgetError) {
    console.error('Budget check error:', budgetError);
    return NextResponse.json({
      error: 'Failed to check preview budget',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }

  if ((remainingPreviews ?? 0) <= 0) {
    return NextResponse.json({
      error: 'No previews remaining. Generate audio to use page credits, which grant more previews.',
      code: 'PREVIEW_BUDGET_EXCEEDED',
      remainingPreviews: 0,
    }, { status: 403 });
  }

  // Apply audio overrides to the scene (same logic as generate route)
  const validCategories = ['music', 'ambience', 'sfx'];
  const audioOverrides = Array.isArray(project.audio_overrides)
    ? project.audio_overrides.filter(
        (o: { user_selected?: boolean; file?: string; scene_id?: string; category?: string }) =>
          o.user_selected && o.file && o.scene_id === sceneId && validCategories.includes(o.category || '')
      )
    : [];

  if (audioOverrides.length > 0) {
    for (const override of audioOverrides) {
      const category = override.category as 'music' | 'ambience' | 'sfx';
      const cueArray = scene[category];
      if (!Array.isArray(cueArray) || override.cue_index >= cueArray.length) continue;
      cueArray[override.cue_index] = {
        ...cueArray[override.cue_index],
        file: override.file,
        reasoning: 'User override',
      };
    }
  }

  // Apply voice overrides to the scene
  if (Array.isArray(project.voice_assignments)) {
    for (const assignment of project.voice_assignments) {
      if (assignment.user_selected && assignment.voice_id && assignment.character_name) {
        for (const line of scene.dialogue || []) {
          if (line.character === assignment.character_name) {
            line.voice_key = assignment.voice_id;
          }
        }
      }
    }
  }

  // Call orchestrator POST /preview
  const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:22002';

  try {
    const response = await fetch(`${orchestratorUrl}/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
      },
      body: JSON.stringify({
        project_id: projectId,
        scene,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Orchestrator preview error:', errorBody);
      return NextResponse.json({
        error: 'Preview generation failed',
        code: 'INTERNAL_ERROR',
      }, { status: 500 });
    }

    const result = await response.json();

    // Increment preview usage on success
    const { error: incrementError } = await supabase.rpc(
      'increment_preview_usage',
      { p_user_id: user.id }
    );

    if (incrementError) {
      console.error('Failed to increment preview usage:', incrementError);
      // Don't fail the request - preview was generated successfully
    }

    // Get updated remaining count
    const { data: updatedRemaining } = await supabase.rpc(
      'get_remaining_previews',
      { p_user_id: user.id }
    );

    return NextResponse.json({
      previewUrl: result.preview_url,
      previewPath: result.preview_path,
      durationSeconds: result.duration_seconds,
      remainingPreviews: updatedRemaining ?? 0,
    });
  } catch (error) {
    console.error('Preview generation error:', error);
    return NextResponse.json({
      error: 'Failed to generate preview',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}
