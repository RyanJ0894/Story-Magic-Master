/**
 * Tests for Script Reviews API Routes
 *
 * GET  /api/projects/[id]/reviews — fetch public reviews for a listed script
 * POST /api/projects/[id]/reviews — submit a review (authenticated reviewer)
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
  project: { findFirst: vi.fn() },
  profile: { findUnique: vi.fn() },
  scriptReview: { findMany: vi.fn(), upsert: vi.fn() },
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
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Import after mocks
const { GET, POST } = await import('@/app/api/projects/[id]/reviews/route');

// =============================================================================
// Helpers
// =============================================================================

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const REVIEWER_USER_ID = 'user_reviewer123';
const OWNER_USER_ID = 'user_owner456';

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

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const mockPublicProject = {
  id: PROJECT_ID,
  userId: OWNER_USER_ID,
  exchangeIsPublic: true,
};

const mockReview = {
  id: 'review-001',
  projectId: PROJECT_ID,
  reviewerId: REVIEWER_USER_ID,
  reviewerName: 'Jane Reviewer',
  verdict: 'recommend',
  numericRating: 4,
  comment: 'Great script with vivid characters.',
  isAnonymous: false,
  isPublic: true,
  createdAt: new Date('2026-03-01T10:00:00Z'),
  reviewer: { fullName: 'Jane Reviewer', avatarUrl: 'https://example.com/avatar.png' },
};

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateCsrf.mockReturnValue(null);
  mockAuth.mockResolvedValue({ userId: REVIEWER_USER_ID });
  mockPrisma.project.findFirst.mockResolvedValue(mockPublicProject);
  mockPrisma.scriptReview.findMany.mockResolvedValue([mockReview]);
  mockPrisma.profile.findUnique.mockResolvedValue({ fullName: 'Jane Reviewer' });
});

// =============================================================================
// GET /api/projects/[id]/reviews
// =============================================================================

describe('GET /api/projects/[id]/reviews', () => {
  it('returns reviews with reviewer info for a public project', async () => {
    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/reviews`);
    const res = await GET(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.reviews).toHaveLength(1);
    expect(data.reviews[0].id).toBe('review-001');
    expect(data.reviews[0].verdict).toBe('recommend');
    expect(data.reviews[0].numericRating).toBe(4);
    expect(data.reviews[0].reviewer.fullName).toBe('Jane Reviewer');
    expect(data.reviews[0].reviewer.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('returns anonymous reviewer info when is_anonymous is true', async () => {
    const anonymousReview = {
      ...mockReview,
      id: 'review-anon',
      isAnonymous: true,
      reviewer: { fullName: 'Jane Reviewer', avatarUrl: 'https://example.com/avatar.png' },
    };
    mockPrisma.scriptReview.findMany.mockResolvedValue([anonymousReview]);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/reviews`);
    const res = await GET(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.reviews[0].reviewer.fullName).toBe('Anonymous');
    expect(data.reviews[0].reviewer.id).toBeNull();
    expect(data.reviews[0].reviewer.avatarUrl).toBeNull();
  });

  it('returns 404 when project is not found or not publicly listed', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/reviews`);
    const res = await GET(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBeDefined();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/reviews`);
    const res = await GET(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.code).toBe('AUTH_REQUIRED');
  });

  it('returns empty reviews array when project has no public reviews', async () => {
    mockPrisma.scriptReview.findMany.mockResolvedValue([]);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/reviews`);
    const res = await GET(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.reviews).toEqual([]);
  });
});

// =============================================================================
// POST /api/projects/[id]/reviews
// =============================================================================

describe('POST /api/projects/[id]/reviews', () => {
  it('submits a new review and returns 201', async () => {
    const createdReview = { ...mockReview, verdict: 'consider', numericRating: 3 };
    mockPrisma.scriptReview.upsert.mockResolvedValue(createdReview);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/reviews`, {
      method: 'POST',
      body: { verdict: 'consider', numeric_rating: 3, comment: 'Needs work but has potential.' },
    });
    const res = await POST(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.review).toBeDefined();
    expect(data.review.verdict).toBe('consider');
    expect(mockPrisma.scriptReview.upsert).toHaveBeenCalledOnce();
  });

  it('upserts an existing review instead of creating a duplicate', async () => {
    const updatedReview = { ...mockReview, verdict: 'strong_recommend', numericRating: 5 };
    mockPrisma.scriptReview.upsert.mockResolvedValue(updatedReview);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/reviews`, {
      method: 'POST',
      body: { verdict: 'strong_recommend', numeric_rating: 5 },
    });
    const res = await POST(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.review.verdict).toBe('strong_recommend');
    // upsert is called with both create and update clauses
    const upsertCall = mockPrisma.scriptReview.upsert.mock.calls[0][0];
    expect(upsertCall).toHaveProperty('create');
    expect(upsertCall).toHaveProperty('update');
  });

  it('returns 400 when reviewer tries to review their own script', async () => {
    // Project owner is the same as the authenticated reviewer
    mockPrisma.project.findFirst.mockResolvedValue({
      ...mockPublicProject,
      userId: REVIEWER_USER_ID,
    });

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/reviews`, {
      method: 'POST',
      body: { verdict: 'pass' },
    });
    const res = await POST(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/own script/i);
  });

  it('returns 400 for an invalid verdict value', async () => {
    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/reviews`, {
      method: 'POST',
      body: { verdict: 'thumbs_up' },
    });
    const res = await POST(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/reviews`, {
      method: 'POST',
      body: { verdict: 'pass' },
    });
    const res = await POST(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.code).toBe('AUTH_REQUIRED');
  });

  it('returns 404 when project is not found or not listed on the exchange', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/reviews`, {
      method: 'POST',
      body: { verdict: 'pass' },
    });
    const res = await POST(req, routeParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBeDefined();
  });

  it('stores is_anonymous flag and reviewer profile name', async () => {
    const anonReview = { ...mockReview, isAnonymous: true };
    mockPrisma.scriptReview.upsert.mockResolvedValue(anonReview);

    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/reviews`, {
      method: 'POST',
      body: { verdict: 'recommend', is_anonymous: true },
    });
    const res = await POST(req, routeParams(PROJECT_ID));

    expect(res.status).toBe(201);
    const upsertCall = mockPrisma.scriptReview.upsert.mock.calls[0][0];
    expect(upsertCall.create.isAnonymous).toBe(true);
    expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith({
      where: { id: REVIEWER_USER_ID },
      select: { fullName: true },
    });
  });
});
