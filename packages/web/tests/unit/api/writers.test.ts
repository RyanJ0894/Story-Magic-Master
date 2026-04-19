/**
 * Tests for Writers API Routes
 *
 * GET  /api/writers/[writerId]           — public writer profile
 * GET  /api/writers/[writerId]/subscribe — check subscription status (auth)
 * POST /api/writers/[writerId]/subscribe — toggle subscription (auth)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Clerk auth
const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// Mock Prisma
const mockPrisma = {
  profile: {
    findUnique: vi.fn(),
  },
  project: {
    findMany: vi.fn(),
  },
  writerSubscription: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock CSRF validation
const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}));

// Mock rate-limit
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

// Import after mocks
const { GET: getWriter } = await import('@/app/api/writers/[writerId]/route');
const { GET: getSubscription, POST: toggleSubscription } = await import(
  '@/app/api/writers/[writerId]/subscribe/route'
);

// =============================================================================
// Helpers
// =============================================================================

const WRITER_ID = 'user_writer123';
const CURRENT_USER_ID = 'user_test123';

function createRequest(
  url: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const init: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:22000',
      ...(options.headers || {}),
    },
  };
  if (options.body) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(url, init);
}

const mockProfile = {
  id: WRITER_ID,
  fullName: 'Jane Doe',
  avatarUrl: 'https://example.com/avatar.jpg',
  createdAt: new Date('2025-06-01T00:00:00Z'),
  _count: {
    projects: 5,
    writerSubscriptions: 42,
  },
};

const mockScript = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  exchangeSlug: 'dark-room-550e84',
  name: 'Dark Room',
  exchangeTagline: 'A noir thriller',
  exchangeGenre: 'thriller',
  exchangeListedAt: new Date('2026-01-10T12:00:00Z'),
  pageCount: 92,
  page1PreviewUrl: 'https://example.com/preview.jpg',
  _count: { scriptReviews: 3 },
};

// =============================================================================
// Tests: GET /api/writers/[writerId]
// =============================================================================

describe('Writers API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCsrf.mockReturnValue(null);
    mockAuth.mockResolvedValue({ userId: CURRENT_USER_ID });
  });

  describe('GET /api/writers/[writerId] — writer profile', () => {
    it('returns writer profile with scripts list', async () => {
      mockPrisma.profile.findUnique.mockResolvedValueOnce(mockProfile);
      mockPrisma.project.findMany.mockResolvedValueOnce([mockScript]);

      const request = createRequest(
        `http://localhost:22000/api/writers/${WRITER_ID}`
      );
      const response = await getWriter(request, {
        params: Promise.resolve({ writerId: WRITER_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.writer.id).toBe(WRITER_ID);
      expect(data.writer.fullName).toBe('Jane Doe');
      expect(data.writer.listedScripts).toBe(5);
      expect(data.writer.subscribers).toBe(42);
      expect(data.scripts).toHaveLength(1);
      expect(data.scripts[0].name).toBe('Dark Room');
      expect(data.scripts[0].slug).toBe('dark-room-550e84');
      expect(data.scripts[0].hasPreview).toBe(true);
      expect(data.scripts[0].reviewCount).toBe(3);
    });

    it('returns 404 when writer is not found', async () => {
      mockPrisma.profile.findUnique.mockResolvedValueOnce(null);

      const request = createRequest(
        `http://localhost:22000/api/writers/nonexistent_writer`
      );
      const response = await getWriter(request, {
        params: Promise.resolve({ writerId: 'nonexistent_writer' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Writer not found');
    });

    it('returns writer with empty scripts array when none listed', async () => {
      mockPrisma.profile.findUnique.mockResolvedValueOnce({
        ...mockProfile,
        _count: { projects: 0, writerSubscriptions: 0 },
      });
      mockPrisma.project.findMany.mockResolvedValueOnce([]);

      const request = createRequest(
        `http://localhost:22000/api/writers/${WRITER_ID}`
      );
      const response = await getWriter(request, {
        params: Promise.resolve({ writerId: WRITER_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.scripts).toEqual([]);
    });
  });

  // ===========================================================================
  // Tests: GET /api/writers/[writerId]/subscribe
  // ===========================================================================

  describe('GET /api/writers/[writerId]/subscribe — check subscription', () => {
    it('returns { subscribed: false } when not subscribed', async () => {
      mockAuth.mockResolvedValueOnce({ userId: CURRENT_USER_ID });
      mockPrisma.writerSubscription.findUnique.mockResolvedValueOnce(null);

      const request = createRequest(
        `http://localhost:22000/api/writers/${WRITER_ID}/subscribe`
      );
      const response = await getSubscription(request, {
        params: Promise.resolve({ writerId: WRITER_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscribed).toBe(false);
    });

    it('returns { subscribed: true } when subscribed', async () => {
      mockAuth.mockResolvedValueOnce({ userId: CURRENT_USER_ID });
      mockPrisma.writerSubscription.findUnique.mockResolvedValueOnce({
        id: 'sub_abc123',
      });

      const request = createRequest(
        `http://localhost:22000/api/writers/${WRITER_ID}/subscribe`
      );
      const response = await getSubscription(request, {
        params: Promise.resolve({ writerId: WRITER_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscribed).toBe(true);
    });

    it('returns { subscribed: false } for own profile without querying DB', async () => {
      // When checking own profile, route short-circuits and returns false
      mockAuth.mockResolvedValueOnce({ userId: WRITER_ID });

      const request = createRequest(
        `http://localhost:22000/api/writers/${WRITER_ID}/subscribe`
      );
      const response = await getSubscription(request, {
        params: Promise.resolve({ writerId: WRITER_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscribed).toBe(false);
      expect(mockPrisma.writerSubscription.findUnique).not.toHaveBeenCalled();
    });

    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null });

      const request = createRequest(
        `http://localhost:22000/api/writers/${WRITER_ID}/subscribe`
      );
      const response = await getSubscription(request, {
        params: Promise.resolve({ writerId: WRITER_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('AUTH_REQUIRED');
    });
  });

  // ===========================================================================
  // Tests: POST /api/writers/[writerId]/subscribe
  // ===========================================================================

  describe('POST /api/writers/[writerId]/subscribe — toggle subscription', () => {
    it('creates subscription and returns 201 (subscribe)', async () => {
      mockAuth.mockResolvedValueOnce({ userId: CURRENT_USER_ID });
      // Writer exists
      mockPrisma.profile.findUnique.mockResolvedValueOnce({ id: WRITER_ID });
      // Not currently subscribed
      mockPrisma.writerSubscription.findUnique.mockResolvedValueOnce(null);
      mockPrisma.writerSubscription.create.mockResolvedValueOnce({
        id: 'sub_new',
        subscriberId: CURRENT_USER_ID,
        writerId: WRITER_ID,
      });

      const request = createRequest(
        `http://localhost:22000/api/writers/${WRITER_ID}/subscribe`,
        { method: 'POST' }
      );
      const response = await toggleSubscription(request, {
        params: Promise.resolve({ writerId: WRITER_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.subscribed).toBe(true);
      expect(mockPrisma.writerSubscription.create).toHaveBeenCalledWith({
        data: { subscriberId: CURRENT_USER_ID, writerId: WRITER_ID },
      });
    });

    it('deletes subscription and returns 200 (unsubscribe)', async () => {
      mockAuth.mockResolvedValueOnce({ userId: CURRENT_USER_ID });
      // Writer exists
      mockPrisma.profile.findUnique.mockResolvedValueOnce({ id: WRITER_ID });
      // Currently subscribed
      mockPrisma.writerSubscription.findUnique.mockResolvedValueOnce({
        id: 'sub_existing',
      });
      mockPrisma.writerSubscription.delete.mockResolvedValueOnce({});

      const request = createRequest(
        `http://localhost:22000/api/writers/${WRITER_ID}/subscribe`,
        { method: 'POST' }
      );
      const response = await toggleSubscription(request, {
        params: Promise.resolve({ writerId: WRITER_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.subscribed).toBe(false);
      expect(mockPrisma.writerSubscription.delete).toHaveBeenCalled();
    });

    it('returns 400 when subscribing to yourself', async () => {
      mockAuth.mockResolvedValueOnce({ userId: WRITER_ID });

      const request = createRequest(
        `http://localhost:22000/api/writers/${WRITER_ID}/subscribe`,
        { method: 'POST' }
      );
      const response = await toggleSubscription(request, {
        params: Promise.resolve({ writerId: WRITER_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot subscribe to yourself');
    });

    it('returns 404 when writer does not exist', async () => {
      mockAuth.mockResolvedValueOnce({ userId: CURRENT_USER_ID });
      mockPrisma.profile.findUnique.mockResolvedValueOnce(null);

      const request = createRequest(
        `http://localhost:22000/api/writers/ghost_writer/subscribe`,
        { method: 'POST' }
      );
      const response = await toggleSubscription(request, {
        params: Promise.resolve({ writerId: 'ghost_writer' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Writer not found');
    });

    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null });

      const request = createRequest(
        `http://localhost:22000/api/writers/${WRITER_ID}/subscribe`,
        { method: 'POST' }
      );
      const response = await toggleSubscription(request, {
        params: Promise.resolve({ writerId: WRITER_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('AUTH_REQUIRED');
    });
  });
});
