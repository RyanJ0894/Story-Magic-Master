import { createClient } from '@/lib/supabase/server';
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';

const AudioOverrideSchema = z.object({
  scene_id: z.string().min(1),
  category: z.enum(['music', 'ambience', 'sfx']),
  cue_index: z.number().int().min(0),
  track_id: z.string().min(1),
  file: z.string().min(1),
  title: z.string(),
  user_selected: z.boolean().default(true),
  locked: z.boolean().default(false),
});

const UpdateAudioOverridesSchema = z.object({
  overrides: z.array(AudioOverrideSchema),
});

/**
 * GET /api/projects/[id]/audio-overrides
 * Returns the saved audio overrides for a project
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('audio_overrides')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({
    overrides: project.audio_overrides || [],
  });
}

/**
 * PUT /api/projects/[id]/audio-overrides
 * Saves audio overrides for a project
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { id: projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = UpdateAudioOverridesSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({
      error: 'Invalid request',
      details: parseResult.error.flatten().fieldErrors,
    }, { status: 400 });
  }

  const { overrides } = parseResult.data;

  const { error } = await supabase
    .from('projects')
    .update({ audio_overrides: overrides })
    .eq('id', projectId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to save audio overrides' }, { status: 500 });
  }

  return NextResponse.json({ success: true, overrides });
}
