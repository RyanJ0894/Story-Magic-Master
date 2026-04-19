/**
 * Tests for Project Exchange API Routes
 *
 * GET    /api/projects/[id]/exchange — current listing state
 * POST   /api/projects/[id]/exchange — create / update listing
 * DELETE /api/projects/[id]/exchange — unlist project
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Clerk auth
const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// Mock Prisma
// project.findFirst is called twice by withProjectAuth routes:
//   1. Ownership check in withProjectAuth middleware
//   2. Slug uniqueness check inside the POST handler
const mockPrisma = {
  project: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
const {
  GET: getExchangeListing,
  POST: postExchangeListing,
  DELETE: deleteExchangeListing,
} = await import('@/app/api/projects/[id]/exchange/route');

// =============================================================================
// Helpers
// =============================================================================

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user_test123';

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

/** The project returned by the ownership check in withProjectAuth */
function makeOwnerProject(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    userId: USER_ID,
    name: 'My Screenplay',
    scriptText: 'FADE IN: A dark room...',
    pageCount: 90,
    exchangeIsPublic: false,
    exchangeSlug: null,
    exchangeTagline: null,
    exchangeGenre: null,
    exchangeListedAt: null,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Project Exchange API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCsrf.mockReturnValue(null);
    mockAuth.mockResolvedValue({ userId: USER_ID });
  });

  // ===========================================================================
  // GET /api/projects/[id]/exchange
  // ===========================================================================

  describe('GET /api/projects/[id]/exchange — listing state', () => {
    it('returns listing state showing not yet listed', async () => {
      // Ownership check
      mockPrisma.project.findFirst.mockResolvedValueOnce(makeOwnerProject());

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`
      );
      const response = await getExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.listing.isPublic).toBe(false);
      expect(data.listing.slug).toBeNull();
      expect(data.listing.tagline).toBeNull();
      expect(data.listing.genre).toBeNull();
      expect(data.listing.listedAt).toBeNull();
    });

    it('returns listing details when already listed', async () => {
      const listedProject = makeOwnerProject({
        exchangeIsPublic: true,
        exchangeSlug: 'my-screenplay-550e84',
        exchangeTagline: 'A gripping noir thriller',
        exchangeGenre: 'thriller',
        exchangeListedAt: new Date('2026-01-15T12:00:00Z'),
      });
      // Ownership check
      mockPrisma.project.findFirst.mockResolvedValueOnce(listedProject);

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`
      );
      const response = await getExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.listing.isPublic).toBe(true);
      expect(data.listing.slug).toBe('my-screenplay-550e84');
      expect(data.listing.tagline).toBe('A gripping noir thriller');
      expect(data.listing.genre).toBe('thriller');
      expect(data.listing.listedAt).toBeTruthy();
    });

    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null });

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`
      );
      const response = await getExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('AUTH_REQUIRED');
    });

    it('returns 404 when project not owned by user', async () => {
      // Ownership check returns null (project belongs to different user)
      mockPrisma.project.findFirst.mockResolvedValueOnce(null);

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`
      );
      const response = await getExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  // ===========================================================================
  // POST /api/projects/[id]/exchange
  // ===========================================================================

  describe('POST /api/projects/[id]/exchange — create/update listing', () => {
    it('creates a new listing with generated slug', async () => {
      // Ownership check — project without an existing slug
      mockPrisma.project.findFirst
        .mockResolvedValueOnce(makeOwnerProject()) // ownership check
        .mockResolvedValueOnce(null);              // slug uniqueness check (no conflict)

      const updatedProject = {
        exchangeSlug: `my-screenplay-${PROJECT_ID.slice(0, 6)}`,
        exchangeTagline: 'A gripping noir thriller',
        exchangeGenre: 'thriller',
        exchangeIsPublic: true,
        exchangeListedAt: new Date(),
      };
      mockPrisma.project.update.mockResolvedValueOnce(updatedProject);

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`,
        {
          method: 'POST',
          body: {
            tagline: 'A gripping noir thriller',
            genre: 'thriller',
            is_public: true,
          },
        }
      );
      const response = await postExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.listing.exchangeTagline).toBe('A gripping noir thriller');
      expect(data.listing.exchangeGenre).toBe('thriller');
      expect(data.listing.exchangeIsPublic).toBe(true);
      expect(mockPrisma.project.update).toHaveBeenCalledOnce();
    });

    it('preserves existing slug when relisting', async () => {
      const existingSlug = 'my-screenplay-550e84';
      // Ownership check — project already has a slug
      mockPrisma.project.findFirst.mockResolvedValueOnce(
        makeOwnerProject({ exchangeSlug: existingSlug })
      );
      // No slug uniqueness check needed when slug already exists

      const updatedProject = {
        exchangeSlug: existingSlug,
        exchangeTagline: 'Updated tagline',
        exchangeGenre: 'drama',
        exchangeIsPublic: true,
        exchangeListedAt: new Date(),
      };
      mockPrisma.project.update.mockResolvedValueOnce(updatedProject);

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`,
        {
          method: 'POST',
          body: {
            tagline: 'Updated tagline',
            genre: 'drama',
            is_public: true,
          },
        }
      );
      const response = await postExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.listing.exchangeSlug).toBe(existingSlug);
    });

    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null });

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`,
        {
          method: 'POST',
          body: { tagline: 'Test', genre: 'drama' },
        }
      );
      const response = await postExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('AUTH_REQUIRED');
    });

    it('returns 400 when tagline is missing', async () => {
      // Ownership check passes
      mockPrisma.project.findFirst.mockResolvedValueOnce(makeOwnerProject());

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`,
        {
          method: 'POST',
          body: { genre: 'thriller' }, // missing tagline
        }
      );
      const response = await postExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when genre is invalid', async () => {
      // Ownership check passes
      mockPrisma.project.findFirst.mockResolvedValueOnce(makeOwnerProject());

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`,
        {
          method: 'POST',
          body: { tagline: 'A great story', genre: 'not-a-real-genre' },
        }
      );
      const response = await postExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when project not owned by current user', async () => {
      // Ownership check returns null
      mockPrisma.project.findFirst.mockResolvedValueOnce(null);

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`,
        {
          method: 'POST',
          body: { tagline: 'Test', genre: 'drama' },
        }
      );
      const response = await postExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  // ===========================================================================
  // DELETE /api/projects/[id]/exchange
  // ===========================================================================

  describe('DELETE /api/projects/[id]/exchange — unlist project', () => {
    it('unlists project and returns { unlisted: true }', async () => {
      // Ownership check passes
      mockPrisma.project.findFirst.mockResolvedValueOnce(
        makeOwnerProject({ exchangeIsPublic: true })
      );
      mockPrisma.project.update.mockResolvedValueOnce({
        id: PROJECT_ID,
        exchangeIsPublic: false,
      });

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`,
        { method: 'DELETE' }
      );
      const response = await deleteExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.unlisted).toBe(true);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
        data: { exchangeIsPublic: false },
      });
    });

    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce({ userId: null });

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`,
        { method: 'DELETE' }
      );
      const response = await deleteExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('AUTH_REQUIRED');
    });

    it('returns 404 when project not owned by user', async () => {
      // Ownership check returns null (wrong user or project doesn't exist)
      mockPrisma.project.findFirst.mockResolvedValueOnce(null);

      const request = createRequest(
        `http://localhost:22000/api/projects/${PROJECT_ID}/exchange`,
        { method: 'DELETE' }
      );
      const response = await deleteExchangeListing(request, {
        params: Promise.resolve({ id: PROJECT_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('PROJECT_NOT_FOUND');
    });
  });
});
