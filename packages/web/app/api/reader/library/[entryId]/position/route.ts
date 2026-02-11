import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';

interface RouteParams {
  params: Promise<{ entryId: string }>;
}

// POST /api/reader/library/[entryId]/position - Update playback position
export async function POST(request: NextRequest, { params }: RouteParams) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { entryId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  // Verify ownership
  const existingEntry = await prisma.readerLibrary.findFirst({
    where: { id: entryId },
    select: { id: true, readerId: true, projectId: true },
  });

  if (!existingEntry || existingEntry.readerId !== userId) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const body = await request.json();
  const { position, duration, completed } = body;

  if (typeof position !== 'number') {
    return NextResponse.json({ error: 'Position required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    playPositionSeconds: Math.floor(position),
    lastPlayedAt: new Date(),
  };

  // Mark as completed if near the end
  if (completed || (duration && position >= duration - 30)) {
    updates.completed = true;
  }

  try {
    const entry = await prisma.readerLibrary.update({
      where: { id: entryId },
      data: updates,
    });

    // Log access for analytics
    await prisma.contentAccessLog.create({
      data: {
        userId,
        projectId: existingEntry.projectId,
        accessType: 'stream',
        durationSeconds: Math.floor(position),
      },
    });

    return NextResponse.json({
      entry,
      position: entry.playPositionSeconds,
      completed: entry.completed,
    });
  } catch (error) {
    console.error('Error updating position:', error);
    return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });
  }
}
