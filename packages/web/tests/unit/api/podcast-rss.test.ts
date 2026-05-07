/**
 * Tests for Podcast RSS Feed Route
 * Issue #38: Audio-to-Podcast RSS distribution
 *
 * Covers:
 * - GET /listen/[code]/podcast.rss — serve RSS 2.0 XML
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPodcastFeedFindFirst = vi.fn();
const mockAudioOutputFindFirst = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    podcastFeed: {
      findFirst: (...args: unknown[]) => mockPodcastFeedFindFirst(...args),
    },
    audioOutput: {
      findFirst: (...args: unknown[]) => mockAudioOutputFindFirst(...args),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

const { GET } = await import('@/app/listen/[code]/podcast.rss/route');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SLUG = '550e8400';

const MOCK_FEED = {
  id: 'feed-1',
  projectId: '550e8400-e29b-41d4-a716-446655440000',
  episodeTitle: 'The Dark Room',
  description: 'A gripping noir drama set in 1940s Chicago.',
  coverArtUrl: null,
  rssFeedSlug: SLUG,
  published: true,
  publishedAt: new Date('2026-05-07T10:00:00Z'),
  createdAt: new Date('2026-05-07T10:00:00Z'),
  project: {
    name: 'The Dark Room',
    user: { fullName: 'Jane Doe' },
  },
};

const MOCK_AUDIO = {
  filePath: 'https://audio.storymagicapp.net/outputs/abc123.m4a',
  durationSeconds: { toString: () => '3723' }, // 1h 2m 3s
  fileSize: 52428800,
};

function makeRequest(slug: string): NextRequest {
  return new NextRequest(`https://example.com/listen/${slug}/podcast.rss`);
}

const ROUTE_PARAMS = { params: Promise.resolve({ code: SLUG }) };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /listen/[code]/podcast.rss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPodcastFeedFindFirst.mockResolvedValue(MOCK_FEED);
    mockAudioOutputFindFirst.mockResolvedValue(MOCK_AUDIO);
  });

  it('returns RSS 2.0 XML with correct content-type', async () => {
    const response = await GET(makeRequest(SLUG), ROUTE_PARAMS);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/rss+xml');
  });

  it('includes required RSS 2.0 elements', async () => {
    const response = await GET(makeRequest(SLUG), ROUTE_PARAMS);
    const xml = await response.text();

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<channel>');
    expect(xml).toContain('<title>The Dark Room</title>');
    expect(xml).toContain('<item>');
    expect(xml).toContain('</channel>');
    expect(xml).toContain('</rss>');
  });

  it('includes enclosure with audio URL, type, and length', async () => {
    const response = await GET(makeRequest(SLUG), ROUTE_PARAMS);
    const xml = await response.text();

    expect(xml).toContain('https://audio.storymagicapp.net/outputs/abc123.m4a');
    expect(xml).toContain('audio/mp4');
    expect(xml).toContain('<enclosure');
  });

  it('includes itunes:duration in HH:MM:SS format', async () => {
    const response = await GET(makeRequest(SLUG), ROUTE_PARAMS);
    const xml = await response.text();

    // 3723 seconds = 1:02:03
    expect(xml).toContain('<itunes:duration>1:02:03</itunes:duration>');
  });

  it('returns 404 when feed not found', async () => {
    mockPodcastFeedFindFirst.mockResolvedValue(null);

    const response = await GET(makeRequest('notfound'), {
      params: Promise.resolve({ code: 'notfound' }),
    });

    expect(response.status).toBe(404);
  });

  it('returns 404 when feed is not published', async () => {
    // The route queries with `where: { published: true }` — a non-published feed
    // is invisible to that query, so the DB returns null.
    mockPodcastFeedFindFirst.mockResolvedValue(null);

    const response = await GET(makeRequest(SLUG), ROUTE_PARAMS);

    expect(response.status).toBe(404);
  });

  it('returns 404 when audio output is missing', async () => {
    mockAudioOutputFindFirst.mockResolvedValue(null);

    const response = await GET(makeRequest(SLUG), ROUTE_PARAMS);

    expect(response.status).toBe(404);
  });
});
