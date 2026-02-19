import { withProjectAuth, parseBody, errorResponse } from '@/lib/api/middleware';
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
  const parsed = await parseBody(request, UpdateAudioOverridesSchema);
  if ('error' in parsed) return parsed.error;

  const { overrides } = parsed.data;

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { audioOverrides: overrides as unknown as [] },
    });

    return NextResponse.json({ success: true, overrides });
  } catch {
    return errorResponse('Failed to save audio overrides', 500);
  }
});
