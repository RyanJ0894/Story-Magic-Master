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
 * Increments playCount atomically on 'play' action (not 'complete').
 * Rejects expired or play-limit-exhausted shares even if still isActive.
 * Writes a ContentAccessLog row for every accepted event.
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
      select: {
        id: true,
        projectId: true,
        expiresAt: true,
      },
    });

    if (!share) {
      return errorResponse('Share not found', 404, { code: 'NOT_FOUND' });
    }

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return errorResponse('Share link has expired', 410, { code: 'EXPIRED' });
    }

    // Atomic increment — WHERE guard prevents play count overshoot under concurrent requests.
    // Returns 0 rows when max_plays already reached; eliminates the read-check-write race.
    if (action === 'play') {
      const updated = await prisma.$executeRaw`
        UPDATE script_shares
        SET play_count = play_count + 1,
            last_accessed_at = NOW()
        WHERE id = ${share.id}::uuid
          AND (max_plays IS NULL OR play_count < max_plays)
      `;

      if (updated === 0) {
        return errorResponse('Share play limit reached', 410, { code: 'PLAY_LIMIT_REACHED' });
      }
    }

    // Write ContentAccessLog row for analytics dashboard
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      undefined;

    await prisma.contentAccessLog.create({
      data: {
        projectId: share.projectId,
        shareId: share.id,
        accessType: action,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
        endPositionSeconds:
          action === 'complete' && progressPct != null ? Math.round(progressPct) : null,
      },
    });

    return NextResponse.json({ success: true, action });
  } catch {
    return errorResponse('Failed to track play', 500);
  }
}
