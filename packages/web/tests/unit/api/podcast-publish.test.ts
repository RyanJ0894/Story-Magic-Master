/**
 * Tests for Podcast Feed API
 * Issue #38: Audio-to-Podcast RSS distribution
 *
 * Covers:
 * - POST /api/projects/[id]/podcast — create/update podcast feed
 * - GET  /api/projects/[id]/podcast — get feed status + RSS URL
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockPodcastFeedCreate = vi.fn();
const mockPodcastFeedUpdate = vi.fn();
const mockPodcastFeedFindFirst = vi.fn();
const mockAudioOutputFindFirst = vi.fn();
const mockProjectFindFirst = vi.fn();

const mockPrisma = {
  project: { findFirst: (...args: unknown[]) => mockProjectFindFirst(...args) },
  podcastFeed: {
    create: (...args: unknown[]) => mockPodcastFeedCreate(...args),
    update: (...args: unknown[]) => mockPodcastFeedUpdate(...args),
    findFirst: (...args: unknown[]) => mockPodcastFeedFindFirst(...args),
  },
  audioOutput: { findFirst: (...args: unknown[]) => mockAudioOutputFindFirst(...args) },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

const { GET, POST } = await import('@/app/api/projects/[id]/podcast/route');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user_clerk123';

const MOCK_PROJECT = { id: PROJECT_ID, userId: USER_ID, name: 'Test Screenplay' };
const MOCK_AUDIO = {
  id: 'audio-1',
  filePath: 'https://audio.storymagicapp.net/outputs/abc123.m4a',
  durationSeconds: { toString: () => '3600' },
};
const MOCK_FEED = {
  id: 'feed-1',
  projectId: PROJECT_ID,
  episodeTitle: 'Test Screenplay — Episode 1',
  description: 'A gripping drama',
  coverArtUrl: null,
  rssFeedSlug: PROJECT_ID.slice(0, 8),
  published: true,
  publishedAt: new Date('2026-05-07'),
  createdAt: new Date('2026-05-07'),
};

function makeRequest(
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest(
    `https://example.com/api/projects/${PROJECT_ID}/podcast`,
    {
      method,
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'ok' },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}

const ROUTE_PARAMS = { params: Promise.resolve({ id: PROJECT_ID }) };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/projects/[id]/podcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockProjectFindFirst.mockResolvedValue(MOCK_PROJECT);
    mockAudioOutputFindFirst.mockResolvedValue(MOCK_AUDIO);
    mockPodcastFeedFindFirst.mockResolvedValue(null);
    mockPodcastFeedCreate.mockResolvedValue(MOCK_FEED);
  });

  it('creates a podcast feed for a project with completed audio', async () => {
    const response = await POST(
      makeRequest('POST', {
        episodeTitle: 'Test Screenplay — Episode 1',
        description: 'A gripping drama',
      }),
      ROUTE_PARAMS,
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.published).toBe(true);
    expect(json.rssUrl).toContain('/listen/');
    expect(json.rssUrl).toContain('/podcast.rss');
    expect(mockPodcastFeedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: PROJECT_ID,
          published: true,
          episodeTitle: 'Test Screenplay — Episode 1',
          description: 'A gripping drama',
        }),
      }),
    );
  });

  it('updates an existing feed instead of creating a new one', async () => {
    mockPodcastFeedFindFirst.mockResolvedValue(MOCK_FEED);
    mockPodcastFeedUpdate.mockResolvedValue({
      ...MOCK_FEED,
      episodeTitle: 'Updated Title',
    });

    const response = await POST(
      makeRequest('POST', {
        episodeTitle: 'Updated Title',
        description: 'A gripping drama',
      }),
      ROUTE_PARAMS,
    );

    expect(response.status).toBe(200);
    expect(mockPodcastFeedCreate).not.toHaveBeenCalled();
    expect(mockPodcastFeedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MOCK_FEED.id },
        data: expect.objectContaining({ episodeTitle: 'Updated Title' }),
      }),
    );
  });

  it('returns 402 when project has no completed audio', async () => {
    mockAudioOutputFindFirst.mockResolvedValue(null);

    const response = await POST(
      makeRequest('POST', { episodeTitle: 'Test', description: 'Test' }),
      ROUTE_PARAMS,
    );

    expect(response.status).toBe(402);
    const json = await response.json();
    expect(json.code).toBe('NO_AUDIO');
    expect(mockPodcastFeedCreate).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const response = await POST(
      makeRequest('POST', { episodeTitle: 'Test', description: 'Test' }),
      ROUTE_PARAMS,
    );

    expect(response.status).toBe(401);
  });

  it('returns 404 when project not found', async () => {
    mockProjectFindFirst.mockResolvedValue(null);

    const response = await POST(
      makeRequest('POST', { episodeTitle: 'Test', description: 'Test' }),
      ROUTE_PARAMS,
    );

    expect(response.status).toBe(404);
  });

  it('returns 400 for missing required fields', async () => {
    const response = await POST(
      makeRequest('POST', { episodeTitle: '' }),
      ROUTE_PARAMS,
    );

    expect(response.status).toBe(400);
    expect(mockPodcastFeedCreate).not.toHaveBeenCalled();
  });
});

describe('GET /api/projects/[id]/podcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockProjectFindFirst.mockResolvedValue(MOCK_PROJECT);
    mockPodcastFeedFindFirst.mockResolvedValue(MOCK_FEED);
  });

  it('returns feed status and RSS URL when feed exists', async () => {
    const response = await GET(makeRequest('GET'), ROUTE_PARAMS);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.published).toBe(true);
    expect(json.rssFeedSlug).toBe(MOCK_FEED.rssFeedSlug);
    expect(json.rssUrl).toContain(`/listen/${MOCK_FEED.rssFeedSlug}/podcast.rss`);
  });

  it('returns unpublished status when no feed exists', async () => {
    mockPodcastFeedFindFirst.mockResolvedValue(null);

    const response = await GET(makeRequest('GET'), ROUTE_PARAMS);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.published).toBe(false);
    expect(json.rssUrl).toBeNull();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const response = await GET(makeRequest('GET'), ROUTE_PARAMS);

    expect(response.status).toBe(401);
  });
});
