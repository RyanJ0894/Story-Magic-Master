import { withProjectAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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
export const GET = withProjectAuth(async (_request, { prisma, projectId }) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { audioOverrides: true },
  });

  return NextResponse.json({
    overrides: project?.audioOverrides || [],
  });
});

/**
 * PUT /api/projects/[id]/audio-overrides
 * Saves audio overrides for a project
 */
export const PUT = withProjectAuth(async (request, { prisma, projectId }) => {
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
    await prisma.project.update({
      where: { id: projectId },
      data: { audioOverrides: overrides as unknown as [] },
    });

    return NextResponse.json({ success: true, overrides });
  } catch {
    return NextResponse.json({ error: 'Failed to save audio overrides' }, { status: 500 });
  }
});
