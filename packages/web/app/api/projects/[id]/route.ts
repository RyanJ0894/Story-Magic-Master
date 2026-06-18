/**
 * Single Project API Route
 *
 * GET /api/projects/[id] - Get a single project by ID
 * PATCH /api/projects/[id] - Update a project
 * DELETE /api/projects/[id] - Delete a project
 */

import { withProjectAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateProject, deleteProject } from '@/lib/services/projects';
import { logReadAccess, logDeletion, AuditActions, ResourceTypes } from '@/lib/api/audit';

// =============================================================================
// Input Validation
// =============================================================================

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  script_text: z.string().optional(),
  page_count: z.number().int().min(0).max(150).optional(),
});

// =============================================================================
// GET - Fetch a single project
// =============================================================================

export const GET = withProjectAuth(async (request, { userId, projectId, project, prisma }) => {
  void logReadAccess({ userId, projectId, action: AuditActions.PROJECT_READ, request });

  // #331 (2026-06-17): fire master-notification on the first time a
  // sub-account opens a project. Detection via ContentAccessLog: write
  // an `accessType: 'open'` row on every GET, then emit only when the
  // count BEFORE this write was zero. Best-effort — failure here cannot
  // break the project fetch. The producer separately skips when actor
  // IS the project owner so masters don't get pinged about their own
  // opens.
  void (async () => {
    try {
      const priorOpens = await prisma.contentAccessLog.count({
        where: { userId, projectId, accessType: 'open' },
      });
      await prisma.contentAccessLog.create({
        data: { userId, projectId, accessType: 'open' },
      });
      if (priorOpens === 0) {
        const { emitProjectOpenedFirstTime } = await import('@/lib/notifications/producers');
        await emitProjectOpenedFirstTime(prisma, { projectId, actorUserId: userId });
      }
    } catch {
      // swallow — notification is best-effort
    }
  })();

  return NextResponse.json({ project });
});

// =============================================================================
// PATCH - Update a project
// =============================================================================

export const PATCH = withProjectAuth(async (request, { prisma, projectId }) => {
  const parsed = await parseBody(request, UpdateProjectSchema);
  if ('error' in parsed) return parsed.error;

  const { name, script_text, page_count } = parsed.data;

  try {
    const project = await updateProject(prisma, projectId, {
      name,
      scriptText: script_text,
      pageCount: page_count,
    });

    return NextResponse.json({ project });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update project', code: 'UPDATE_ERROR' },
      { status: 500 }
    );
  }
});

// =============================================================================
// DELETE - Delete a project
// =============================================================================

export const DELETE = withProjectAuth(async (request, { userId, prisma, projectId }) => {
  try {
    await deleteProject(prisma, projectId);
    void logDeletion({ userId, resourceType: ResourceTypes.PROJECT, resourceId: projectId, action: AuditActions.PROJECT_DELETE, request });
    return NextResponse.json({ success: true, deleted: projectId });
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete project', code: 'DELETE_ERROR' },
      { status: 500 }
    );
  }
});
