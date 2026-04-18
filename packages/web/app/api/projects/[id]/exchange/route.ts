/**
 * Writer manages their Exchange listing
 *
 * GET    /api/projects/[id]/exchange — current listing state
 * POST   /api/projects/[id]/exchange — create / update listing (list or edit)
 * DELETE /api/projects/[id]/exchange — unlist (keeps slug, sets is_public=false)
 */

import { withProjectAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const GENRES = [
  'drama', 'comedy', 'thriller', 'horror', 'sci-fi',
  'fantasy', 'action', 'romance', 'documentary', 'animation', 'other',
] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

async function uniqueSlug(prisma: Parameters<typeof withProjectAuth>[0] extends (...a: infer A) => unknown ? never : never, base: string, excludeId: string): Promise<string> {
  // inline helper — keep it simple
  return base; // resolved below
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
void uniqueSlug;

const ListingSchema = z.object({
  tagline: z.string().min(1).max(280),
  genre: z.enum(GENRES),
  is_public: z.boolean().optional().default(true),
});

// ---------------------------------------------------------------------------
// GET — current listing state for the writer
// ---------------------------------------------------------------------------
export const GET = withProjectAuth(async (_request, { project }) => {
  return NextResponse.json({
    listing: {
      isPublic: (project as Record<string, unknown>).exchangeIsPublic ?? false,
      listedAt: (project as Record<string, unknown>).exchangeListedAt ?? null,
      slug: (project as Record<string, unknown>).exchangeSlug ?? null,
      tagline: (project as Record<string, unknown>).exchangeTagline ?? null,
      genre: (project as Record<string, unknown>).exchangeGenre ?? null,
    },
  });
});

// ---------------------------------------------------------------------------
// POST — list or update listing
// ---------------------------------------------------------------------------
export const POST = withProjectAuth(async (request, { prisma, projectId, project }) => {
  const parsed = await parseBody(request, ListingSchema);
  if ('error' in parsed) return parsed.error;

  const { tagline, genre, is_public } = parsed.data;

  // Determine slug — keep existing or create new
  let slug = (project as Record<string, unknown>).exchangeSlug as string | null;
  if (!slug) {
    const base = slugify((project as Record<string, unknown>).name as string ?? projectId);
    // Ensure uniqueness by appending short project ID suffix if needed
    const candidate = `${base}-${projectId.slice(0, 6)}`;
    const existing = await prisma.project.findFirst({
      where: { exchangeSlug: candidate, id: { not: projectId } },
      select: { id: true },
    });
    slug = existing ? `${candidate}-${Date.now().toString(36)}` : candidate;
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      exchangeSlug: slug,
      exchangeTagline: tagline,
      exchangeGenre: genre,
      exchangeIsPublic: is_public,
      exchangeListedAt: is_public
        ? ((project as Record<string, unknown>).exchangeListedAt as Date | null | undefined) ?? new Date()
        : ((project as Record<string, unknown>).exchangeListedAt as Date | null | undefined) ?? null,
    },
    select: {
      exchangeSlug: true,
      exchangeTagline: true,
      exchangeGenre: true,
      exchangeIsPublic: true,
      exchangeListedAt: true,
    },
  });

  return NextResponse.json({ listing: updated });
});

// ---------------------------------------------------------------------------
// DELETE — unlist (keep slug/metadata, just flip is_public=false)
// ---------------------------------------------------------------------------
export const DELETE = withProjectAuth(async (_request, { prisma, projectId }) => {
  await prisma.project.update({
    where: { id: projectId },
    data: { exchangeIsPublic: false },
  });
  return NextResponse.json({ unlisted: true });
});
