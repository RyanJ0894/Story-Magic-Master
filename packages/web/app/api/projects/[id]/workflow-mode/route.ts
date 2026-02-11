import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { mode } = await request.json();

  if (!mode || !['automatic', 'fine_tuned'].includes(mode)) {
    return NextResponse.json(
      { error: 'Invalid workflow mode' },
      { status: 400 }
    );
  }

  // Verify project belongs to user
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Update preferred workflow mode
    await prisma.project.update({
      where: { id: params.id },
      data: { preferredWorkflowMode: mode },
    });

    return NextResponse.json({ success: true, mode });
  } catch (error) {
    console.error('Error updating workflow mode:', error);
    return NextResponse.json(
      { error: 'Failed to update workflow mode' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  // Get project with workflow mode
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, preferredWorkflowMode: true, currentRunNumber: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({
    preferredMode: project.preferredWorkflowMode,
    currentRunNumber: project.currentRunNumber,
  });
}
