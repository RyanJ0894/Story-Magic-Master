/**
 * Alerts API Route
 *
 * GET /api/alerts - Get user's alerts
 * PATCH /api/alerts - Mark alerts as read
 */

import { withAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';

// =============================================================================
// Validation
// =============================================================================

const MarkAlertsReadSchema = z.object({
  alertIds: z.array(z.string().min(1)).optional(),
  markAllRead: z.boolean().optional(),
}).refine(
  (data) => (data.alertIds && data.alertIds.length > 0) || data.markAllRead,
  { message: 'Must provide alertIds or markAllRead' },
);

// =============================================================================
// GET - List alerts
// =============================================================================

export const GET = withAuth(async (request, { userId, prisma }) => {
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  try {
    // Fetch alerts with project and team info
    const alerts = await prisma.alert.findMany({
      where: {
        userId,
        ...(unreadOnly && { isRead: false }),
      },
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
        readAt: true,
        createdAt: true,
        project: {
          select: { id: true, name: true },
        },
        team: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Fetch related user profiles separately
    const relatedUserIds = Array.from(new Set(
      alerts.map((a: typeof alerts[number]) => a.relatedUserId).filter(Boolean)
    )) as string[];

    let profilesMap: Record<string, { fullName: string | null; avatarUrl: string | null }> = {};

    if (relatedUserIds.length > 0) {
      const profiles = await prisma.profile.findMany({
        where: { id: { in: relatedUserIds } },
        select: { id: true, fullName: true, avatarUrl: true },
      });

      profilesMap = Object.fromEntries(
        profiles.map((p: typeof profiles[number]) => [p.id, { fullName: p.fullName, avatarUrl: p.avatarUrl }])
      );
    }

    // Map to snake_case for client compatibility and merge profile data
    const alertsWithUsers = alerts.map((alert: typeof alerts[number]) => ({
      id: alert.id,
      alert_type: alert.alertType,
      title: alert.title,
      message: alert.message,
      project_id: alert.projectId,
      team_id: alert.teamId,
      metadata: alert.metadata,
      is_read: alert.isRead,
      read_at: alert.readAt,
      created_at: alert.createdAt,
      projects: alert.project,
      teams: alert.team,
      related_user: alert.relatedUserId
        ? profilesMap[alert.relatedUserId]
          ? {
              full_name: profilesMap[alert.relatedUserId].fullName,
              avatar_url: profilesMap[alert.relatedUserId].avatarUrl,
            }
          : null
        : null,
    }));

    // Get unread count
    const unreadCount = await prisma.alert.count({
      where: { userId, isRead: false },
    });

    return NextResponse.json({
      alerts: alertsWithUsers,
      unreadCount,
    });
  } catch (error) {
    log.error('[Alerts] Error listing', error);
    return NextResponse.json(
      {
        error: 'Failed to list alerts',
        code: 'LIST_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// PATCH - Mark alerts as read
// =============================================================================

export const PATCH = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, MarkAlertsReadSchema);
  if ('error' in parsed) return parsed.error;
  const { alertIds, markAllRead } = parsed.data;

  try {
    if (markAllRead) {
      // Mark all unread alerts as read
      await prisma.alert.updateMany({
        where: { userId, isRead: false },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    } else if (alertIds && alertIds.length > 0) {
      // Mark specific alerts as read
      await prisma.alert.updateMany({
        where: {
          userId,
          id: { in: alertIds },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[Alerts] Error marking read', error);
    return NextResponse.json(
      {
        error: 'Failed to mark alerts as read',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
