import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { z } from 'zod';

const PatchEntrySchema = z.object({
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  play_position_seconds: z.number().min(0).optional(),
  completed: z.boolean().optional(),
  readStatus: z.enum(['like', 'pass', 'undecided']).optional(),
});

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
    return errorResponse('Entry not found', 404, { code: 'NOT_FOUND' });
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
    return errorResponse('Entry not found', 404, { code: 'NOT_FOUND' });
  }

  const parsed = await parseBody(request, PatchEntrySchema);
  if ('error' in parsed) return parsed.error;

  const { notes, tags, play_position_seconds, completed, readStatus } = parsed.data;

  const updates: Record<string, unknown> = {};

  if (notes !== undefined) updates.notes = notes;
  if (tags !== undefined) updates.tags = tags;
  if (play_position_seconds !== undefined) {
    updates.playPositionSeconds = play_position_seconds;
    updates.lastPlayedAt = new Date();
  }
  if (completed !== undefined) updates.completed = completed;

  if (readStatus !== undefined) {
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
    return errorResponse('Failed to update entry', 500);
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
    return errorResponse('Entry not found', 404, { code: 'NOT_FOUND' });
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
    return errorResponse('Failed to remove entry', 500);
  }
});
