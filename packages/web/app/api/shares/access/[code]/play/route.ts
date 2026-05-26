import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/api/error-response';

/**
 * POST /api/shares/access/[code]/play
 *
 * Tracks a play or complete event for a shared script.
 * Public endpoint — no auth required.
 *
 * Body (optional):
 *   { action: 'play' | 'complete', progressPct?: number }
 *
 * Increments playCount on ScriptShare and writes a ContentAccessLog row
 * for analytics. Only increments playCount on 'play' action (not 'complete').
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || code.length < 6) {
    return errorResponse('Invalid share code', 400, { code: 'INVALID_CODE' });
  }

  let action: 'play' | 'complete' = 'play';
  let progressPct: number | undefined;

  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === 'complete') action = 'complete';
    if (typeof body.progressPct === 'number') progressPct = body.progressPct;
  } catch {
    // body is optional — continue with defaults
  }

  try {
    const share = await prisma.scriptShare.findFirst({
      where: { shareCode: code, isActive: true },
      select: { id: true, projectId: true, playCount: true },
    });

    if (!share) {
      return errorResponse('Share not found', 404, { code: 'NOT_FOUND' });
    }

    // Increment playCount only on the initial 'play' action
    if (action === 'play') {
      await prisma.scriptShare.update({
        where: { id: share.id },
        data: { playCount: (share.playCount ?? 0) + 1 },
      });
    }

    // Write ContentAccessLog row for analytics dashboard
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? undefined;

    await prisma.contentAccessLog.create({
      data: {
        projectId: share.projectId,
        shareId: share.id,
        accessType: action,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
        // progressPct not in current schema — stored in endPositionSeconds as a proxy
        // when action=complete and progressPct provided
        endPositionSeconds: action === 'complete' && progressPct != null
          ? Math.round(progressPct)
          : null,
      },
    });

    return NextResponse.json({ success: true, action });
  } catch {
    return errorResponse('Failed to track play', 500);
  }
}
