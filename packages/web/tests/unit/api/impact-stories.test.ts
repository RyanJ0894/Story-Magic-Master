/**
 * Tests for Impact Stories API Routes
 *
 * GET  /api/impact/stories — public gallery (approved, public, complete)
 * POST /api/impact/stories — create a new impact story (authenticated)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// Mocks
// =============================================================================

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  impactStory: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Mock AI SDK generateText
const mockGenerateText = vi.fn().mockResolvedValue({ text: 'Expanded story text for testing purposes...' });
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

// Mock AI providers (resolveModel just needs to return something)
vi.mock('@/lib/ai/providers', () => ({
  resolveModel: vi.fn().mockReturnValue('mock-model'),
  MODELS: { PRODUCTION: 'claude-sonnet-4-6' },
}));

// Mock impact category lookup
vi.mock('@/lib/impact/categories', () => ({
  getCategoryById: vi.fn().mockReturnValue({ id: 'justice', label: 'Justice & Advocacy' }),
}));

// Mock impact limits — export the real constants so word count validation works
vi.mock('@/lib/impact/limits', () => ({
  STORY_WORD_LIMIT: 800,
  STORY_WORD_MIN: 30,
  STORY_RATE_LIMIT_HOURS: 24,
  countWords: (text: string) => text.trim().split(/\s+/).filter(Boolean).length,
}));

// Mock email alerts (fire-and-forget, non-fatal)
vi.mock('@/lib/email/impact', () => ({
  sendStorySubmittedAlert: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks
const { GET, POST } = await import('@/app/api/impact/stories/route');

// =============================================================================
// Helpers
// =============================================================================

const BASE_URL = 'http://localhost:22000/api/impact/stories';

function createRequest(
  url: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
  } = {},
): NextRequest {
  const init: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:22000',
    },
  };
  if (options.body) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(url, init);
}

// A story with 50 words — above the 30-word minimum
const VALID_STORY_TEXT =
  'This is my story about seeking justice for my family after a wrongful experience. ' +
  'It changed everything I believed about fairness and the legal system. ' +
  'I fought for three years before the truth came out. Now I help others do the same.';

const mockStory = {
  id: 'story-001',
  userId: 'user_test123',
  title: 'My Journey',
  category: 'justice',
  storyText: VALID_STORY_TEXT,
  expandedText: 'Expanded story text for testing purposes...',
  authorName: 'Alex Smith',
  authorCity: 'New York',
  isPublic: true,
  isApproved: true,
  status: 'complete',
  prizeEligible: true,
  audioUrl: null,
  playCount: 0,
  createdAt: new Date('2026-03-15T10:00:00Z'),
  updatedAt: new Date('2026-03-15T10:00:00Z'),
};

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'user_test123' });
  mockPrisma.impactStory.findMany.mockResolvedValue([mockStory]);
  mockPrisma.impactStory.count.mockResolvedValue(0); // 0 = not rate-limited by default
  mockPrisma.impactStory.create.mockResolvedValue({ ...mockStory, status: 'draft' });
});

// =============================================================================
// GET /api/impact/stories
// =============================================================================

describe('GET /api/impact/stories', () => {
  it('returns paginated approved public stories', async () => {
    mockPrisma.impactStory.count.mockResolvedValue(1);

    const req = createRequest(BASE_URL);
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stories).toHaveLength(1);
    expect(data.stories[0].id).toBe('story-001');
    expect(data.stories[0].title).toBe('My Journey');
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.pages).toBe(1);
  });

  it('filters stories by ?category= query param', async () => {
    mockPrisma.impactStory.count.mockResolvedValue(1);

    const req = createRequest(`${BASE_URL}?category=justice`);
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // Verify prisma was called with the category filter
    const findManyCall = mockPrisma.impactStory.findMany.mock.calls[0][0];
    expect(findManyCall.where.category).toBe('justice');
    const countCall = mockPrisma.impactStory.count.mock.calls[0][0];
    expect(countCall.where.category).toBe('justice');
  });

  it('returns empty array when no stories match', async () => {
    mockPrisma.impactStory.findMany.mockResolvedValue([]);
    mockPrisma.impactStory.count.mockResolvedValue(0);

    const req = createRequest(BASE_URL);
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stories).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.pages).toBe(0);
  });

  it('paginates using ?page= query param', async () => {
    mockPrisma.impactStory.count.mockResolvedValue(25);

    const req = createRequest(`${BASE_URL}?page=2`);
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.page).toBe(2);
    expect(data.pages).toBe(3); // 25 stories / 12 per page = 3 pages
    const findManyCall = mockPrisma.impactStory.findMany.mock.calls[0][0];
    expect(findManyCall.skip).toBe(12); // page 2 offset
  });
});

// =============================================================================
// POST /api/impact/stories
// =============================================================================

describe('POST /api/impact/stories', () => {
  it('creates a new story with status=draft and returns 201', async () => {
    const draftStory = { ...mockStory, status: 'draft' };
    mockPrisma.impactStory.create.mockResolvedValue(draftStory);

    const req = createRequest(BASE_URL, {
      method: 'POST',
      body: {
        title: 'My Journey',
        category: 'justice',
        storyText: VALID_STORY_TEXT,
        isPublic: true,
      },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.status).toBe('draft');
    expect(data.title).toBe('My Journey');
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest(BASE_URL, {
      method: 'POST',
      body: {
        title: 'My Journey',
        category: 'justice',
        storyText: VALID_STORY_TEXT,
      },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it('returns 400 when story text is too short (below word minimum)', async () => {
    const req = createRequest(BASE_URL, {
      method: 'POST',
      body: {
        title: 'My Journey',
        category: 'justice',
        storyText: 'Too short.',
      },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/30 words/i);
  });

  it('returns 429 when user has already submitted a story within the rate-limit window', async () => {
    // Simulate the prisma.impactStory.count check returning 1 (already submitted recently)
    mockPrisma.impactStory.count.mockResolvedValue(1);

    const req = createRequest(BASE_URL, {
      method: 'POST',
      body: {
        title: 'Second Story',
        category: 'justice',
        storyText: VALID_STORY_TEXT,
      },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const req = createRequest(BASE_URL, {
      method: 'POST',
      body: {
        // missing title and storyText
        category: 'justice',
      },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('returns 400 when category is invalid', async () => {
    // Override getCategoryById to return null (invalid category)
    const { getCategoryById } = await import('@/lib/impact/categories');
    vi.mocked(getCategoryById).mockReturnValueOnce(undefined);

    const req = createRequest(BASE_URL, {
      method: 'POST',
      body: {
        title: 'My Journey',
        category: 'nonexistent_category',
        storyText: VALID_STORY_TEXT,
      },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/category/i);
  });

  it('proceeds without expanded text when AI expansion fails (non-fatal)', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('AI service unavailable'));
    const fallbackStory = { ...mockStory, expandedText: null, status: 'draft' };
    mockPrisma.impactStory.create.mockResolvedValue(fallbackStory);

    const req = createRequest(BASE_URL, {
      method: 'POST',
      body: {
        title: 'My Journey',
        category: 'justice',
        storyText: VALID_STORY_TEXT,
        isPublic: false,
      },
    });
    const res = await POST(req);
    const data = await res.json();

    // Should still succeed — expansion failure is non-fatal
    expect(res.status).toBe(201);
    expect(data.status).toBe('draft');
  });
});
