/**
 * GET /api/writers/[writerId]
 * Public writer profile + their listed scripts
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type Params = { params: Promise<{ writerId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { writerId } = await params;

  const profile = await prisma.profile.findUnique({
    where: { id: writerId },
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      createdAt: true,
      _count: {
        select: {
          projects: { where: { exchangeIsPublic: true } },
          writerSubscriptions: true,
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Writer not found' }, { status: 404 });
  }

  const scripts = await prisma.project.findMany({
    where: { userId: writerId, exchangeIsPublic: true },
    orderBy: { exchangeListedAt: 'desc' },
    select: {
      id: true,
      exchangeSlug: true,
      name: true,
      exchangeTagline: true,
      exchangeGenre: true,
      exchangeListedAt: true,
      pageCount: true,
      page1PreviewUrl: true,
      _count: { select: { scriptReviews: true } },
    },
  });

  return NextResponse.json({
    writer: {
      id: profile.id,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      memberSince: profile.createdAt,
      listedScripts: profile._count.projects,
      subscribers: profile._count.writerSubscriptions,
    },
    scripts: scripts.map((s) => ({
      id: s.id,
      slug: s.exchangeSlug,
      name: s.name,
      tagline: s.exchangeTagline,
      genre: s.exchangeGenre,
      listedAt: s.exchangeListedAt,
      pageCount: s.pageCount,
      hasPreview: !!s.page1PreviewUrl,
      reviewCount: s._count.scriptReviews,
    })),
  });
}
