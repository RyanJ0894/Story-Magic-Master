/**
 * DEPRECATED: Top-level Revision Route
 *
 * This route is deprecated in favor of the project-scoped routes:
 *   GET/POST  /api/projects/[id]/revisions
 *   Individual revision operations should go through project-scoped routes.
 *
 * Kept for backwards compatibility. Returns 308 permanent redirects
 * to guide clients toward the canonical project-scoped endpoints.
 */

import { withAuth } from '@/lib/api/middleware';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

async function getProjectIdForRevision(revisionId: string): Promise<string | null> {
  const revision = await prisma.revision.findUnique({
    where: { id: revisionId },
    select: { projectId: true },
  });
  return revision?.projectId ?? null;
}

function buildRedirectUrl(request: Request, projectId: string): string {
  const url = new URL(request.url);
  url.pathname = `/api/projects/${projectId}/revisions`;
  return url.toString();
}

export const GET = withAuth(async (request, { params }) => {
  const projectId = await getProjectIdForRevision(params.id);
  if (!projectId) {
    return NextResponse.json({ error: 'Revision not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.redirect(buildRedirectUrl(request, projectId), 308);
});

export const PUT = withAuth(async (request, { params }) => {
  const projectId = await getProjectIdForRevision(params.id);
  if (!projectId) {
    return NextResponse.json({ error: 'Revision not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.redirect(buildRedirectUrl(request, projectId), 308);
});

export const DELETE = withAuth(async (request, { params }) => {
  const projectId = await getProjectIdForRevision(params.id);
  if (!projectId) {
    return NextResponse.json({ error: 'Revision not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.redirect(buildRedirectUrl(request, projectId), 308);
});
