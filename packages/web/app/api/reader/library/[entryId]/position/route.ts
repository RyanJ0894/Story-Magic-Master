import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
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
    return errorResponse('Entry not found', 404, { code: 'NOT_FOUND' });
  }

  const parsed = await parseBody(request, PositionSchema);
  if ('error' in parsed) return parsed.error;

  const { position, duration, completed } = parsed.data;

  const updates: Record<string, unknown> = {
    playPositionSeconds: Math.floor(position),
    lastPlayedAt: new Date(),
  };

  // Mark as completed if near the end
  if (completed || (duration && position >= duration - 30)) {
    updates.completed = true;
  }

  try {
    // #331 (2026-06-17): read the pre-update completed state so we only
    // emit the listen-complete notification on the false→true transition,
    // not on every subsequent position write past the threshold.
    const wasAlreadyCompleted = await prisma.readerLibrary.findUnique({
      where: { id: entryId },
      select: { completed: true },
    });

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

    // #331: master-notification on listen-complete transition.
    if (entry.completed && !wasAlreadyCompleted?.completed) {
      try {
        const { emitListenComplete } = await import('@/lib/notifications/producers');
        await emitListenComplete(prisma, {
          projectId: existingEntry.projectId,
          actorUserId: userId,
        });
      } catch (err) {
        log.warn('[Position] emitListenComplete failed', { err: err instanceof Error ? err.message : String(err) });
      }
    }

    return NextResponse.json({
      entry,
      position: entry.playPositionSeconds,
      completed: entry.completed,
    });
  } catch (error) {
    log.error('Error updating position', error);
    return errorResponse('Failed to update position', 500);
  }
});
