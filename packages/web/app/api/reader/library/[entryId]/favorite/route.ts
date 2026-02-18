import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';
import { log } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ entryId: string }>;
}

// POST /api/reader/library/[entryId]/favorite - Toggle favorite
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
    select: { id: true, readerId: true, isFavorited: true },
  });

  if (!existingEntry || existingEntry.readerId !== userId) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const body = await request.json();
  const isFavorited = body.is_favorited ?? !existingEntry.isFavorited;

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
}
