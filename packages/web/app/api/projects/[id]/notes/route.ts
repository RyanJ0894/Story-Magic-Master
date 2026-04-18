/**
 * Project Notes API
 *
 * GET    /api/projects/[id]/notes       - list notes for current user on this project
 * POST   /api/projects/[id]/notes       - create a note
 * DELETE /api/projects/[id]/notes?noteId= - delete a note (author only)
 */

import { withProjectAuth, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';

const CreateNoteSchema = z.object({
  noteText: z.string().min(1).max(2000),
  lineId: z.string().optional(),
  timestamp: z.number().int().nonnegative().optional(),
});

export const GET = withProjectAuth(async (request, { userId, prisma, projectId }) => {
  try {
    const notes = await prisma.projectNote.findMany({
      where: { projectId, authorId: userId },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ notes });
  } catch (error) {
    log.error('[Notes] GET error', error instanceof Error ? error : undefined);
    return errorResponse('Failed to fetch notes', 500);
  }
});

export const POST = withProjectAuth(async (request, { userId, prisma, projectId }) => {
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON', 400); }

  const parsed = CreateNoteSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400);

  const { noteText, lineId, timestamp } = parsed.data;

  try {
    const note = await prisma.projectNote.create({
      data: { projectId, authorId: userId, noteText, lineId: lineId ?? null, timestamp: timestamp ?? null },
    });
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    log.error('[Notes] POST error', error instanceof Error ? error : undefined);
    return errorResponse('Failed to create note', 500);
  }
});

export const DELETE = withProjectAuth(async (request, { userId, prisma }) => {
  const { searchParams } = new URL(request.url);
  const noteId = searchParams.get('noteId');
  if (!noteId) return errorResponse('noteId is required', 400);

  try {
    const note = await prisma.projectNote.findUnique({ where: { id: noteId } });
    if (!note) return errorResponse('Note not found', 404);
    if (note.authorId !== userId) return errorResponse('Forbidden', 403);

    await prisma.projectNote.delete({ where: { id: noteId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[Notes] DELETE error', error instanceof Error ? error : undefined);
    return errorResponse('Failed to delete note', 500);
  }
});
