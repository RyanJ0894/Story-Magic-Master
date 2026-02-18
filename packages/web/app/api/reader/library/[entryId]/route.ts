import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

// GET /api/reader/library/[entryId] - Get single library entry
export const GET = withAuth(async (request, { userId, prisma, params }) => {
  const entryId = params.entryId;

  const entry = await prisma.readerLibrary.findFirst({
    where: {
      id: entryId,
      readerId: userId,
    },
    include: {
      project: {
        include: {
          user: {
            select: {
              fullName: true,
              writerCode: true,
            },
          },
        },
      },
      share: {
        select: {
          id: true,
          sharedBy: true,
          accessLevel: true,
        },
      },
    },
  });

  if (!entry) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  // Get audio output
  const audioOutput = await prisma.audioOutput.findFirst({
    where: { projectId: entry.projectId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    entry,
    audio: audioOutput,
  });
});

// PATCH /api/reader/library/[entryId] - Update library entry
export const PATCH = withAuth(async (request, { userId, prisma, params }) => {
  const entryId = params.entryId;

  // Verify ownership
  const existingEntry = await prisma.readerLibrary.findFirst({
    where: { id: entryId },
    select: { id: true, readerId: true },
  });

  if (!existingEntry || existingEntry.readerId !== userId) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const body = await request.json();
  const {
    notes,
    tags,
    play_position_seconds,
    completed,
    readStatus,
  } = body;

  const updates: Record<string, unknown> = {};

  if (notes !== undefined) updates.notes = notes;
  if (tags !== undefined) updates.tags = tags;
  if (play_position_seconds !== undefined) {
    updates.playPositionSeconds = play_position_seconds;
    updates.lastPlayedAt = new Date();
  }
  if (completed !== undefined) updates.completed = completed;

  // Handle read status (Like/Pass/Undecided)
  if (readStatus !== undefined) {
    if (!['like', 'pass', 'undecided'].includes(readStatus)) {
      return NextResponse.json(
        { error: 'Invalid read status. Must be like, pass, or undecided.' },
        { status: 400 }
      );
    }
    updates.readStatus = readStatus;
    updates.readStatusUpdatedAt = new Date();
  }

  try {
    const entry = await prisma.readerLibrary.update({
      where: { id: entryId },
      data: updates,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    log.error('Error updating entry', error);
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }
});

// DELETE /api/reader/library/[entryId] - Remove from library
export const DELETE = withAuth(async (request, { userId, prisma, params }) => {
  const entryId = params.entryId;

  // Verify ownership
  const existingEntry = await prisma.readerLibrary.findFirst({
    where: { id: entryId },
    select: { id: true, readerId: true },
  });

  if (!existingEntry || existingEntry.readerId !== userId) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  try {
    // Soft delete by setting status to removed
    await prisma.readerLibrary.update({
      where: { id: entryId },
      data: { status: 'removed' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Error removing entry', error);
    return NextResponse.json({ error: 'Failed to remove entry' }, { status: 500 });
  }
});
