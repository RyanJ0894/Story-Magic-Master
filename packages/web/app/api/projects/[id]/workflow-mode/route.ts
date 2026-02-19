import { withProjectAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { z } from 'zod';

const WorkflowModeSchema = z.object({
  mode: z.enum(['automatic', 'fine_tuned']),
});

export const POST = withProjectAuth(async (request, { prisma, projectId }) => {
  const parsed = await parseBody(request, WorkflowModeSchema);
  if ('error' in parsed) return parsed.error;

  const { mode } = parsed.data;

  try {
    // Update preferred workflow mode
    await prisma.project.update({
      where: { id: projectId },
      data: { preferredWorkflowMode: mode },
    });

    return NextResponse.json({ success: true, mode });
  } catch (error) {
    log.error('Error updating workflow mode', error);
    return errorResponse('Failed to update workflow mode', 500);
  }
});

export const GET = withProjectAuth(async (_request, { prisma, projectId }) => {
  // The project is already fetched by withProjectAuth, but we need specific fields
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { id: true, preferredWorkflowMode: true, currentRunNumber: true },
  });

  if (!project) {
    return errorResponse('Project not found', 404, { code: 'NOT_FOUND' });
  }

  return NextResponse.json({
    preferredMode: project.preferredWorkflowMode,
    currentRunNumber: project.currentRunNumber,
  });
});
