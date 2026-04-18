/**
 * POST /api/writers/[writerId]/subscribe
 * Toggle subscription to a writer (subscribe / unsubscribe)
 *
 * GET /api/writers/[writerId]/subscribe
 * Check if the current user subscribes to this writer
 */

import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';

export const GET = withAuth(async (_request, { userId, prisma, params }) => {
  const writerId = params.writerId;

  if (writerId === userId) {
    return NextResponse.json({ subscribed: false });
  }

  const sub = await prisma.writerSubscription.findUnique({
    where: { subscriberId_writerId: { subscriberId: userId, writerId } },
    select: { id: true },
  });

  return NextResponse.json({ subscribed: !!sub });
});

export const POST = withAuth(async (_request, { userId, prisma, params }) => {
  const writerId = params.writerId;

  if (writerId === userId) {
    return NextResponse.json({ error: 'Cannot subscribe to yourself' }, { status: 400 });
  }

  // Verify writer exists
  const writer = await prisma.profile.findUnique({
    where: { id: writerId },
    select: { id: true },
  });
  if (!writer) {
    return NextResponse.json({ error: 'Writer not found' }, { status: 404 });
  }

  const existing = await prisma.writerSubscription.findUnique({
    where: { subscriberId_writerId: { subscriberId: userId, writerId } },
  });

  if (existing) {
    // Unsubscribe
    await prisma.writerSubscription.delete({
      where: { subscriberId_writerId: { subscriberId: userId, writerId } },
    });
    return NextResponse.json({ subscribed: false });
  } else {
    // Subscribe
    await prisma.writerSubscription.create({
      data: { subscriberId: userId, writerId },
    });
    return NextResponse.json({ subscribed: true }, { status: 201 });
  }
});
