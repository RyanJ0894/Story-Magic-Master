import { withProjectAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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
export const GET = withProjectAuth(async (_request, { prisma, projectId }) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { voiceAssignments: true },
  });

  return NextResponse.json({
    assignments: project?.voiceAssignments || [],
  });
});

/**
 * PUT /api/projects/[id]/voice-assignments
 * Saves voice assignments for a project
 */
export const PUT = withProjectAuth(async (request, { prisma, projectId }) => {
  const parsed = await parseBody(request, UpdateVoiceAssignmentsSchema);
  if ('error' in parsed) return parsed.error;

  const { assignments } = parsed.data;

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { voiceAssignments: assignments as unknown as [] },
    });

    return NextResponse.json({ success: true, assignments });
  } catch {
    return errorResponse('Failed to save voice assignments', 500);
  }
});
