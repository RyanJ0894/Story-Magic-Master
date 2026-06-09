/**
 * Master-account notification feed (#174).
 *
 * GET /api/master/notifications
 *   Paginated alerts for the current user, filtered to feed-worthy types
 *   only (FEED_ALERT_TYPES — see lib/notifications/feed-types.ts).
 *
 *   Query params:
 *     limit   number  (1..50, default 20)
 *     cursor  string  base64-encoded "<createdAt>|<id>" from previous response
 *     unread  boolean ('true' = unread only)
 *
 *   Response:
 *     {
 *       notifications: Array<{
 *         id, alert_type, severity, title, message,
 *         project_id, team_id, related_user_id, metadata,
 *         is_read, created_at,
 *         project: { id, name } | null,
 *         team: { id, name } | null,
 *         related_user: { full_name, avatar_url } | null,
 *       }>,
 *       nextCursor: string | null,
 *       unreadCount: number,
 *     }
 *
 * Scoping: Alert.userId is the recipient. Producers (see PR β / #174-2)
 * emit alert rows with userId = master's user ID when a sub-account event
 * fires. This route therefore only needs to filter by the current Clerk
 * user — the producer is responsible for routing to the right master.
 *
 * Note: the existing /api/alerts route returns ALL alert types (including
 * UI events like comments, shares, etc.) and stays the source of truth
 * for the legacy alerts page. This route is purpose-built for the
 * enterprise notification feed and intentionally narrower.
 */

import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { FEED_ALERT_TYPES, severityFor } from '@/lib/notifications/feed-types';

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

/**
 * Cursor format: base64("<ISO createdAt>|<id>"). The id is the tiebreaker
 * for identical createdAt values (unusual but possible under heavy load).
 */
function decodeCursor(raw: string | null): { createdAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    const [iso, id] = decoded.split('|');
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf-8').toString('base64');
}

export const GET = withAuth(async (request, { userId, prisma }) => {
  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
  const limit = Math.min(Math.max(1, Number.isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit), MAX_LIMIT);
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const cursor = decodeCursor(url.searchParams.get('cursor'));

  try {
    // Build the WHERE clause. We always filter by the recipient (userId)
    // AND by feed-worthy alertTypes. Cursor pagination uses
    // (createdAt, id) tuple comparison so duplicates can't slip through.
    const where: Record<string, unknown> = {
      userId,
      alertType: { in: [...FEED_ALERT_TYPES] },
    };
    if (unreadOnly) where.isRead = false;
    if (cursor) {
      where.OR = [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ];
    }

    // Over-fetch by 1 to detect whether there's a next page.
    const rows = await prisma.alert.findMany({
      where,
      select: {
        id: true,
        alertType: true,
        title: true,
        message: true,
        projectId: true,
        teamId: true,
        relatedUserId: true,
        metadata: true,
        isRead: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    // Resolve related user profiles in one batch — same pattern as
    // /api/alerts to keep the producer + reader contracts identical.
    const relatedUserIds = Array.from(
      new Set(page.map((a) => a.relatedUserId).filter((x): x is string => !!x)),
    );

    let profilesMap: Record<string, { fullName: string | null; avatarUrl: string | null }> = {};
    if (relatedUserIds.length > 0) {
      const profiles = await prisma.profile.findMany({
        where: { id: { in: relatedUserIds } },
        select: { id: true, fullName: true, avatarUrl: true },
      });
      profilesMap = Object.fromEntries(
        profiles.map((p) => [p.id, { fullName: p.fullName, avatarUrl: p.avatarUrl }]),
      );
    }

    const notifications = page.map((alert) => ({
      id: alert.id,
      alert_type: alert.alertType,
      severity: severityFor(alert.alertType),
      title: alert.title,
      message: alert.message,
      project_id: alert.projectId,
      team_id: alert.teamId,
      related_user_id: alert.relatedUserId,
      metadata: alert.metadata,
      is_read: alert.isRead,
      created_at: alert.createdAt,
      project: alert.project,
      team: alert.team,
      related_user: alert.relatedUserId
        ? profilesMap[alert.relatedUserId]
          ? {
              full_name: profilesMap[alert.relatedUserId].fullName,
              avatar_url: profilesMap[alert.relatedUserId].avatarUrl,
            }
          : null
        : null,
    }));

    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    // Unread count is feed-scoped (not all-alerts) so the bell badge
    // reflects only enterprise-relevant pending items.
    const unreadCount = await prisma.alert.count({
      where: {
        userId,
        alertType: { in: [...FEED_ALERT_TYPES] },
        isRead: false,
      },
    });

    return NextResponse.json({ notifications, nextCursor, unreadCount });
  } catch (error) {
    log.error('[notifications] feed query failed', error);
    return NextResponse.json(
      {
        error: 'Failed to load notifications',
        code: 'NOTIFICATIONS_LIST_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});
