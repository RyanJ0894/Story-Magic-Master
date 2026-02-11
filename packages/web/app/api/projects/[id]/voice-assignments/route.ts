import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
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

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { voiceAssignments: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({
    assignments: project.voiceAssignments || [],
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

  const parseResult = UpdateVoiceAssignmentsSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({
      error: 'Invalid request',
      details: parseResult.error.flatten().fieldErrors,
    }, { status: 400 });
  }

  const { assignments } = parseResult.data;

  try {
    const updated = await prisma.project.updateMany({
      where: { id: projectId, userId },
      data: { voiceAssignments: assignments as unknown as [] },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, assignments });
  } catch {
    return NextResponse.json({ error: 'Failed to save voice assignments' }, { status: 500 });
  }
}
