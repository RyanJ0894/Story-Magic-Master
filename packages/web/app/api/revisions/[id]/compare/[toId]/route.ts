/**
 * DEPRECATED: Top-level Revision Compare Route
 *
 * This route is deprecated in favor of the project-scoped route:
 *   GET /api/projects/[id]/revisions/compare?from=xxx&to=yyy
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

export const GET = withAuth(async (request, { params }) => {
  const projectId = await getProjectIdForRevision(params.id);
  if (!projectId) {
    return NextResponse.json({ error: 'Revision not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const url = new URL(request.url);
  url.pathname = `/api/projects/${projectId}/revisions/compare`;
  url.searchParams.set('from', params.id);
  url.searchParams.set('to', params.toId);
  return NextResponse.redirect(url.toString(), 308);
});
