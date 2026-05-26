import { withAuth, errorResponse } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

/**
 * GET /api/projects/[id]/shares
 *
 * Returns all shares for a project with per-share engagement data.
 * Only accessible by the project owner.
 *
 * Response shape:
 *   {
 *     shares: Array<{
 *       id, shareCode, recipientEmail, recipientName,
 *       accessLevel, expiresAt, isActive, createdAt,
 *       viewCount, playCount,
 *       hasListened: boolean,      // playCount > 0
 *       lastAccessedAt: Date|null,
 *     }>
 *     summary: { total, listened, opened, notOpened }
 *   }
 */
export const GET = withAuth(async (_request, { userId, prisma, params }) => {
  const projectId = (params as { id: string }).id;

  if (!projectId) {
    return errorResponse('Missing project id', 400);
  }

  // Verify ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, name: true },
  });

  if (!project) {
    return errorResponse('Project not found or not authorized', 404);
  }

  try {
    const shares = await prisma.scriptShare.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        shareCode: true,
        recipientEmail: true,
        recipientName: true,
        accessLevel: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        viewCount: true,
        playCount: true,
        lastAccessedAt: true,
      },
    });

    const enriched = shares.map((share) => ({
      ...share,
      hasListened: (share.playCount ?? 0) > 0,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/s/${share.shareCode}`,
    }));

    // Summary metrics
    const total = enriched.length;
    const listened = enriched.filter((s) => s.hasListened).length;
    const opened = enriched.filter((s) => (s.viewCount ?? 0) > 0).length;
    const notOpened = total - opened;

    return NextResponse.json({
      project: { id: project.id, name: project.name },
      shares: enriched,
      summary: { total, listened, opened, notOpened },
    });
  } catch (error) {
    log.error('[ShareDashboard] Failed to fetch shares', error);
    return errorResponse('Failed to fetch shares', 500);
  }
});

/**
 * PATCH /api/projects/[id]/shares
 * Bulk deactivate all shares for this project.
 * Body: { action: 'deactivate_all' }
 */
export const PATCH = withAuth(async (request, { userId, prisma, params }) => {
  const projectId = (params as { id: string }).id;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });

  if (!project) {
    return errorResponse('Project not found or not authorized', 404);
  }

  let body: { action?: string } = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid request body', 400);
  }

  if (body.action !== 'deactivate_all') {
    return errorResponse('Unknown action', 400);
  }

  const result = await prisma.scriptShare.updateMany({
    where: { projectId, isActive: true },
    data: { isActive: false },
  });

  return NextResponse.json({ deactivated: result.count });
});
