import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { z } from 'zod';

const FavoriteSchema = z.object({
  is_favorited: z.boolean().optional(),
});

// POST /api/reader/library/[entryId]/favorite - Toggle favorite
export const POST = withAuth(async (request, { userId, prisma, params }) => {
  const entryId = params.entryId;

  // Verify ownership
  const existingEntry = await prisma.readerLibrary.findFirst({
    where: { id: entryId },
    select: { id: true, readerId: true, isFavorited: true },
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

  const parseResult = FavoriteSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ error: 'Invalid request', code: 'VALIDATION_ERROR', details: parseResult.error.flatten().fieldErrors }, { status: 400 });
  }

  const isFavorited = parseResult.data.is_favorited ?? !existingEntry.isFavorited;

  try {
    const entry = await prisma.readerLibrary.update({
      where: { id: entryId },
      data: { isFavorited },
    });

    return NextResponse.json({
      entry,
      is_favorited: entry.isFavorited,
    });
  } catch (error) {
    log.error('Error updating favorite', error);
    return NextResponse.json({ error: 'Failed to update favorite' }, { status: 500 });
  }
});
