import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

// GET /api/reader/library - Get reader's library
export const GET = withAuth(async (request, { userId, prisma }) => {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  const status = searchParams.get('status');
  const favorited = searchParams.get('favorited');

  // Build where clause
  const where: Prisma.ReaderLibraryWhereInput = {
    readerId: userId,
    status: { not: 'removed' },
  };

  if (source) {
    where.source = source;
  }

  if (status) {
    where.status = status;
  }

  if (favorited === 'true') {
    where.isFavorited = true;
  }

  const entries = await prisma.readerLibrary.findMany({
    where,
    include: {
      project: {
        select: {
          id: true,
          name: true,
          pageCount: true,
          status: true,
          userId: true,
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
    orderBy: { createdAt: 'desc' },
  });

  // Check writer subscription status for each entry
  const writerIds = Array.from(
    new Set(entries.map(e => e.project?.userId).filter(Boolean) as string[])
  );

  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      userId: { in: writerIds },
      status: { in: ['active', 'trialing'] },
    },
    select: { userId: true },
  });

  const activeWriterIds = new Set(activeSubscriptions.map(s => s.userId));

  // Get audio durations
  const projectIds = entries.map(e => e.projectId).filter(Boolean);
  const audioOutputs = await prisma.audioOutput.findMany({
    where: { projectId: { in: projectIds } },
    select: { projectId: true, durationSeconds: true },
  });

  const durationMap = new Map(audioOutputs.map(a => [a.projectId, a.durationSeconds]));

  // Transform entries
  const transformedEntries = entries.map(entry => {
    const project = entry.project;
    const writerProfile = project?.user;
    const writerId = project?.userId;

    return {
      id: entry.id,
      reader_id: entry.readerId,
      project_id: entry.projectId,
      source: entry.source,
      share_id: entry.shareId,
      status: writerId && activeWriterIds.has(writerId) ? entry.status : 'archived',
      is_favorited: entry.isFavorited,
      notes: entry.notes,
      tags: entry.tags,
      last_played_at: entry.lastPlayedAt,
      play_position_seconds: entry.playPositionSeconds || 0,
      completed: entry.completed,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
      script_name: project?.name || 'Unknown Script',
      page_count: project?.pageCount || 0,
      writer_name: writerProfile?.fullName || 'Unknown Writer',
      writer_code: writerProfile?.writerCode || '',
      writer_subscribed: writerId ? activeWriterIds.has(writerId) : false,
      duration_seconds: durationMap.get(entry.projectId) || 0,
    };
  });

  return NextResponse.json({ entries: transformedEntries });
});
