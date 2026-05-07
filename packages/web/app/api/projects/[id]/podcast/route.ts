import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withProjectAuth, parseBody } from '@/lib/api/middleware';
import { errorResponse } from '@/lib/api/error-response';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.storymagicapp.net';

function buildRssUrl(slug: string): string {
  return `${APP_URL}/listen/${slug}/podcast.rss`;
}

const PublishPodcastSchema = z.object({
  episodeTitle: z.string().min(1, 'Episode title is required').max(200),
  description: z.string().min(1, 'Description is required').max(4000),
  coverArtUrl: z.string().url().optional(),
});

// GET /api/projects/[id]/podcast — get feed status
export const GET = withProjectAuth(async (_request, { prisma, projectId }) => {
  const feed = await prisma.podcastFeed.findFirst({
    where: { projectId },
  });

  if (!feed) {
    return NextResponse.json({ published: false, rssUrl: null });
  }

  return NextResponse.json({
    published: feed.published,
    rssFeedSlug: feed.rssFeedSlug,
    episodeTitle: feed.episodeTitle,
    description: feed.description,
    coverArtUrl: feed.coverArtUrl,
    publishedAt: feed.publishedAt,
    rssUrl: buildRssUrl(feed.rssFeedSlug),
  });
});

// POST /api/projects/[id]/podcast — create or update podcast feed
export const POST = withProjectAuth(async (request, { prisma, projectId, userId }) => {
  const parsed = await parseBody(request, PublishPodcastSchema);
  if ('error' in parsed) return parsed.error;

  const { episodeTitle, description, coverArtUrl } = parsed.data;

  // Require completed audio output before allowing publish
  const audio = await prisma.audioOutput.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (!audio) {
    return errorResponse(
      'Project must have completed audio before publishing as podcast',
      402,
      { code: 'NO_AUDIO' },
    );
  }

  const existing = await prisma.podcastFeed.findFirst({ where: { projectId } });

  if (existing) {
    const feed = await prisma.podcastFeed.update({
      where: { id: existing.id },
      data: {
        episodeTitle,
        description,
        coverArtUrl: coverArtUrl ?? null,
        published: true,
        publishedAt: existing.publishedAt ?? new Date(),
      },
    });

    return NextResponse.json({
      published: feed.published,
      rssFeedSlug: feed.rssFeedSlug,
      rssUrl: buildRssUrl(feed.rssFeedSlug),
    });
  }

  const rssFeedSlug = projectId.slice(0, 8);

  const feed = await prisma.podcastFeed.create({
    data: {
      projectId,
      userId,
      episodeTitle,
      description,
      coverArtUrl: coverArtUrl ?? null,
      rssFeedSlug,
      published: true,
      publishedAt: new Date(),
    },
  });

  return NextResponse.json({
    published: feed.published,
    rssFeedSlug: feed.rssFeedSlug,
    rssUrl: buildRssUrl(feed.rssFeedSlug),
  });
});
