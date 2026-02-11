import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
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

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { audioOverrides: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({
    overrides: project.audioOverrides || [],
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

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
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

  try {
    const updated = await prisma.project.updateMany({
      where: { id: projectId, userId },
      data: { audioOverrides: overrides as unknown as [] },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, overrides });
  } catch {
    return NextResponse.json({ error: 'Failed to save audio overrides' }, { status: 500 });
  }
}
