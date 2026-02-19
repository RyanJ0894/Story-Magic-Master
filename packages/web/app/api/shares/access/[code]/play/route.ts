import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/api/error-response';

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
    return errorResponse('Invalid share code', 400, { code: 'INVALID_CODE' });
  }

  try {
    // Find the share by code and increment play count
    const share = await prisma.scriptShare.findFirst({
      where: { shareCode: code, isActive: true },
      select: { id: true, projectId: true, playCount: true },
    });

    if (!share) {
      return errorResponse('Share not found', 404, { code: 'NOT_FOUND' });
    }

    await prisma.scriptShare.update({
      where: { id: share.id },
      data: { playCount: (share.playCount || 0) + 1 },
    });

    return NextResponse.json({ success: true });
  } catch {
    return errorResponse('Failed to track play', 500);
  }
}
