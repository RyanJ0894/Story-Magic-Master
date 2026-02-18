import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/shares/access/[code]/play
 * Track a play event for a shared script (public endpoint, no auth required)
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || code.length < 6) {
    return NextResponse.json({ error: 'Invalid share code' }, { status: 400 });
  }

  try {
    // Find the share by code and increment play count
    const share = await prisma.scriptShare.findFirst({
      where: { shareCode: code, isActive: true },
      select: { id: true, projectId: true, playCount: true },
    });

    if (!share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    await prisma.scriptShare.update({
      where: { id: share.id },
      data: { playCount: (share.playCount || 0) + 1 },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to track play' }, { status: 500 });
  }
}
