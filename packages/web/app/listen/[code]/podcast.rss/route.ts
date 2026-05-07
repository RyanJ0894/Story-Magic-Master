import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.storymagicapp.net';

interface RouteParams {
  params: Promise<{ code: string }>;
}

function secondsToHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { code } = await params;

  const feed = await prisma.podcastFeed.findFirst({
    where: { rssFeedSlug: code, published: true },
    include: {
      project: {
        select: {
          name: true,
          user: { select: { fullName: true } },
        },
      },
    },
  });

  if (!feed) {
    return new NextResponse('Feed not found', { status: 404 });
  }

  const audio = await prisma.audioOutput.findFirst({
    where: { projectId: feed.projectId },
    orderBy: { createdAt: 'desc' },
    select: { filePath: true, durationSeconds: true, fileSize: true },
  });

  if (!audio) {
    return new NextResponse('Audio not available', { status: 404 });
  }

  const durationSecs = Number(audio.durationSeconds?.toString() ?? '0');
  const pubDate = (feed.publishedAt ?? feed.createdAt).toUTCString();
  const feedUrl = `${APP_URL}/listen/${code}/podcast.rss`;
  const pageUrl = `${APP_URL}/listen/${code}/podcast`;

  const coverTag = feed.coverArtUrl
    ? `<image>
      <url>${escapeXml(feed.coverArtUrl)}</url>
      <title>${escapeXml(feed.episodeTitle)}</title>
      <link>${escapeXml(pageUrl)}</link>
    </image>
    <itunes:image href="${escapeXml(feed.coverArtUrl)}" />`
    : '';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(feed.episodeTitle)}</title>
    <link>${escapeXml(pageUrl)}</link>
    <description>${escapeXml(feed.description)}</description>
    <language>en-us</language>
    <pubDate>${pubDate}</pubDate>
    <lastBuildDate>${pubDate}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />
    <itunes:author>${escapeXml(feed.project.user?.fullName ?? 'Story Magic')}</itunes:author>
    <itunes:summary>${escapeXml(feed.description)}</itunes:summary>
    ${coverTag}
    <item>
      <title>${escapeXml(feed.episodeTitle)}</title>
      <description>${escapeXml(feed.description)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">${escapeXml(feed.id)}</guid>
      <enclosure url="${escapeXml(audio.filePath)}" type="audio/mp4" length="${audio.fileSize ?? 0}" />
      <itunes:duration>${secondsToHms(durationSecs)}</itunes:duration>
      <itunes:summary>${escapeXml(feed.description)}</itunes:summary>
    </item>
  </channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
