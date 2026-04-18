/**
 * GET /api/exchange — browse public exchange listings
 * Paginated, filterable by genre, sorted by listed_at desc
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const genre = searchParams.get('genre') ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const skip = (page - 1) * PAGE_SIZE;

  const where = {
    exchangeIsPublic: true,
    exchangeListedAt: { not: null },
    ...(genre ? { exchangeGenre: genre } : {}),
  };

  const [listings, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { exchangeListedAt: 'desc' },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        exchangeSlug: true,
        name: true,
        exchangeTagline: true,
        exchangeGenre: true,
        exchangeListedAt: true,
        pageCount: true,
        page1PreviewUrl: true,
        userId: true,
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        _count: { select: { scriptReviews: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  const genres = await prisma.project.findMany({
    where: { exchangeIsPublic: true, exchangeGenre: { not: null } },
    distinct: ['exchangeGenre'],
    select: { exchangeGenre: true },
  });

  return NextResponse.json({
    listings: listings.map((l) => ({
      id: l.id,
      slug: l.exchangeSlug,
      name: l.name,
      tagline: l.exchangeTagline,
      genre: l.exchangeGenre,
      listedAt: l.exchangeListedAt,
      pageCount: l.pageCount,
      hasPreview: !!l.page1PreviewUrl,
      reviewCount: l._count.scriptReviews,
      writer: l.user,
    })),
    genres: genres.map((g) => g.exchangeGenre).filter(Boolean),
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  });
}
