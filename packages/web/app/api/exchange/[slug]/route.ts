/**
 * GET /api/exchange/[slug] — single exchange listing detail
 * Public — no auth required for reading
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;

  const project = await prisma.project.findFirst({
    where: { exchangeSlug: slug, exchangeIsPublic: true },
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
          _count: {
            select: {
              projects: { where: { exchangeIsPublic: true } },
              writerSubscriptions: true,
            },
          },
        },
      },
      scriptReviews: {
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          verdict: true,
          numericRating: true,
          comment: true,
          isAnonymous: true,
          createdAt: true,
          reviewerId: true,
          reviewerName: true,
          reviewer: {
            select: { fullName: true, avatarUrl: true },
          },
        },
      },
      _count: { select: { scriptReviews: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Aggregate rating
  const ratings = project.scriptReviews
    .map((r) => r.numericRating)
    .filter((n): n is number => n !== null && n !== undefined);
  const avgRating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : null;

  const verdictCounts = project.scriptReviews.reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return NextResponse.json({
    project: {
      id: project.id,
      slug: project.exchangeSlug,
      name: project.name,
      tagline: project.exchangeTagline,
      genre: project.exchangeGenre,
      listedAt: project.exchangeListedAt,
      pageCount: project.pageCount,
      previewUrl: project.page1PreviewUrl,
    },
    writer: {
      id: project.userId,
      fullName: project.user.fullName,
      avatarUrl: project.user.avatarUrl,
      listedCount: project.user._count.projects,
      subscriberCount: project.user._count.writerSubscriptions,
    },
    reviews: project.scriptReviews.map((r) => ({
      id: r.id,
      verdict: r.verdict,
      numericRating: r.numericRating,
      comment: r.comment,
      createdAt: r.createdAt,
      reviewer: r.isAnonymous
        ? { id: null, fullName: 'Anonymous', avatarUrl: null }
        : {
            id: r.reviewerId,
            fullName: r.reviewer.fullName ?? r.reviewerName,
            avatarUrl: r.reviewer.avatarUrl,
          },
    })),
    stats: {
      totalReviews: project._count.scriptReviews,
      avgRating,
      verdictCounts,
    },
  });
}
