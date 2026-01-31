import { createClient } from '@/lib/supabase/server';
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';

const VoiceAssignmentSchema = z.object({
  character_name: z.string().min(1),
  voice_id: z.string().min(1),
  voice_name: z.string(),
  user_selected: z.boolean().default(true),
  locked: z.boolean().default(false),
});

const UpdateVoiceAssignmentsSchema = z.object({
  assignments: z.array(VoiceAssignmentSchema),
});

/**
 * GET /api/projects/[id]/voice-assignments
 * Returns the saved voice assignments for a project
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
    .select('voice_assignments')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({
    assignments: project.voice_assignments || [],
  });
}

/**
 * PUT /api/projects/[id]/voice-assignments
 * Saves voice assignments for a project
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

  const parseResult = UpdateVoiceAssignmentsSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({
      error: 'Invalid request',
      details: parseResult.error.flatten().fieldErrors,
    }, { status: 400 });
  }

  const { assignments } = parseResult.data;

  const { error } = await supabase
    .from('projects')
    .update({ voice_assignments: assignments })
    .eq('id', projectId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to save voice assignments' }, { status: 500 });
  }

  return NextResponse.json({ success: true, assignments });
}
