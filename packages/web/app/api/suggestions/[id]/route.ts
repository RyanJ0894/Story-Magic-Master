/**
 * DEPRECATED: Top-level Suggestion Route
 *
 * This route is deprecated in favor of the project-scoped route:
 *   /api/projects/[id]/suggestions/[suggestionId]
 *
 * Kept for backwards compatibility. Returns 308 permanent redirects
 * to guide clients toward the canonical project-scoped endpoints.
 */

import { withAuth } from '@/lib/api/middleware';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

async function getProjectIdForSuggestion(suggestionId: string): Promise<string | null> {
  const suggestion = await prisma.suggestion.findUnique({
    where: { id: suggestionId },
    select: { projectId: true },
  });
  return suggestion?.projectId ?? null;
}

function buildRedirectUrl(request: Request, projectId: string, suggestionId: string): string {
  const url = new URL(request.url);
  url.pathname = `/api/projects/${projectId}/suggestions/${suggestionId}`;
  return url.toString();
}

export const GET = withAuth(async (request, { params }) => {
  const projectId = await getProjectIdForSuggestion(params.id);
  if (!projectId) {
    return NextResponse.json({ error: 'Suggestion not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.redirect(buildRedirectUrl(request, projectId, params.id), 308);
});

export const PUT = withAuth(async (request, { params }) => {
  const projectId = await getProjectIdForSuggestion(params.id);
  if (!projectId) {
    return NextResponse.json({ error: 'Suggestion not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.redirect(buildRedirectUrl(request, projectId, params.id), 308);
});

export const DELETE = withAuth(async (request, { params }) => {
  const projectId = await getProjectIdForSuggestion(params.id);
  if (!projectId) {
    return NextResponse.json({ error: 'Suggestion not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.redirect(buildRedirectUrl(request, projectId, params.id), 308);
});
