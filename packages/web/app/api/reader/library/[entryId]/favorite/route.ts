import { withAuth, parseBody, errorResponse } from '@/lib/api/middleware';
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
    return errorResponse('Entry not found', 404, { code: 'NOT_FOUND' });
  }

  const parsed = await parseBody(request, FavoriteSchema);
  if ('error' in parsed) return parsed.error;

  const isFavorited = parsed.data.is_favorited ?? !existingEntry.isFavorited;

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
    return errorResponse('Failed to update favorite', 500);
  }
});
