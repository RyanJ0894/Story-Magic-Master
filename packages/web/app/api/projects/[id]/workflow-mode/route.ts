import { withProjectAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { z } from 'zod';

const WorkflowModeSchema = z.object({
  mode: z.enum(['automatic', 'fine_tuned']),
});

export const POST = withProjectAuth(async (request, { prisma, projectId }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body', code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  const parseResult = WorkflowModeSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid workflow mode', code: 'VALIDATION_ERROR', details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { mode } = parseResult.data;

  try {
    // Update preferred workflow mode
    await prisma.project.update({
      where: { id: projectId },
      data: { preferredWorkflowMode: mode },
    });

    return NextResponse.json({ success: true, mode });
  } catch (error) {
    log.error('Error updating workflow mode', error);
    return NextResponse.json(
      { error: 'Failed to update workflow mode' },
      { status: 500 }
    );
  }
});

export const GET = withProjectAuth(async (_request, { prisma, projectId }) => {
  // The project is already fetched by withProjectAuth, but we need specific fields
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { id: true, preferredWorkflowMode: true, currentRunNumber: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({
    preferredMode: project.preferredWorkflowMode,
    currentRunNumber: project.currentRunNumber,
  });
});
