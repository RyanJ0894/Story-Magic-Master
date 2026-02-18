import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { z } from 'zod';

const PositionSchema = z.object({
  position: z.number().min(0),
  duration: z.number().min(0).optional(),
  completed: z.boolean().optional(),
});

// POST /api/reader/library/[entryId]/position - Update playback position
export const POST = withAuth(async (request, { userId, prisma, params }) => {
  const entryId = params.entryId;

  // Verify ownership
  const existingEntry = await prisma.readerLibrary.findFirst({
    where: { id: entryId },
    select: { id: true, readerId: true, projectId: true },
  });

  if (!existingEntry || existingEntry.readerId !== userId) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_JSON' }, { status: 400 });
  }

  const parseResult = PositionSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid request', code: 'VALIDATION_ERROR', details: parseResult.error.flatten().fieldErrors }, { status: 400 });
  }

  const { position, duration, completed } = parseResult.data;

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
    log.error('Error updating position', error);
    return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });
  }
});
