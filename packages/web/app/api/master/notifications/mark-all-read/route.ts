/**
 * POST /api/master/notifications/mark-all-read
 *
 * Clears the unread badge by marking every feed-scoped alert read for the
 * current user. Ryan agreed (2026-06-09) that per-event mark-as-read is
 * out of scope for the first cut — the bell-icon "Mark all read" action
 * is the only way to clear the badge.
 *
 * Feed-scoped (FEED_ALERT_TYPES) so legacy non-feed alerts are not
 * touched and the legacy /alerts page continues to behave the same way.
 *
 * Response: { success: true, updated: number }
 */

import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { FEED_ALERT_TYPES } from '@/lib/notifications/feed-types';

export const POST = withAuth(async (_request, { userId, prisma }) => {
  try {
    const result = await prisma.alert.updateMany({
      where: {
        userId,
        alertType: { in: [...FEED_ALERT_TYPES] },
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });
    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    log.error('[notifications] mark-all-read failed', error);
    return NextResponse.json(
      { error: 'Failed to mark read', code: 'MARK_READ_ERROR' },
      { status: 500 },
    );
  }
});
