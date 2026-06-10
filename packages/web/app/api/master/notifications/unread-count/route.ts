/**
 * GET /api/master/notifications/unread-count
 *
 * Lightweight endpoint the bell-icon component polls every 30s for the
 * badge count. Avoids the full feed query when the dropdown is closed.
 *
 * Response: { count: number }
 *
 * Feed-scoped (same FEED_ALERT_TYPES filter as the main feed endpoint)
 * so a stray non-feed alert (legacy comment, share notification) never
 * inflates the master's badge.
 */

import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { FEED_ALERT_TYPES } from '@/lib/notifications/feed-types';

export const GET = withAuth(async (_request, { userId, prisma }) => {
  try {
    const count = await prisma.alert.count({
      where: {
        userId,
        alertType: { in: [...FEED_ALERT_TYPES] },
        isRead: false,
      },
    });
    return NextResponse.json({ count });
  } catch (error) {
    log.error('[notifications] unread-count failed', error);
    return NextResponse.json(
      { error: 'Failed to load count', code: 'COUNT_ERROR' },
      { status: 500 },
    );
  }
});
