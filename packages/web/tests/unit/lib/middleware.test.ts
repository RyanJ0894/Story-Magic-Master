/**
 * Tests for Shared API Route Middleware
 *
 * Covers withAuth, withProjectAuth, and parseBody from lib/api/middleware.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';

// =============================================================================
// Mocks
// =============================================================================

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  project: {
    findFirst: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}));

const mockRateLimit = vi.fn(() => Promise.resolve(null));
const mockGetClientIp = vi.fn(() => '127.0.0.1');
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}));

// Import after mocks are established
const { withAuth, withProjectAuth, parseBody } = await import(
  '@/lib/api/middleware'
);

// =============================================================================
// Helpers
// =============================================================================

function createRequest(
  url: string,
  options: {
    method?: string;
    body?: Record<string, unknown> | string;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const init: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:22000',
      ...(options.headers || {}),
    },
  };

  if (options.body !== undefined) {
    init.body =
      typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);
  }

  return new NextRequest(new URL(url, 'http://localhost:22000'), init);
}

function routeParams(params: Record<string, string> = {}) {
  return { params: Promise.resolve(params) };
}

async function parseJson(response: Response) {
  return response.json();
}

const USER_ID = 'user_test123';
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockProject = {
  id: PROJECT_ID,
  userId: USER_ID,
  name: 'Test Project',
  createdAt: new Date('2026-01-15T10:00:00Z'),
};

// =============================================================================
// withAuth
// =============================================================================

describe('withAuth', () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockValidateCsrf.mockReturnValue(null);
    mockRateLimit.mockResolvedValue(null);
  });

  // ---------------------------------------------------------------------------
  // CSRF Validation
  // ---------------------------------------------------------------------------

  describe('CSRF validation', () => {
    it('validates CSRF on POST requests by default', async () => {
      mockValidateCsrf.mockReturnValue('CSRF failed');
      const handler = vi.fn();
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test', { method: 'POST', body: {} });
      const res = await wrapped(req);
      const body = await parseJson(res);

      expect(res.status).toBe(403);
      expect(body.code).toBe('CSRF_ERROR');
      expect(handler).not.toHaveBeenCalled();
    });

    it('validates CSRF on PUT requests by default', async () => {
      mockValidateCsrf.mockReturnValue('CSRF failed');
      const handler = vi.fn();
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test', { method: 'PUT', body: {} });
      const res = await wrapped(req);

      expect(res.status).toBe(403);
    });

    it('validates CSRF on PATCH requests by default', async () => {
      mockValidateCsrf.mockReturnValue('CSRF failed');
      const handler = vi.fn();
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test', { method: 'PATCH', body: {} });
      const res = await wrapped(req);

      expect(res.status).toBe(403);
    });

    it('validates CSRF on DELETE requests by default', async () => {
      mockValidateCsrf.mockReturnValue('CSRF failed');
      const handler = vi.fn();
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test', { method: 'DELETE' });
      const res = await wrapped(req);

      expect(res.status).toBe(403);
    });

    it('skips CSRF validation on GET requests by default', async () => {
      mockValidateCsrf.mockReturnValue('CSRF failed');
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test', { method: 'GET' });
      await wrapped(req);

      expect(mockValidateCsrf).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });

    it('skips CSRF validation when csrf: false is set', async () => {
      mockValidateCsrf.mockReturnValue('CSRF failed');
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withAuth(handler, { csrf: false });

      const req = createRequest('/api/test', { method: 'POST', body: {} });
      await wrapped(req);

      expect(mockValidateCsrf).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Rate Limiting
  // ---------------------------------------------------------------------------

  describe('rate limiting', () => {
    it('applies normal rate limiting by default', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test');
      await wrapped(req);

      expect(mockGetClientIp).toHaveBeenCalledWith(req);
      expect(mockRateLimit).toHaveBeenCalledWith('api:127.0.0.1', 'normal');
    });

    it('returns 429 when rate limited', async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }),
        { status: 429 },
      );
      mockRateLimit.mockResolvedValue(rateLimitResponse);

      const handler = vi.fn();
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test');
      const res = await wrapped(req);

      expect(res.status).toBe(429);
      expect(handler).not.toHaveBeenCalled();
    });

    it('uses strict tier when specified', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withAuth(handler, { rateLimit: 'strict' });

      const req = createRequest('/api/test');
      await wrapped(req);

      expect(mockRateLimit).toHaveBeenCalledWith('api:127.0.0.1', 'strict');
    });

    it('skips rate limiting when rateLimit: false', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withAuth(handler, { rateLimit: false });

      const req = createRequest('/api/test');
      await wrapped(req);

      expect(mockRateLimit).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const handler = vi.fn();
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test');
      const res = await wrapped(req);
      const body = await parseJson(res);

      expect(res.status).toBe(401);
      expect(body.code).toBe('AUTH_REQUIRED');
      expect(handler).not.toHaveBeenCalled();
    });

    it('calls handler with userId when authenticated', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test');
      await wrapped(req);

      expect(handler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ userId: USER_ID }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Params Passing
  // ---------------------------------------------------------------------------

  describe('params passing', () => {
    it('resolves route params and passes to handler', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withAuth(handler);

      const req = createRequest('/api/projects/abc');
      await wrapped(req, routeParams({ id: 'abc' }));

      expect(handler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ params: { id: 'abc' } }),
      );
    });

    it('passes empty params when no route params provided', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test');
      await wrapped(req);

      expect(handler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ params: {} }),
      );
    });

    it('passes prisma client to handler', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('ok'));
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test');
      await wrapped(req);

      expect(handler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({ prisma: mockPrisma }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Middleware ordering: CSRF runs before rate limit, rate limit before auth
  // ---------------------------------------------------------------------------

  describe('middleware ordering', () => {
    it('checks CSRF before rate limiting (CSRF failure skips rateLimit)', async () => {
      mockValidateCsrf.mockReturnValue('CSRF failed');
      const handler = vi.fn();
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test', { method: 'POST', body: {} });
      await wrapped(req);

      expect(mockValidateCsrf).toHaveBeenCalled();
      expect(mockRateLimit).not.toHaveBeenCalled();
      expect(mockAuth).not.toHaveBeenCalled();
    });

    it('checks rate limit before auth (rate limit failure skips auth)', async () => {
      const rateLimitResponse = new Response('rate limited', { status: 429 });
      mockRateLimit.mockResolvedValue(rateLimitResponse);
      const handler = vi.fn();
      const wrapped = withAuth(handler);

      const req = createRequest('/api/test');
      await wrapped(req);

      expect(mockRateLimit).toHaveBeenCalled();
      expect(mockAuth).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// withProjectAuth
// =============================================================================

describe('withProjectAuth', () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockValidateCsrf.mockReturnValue(null);
    mockRateLimit.mockResolvedValue(null);
    mockPrisma.project.findFirst.mockResolvedValue(mockProject);
  });

  it('returns 400 MISSING_PROJECT_ID when params.id is missing', async () => {
    const handler = vi.fn();
    const wrapped = withProjectAuth(handler);

    const req = createRequest('/api/projects', { method: 'GET' });
    const res = await wrapped(req, routeParams({}));
    const body = await parseJson(res);

    expect(res.status).toBe(400);
    expect(body.code).toBe('MISSING_PROJECT_ID');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 404 PROJECT_NOT_FOUND when project does not exist', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const handler = vi.fn();
    const wrapped = withProjectAuth(handler);

    const req = createRequest('/api/projects/nonexistent', { method: 'GET' });
    const res = await wrapped(req, routeParams({ id: 'nonexistent' }));
    const body = await parseJson(res);

    expect(res.status).toBe(404);
    expect(body.code).toBe('PROJECT_NOT_FOUND');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 404 when a different user requests a project they do not own (cross-tenant denial)', async () => {
    // findFirst returns null because WHERE OR clause found no matching row
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const handler = vi.fn();
    const wrapped = withProjectAuth(handler);

    const req = createRequest('/api/projects/' + PROJECT_ID, { method: 'GET' });
    const res = await wrapped(req, routeParams({ id: PROJECT_ID }));
    const body = await parseJson(res);

    expect(res.status).toBe(404);
    expect(body.code).toBe('PROJECT_NOT_FOUND');
    expect(handler).not.toHaveBeenCalled();
  });

  it('grants access when project is team-shared (OR clause returns project)', async () => {
    // Simulates Prisma finding the project via the teamShares branch of the OR
    const sharedProject = { ...mockProject, userId: 'other-owner' };
    mockPrisma.project.findFirst.mockResolvedValue(sharedProject);

    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withProjectAuth(handler);

    const req = createRequest('/api/projects/' + PROJECT_ID, { method: 'GET' });
    const res = await wrapped(req, routeParams({ id: PROJECT_ID }));

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ projectId: PROJECT_ID, project: sharedProject }),
    );
  });

  it('queries project with OR clause for ownership + team-share access (BL-014)', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withProjectAuth(handler);

    const req = createRequest('/api/projects/' + PROJECT_ID, { method: 'GET' });
    await wrapped(req, routeParams({ id: PROJECT_ID }));

    expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
      where: {
        id: PROJECT_ID,
        OR: [
          { userId: USER_ID },
          {
            teamShares: {
              some: {
                team: {
                  members: {
                    some: {
                      userId: USER_ID,
                      acceptedAt: { not: null },
                      deactivatedAt: null,
                    },
                  },
                },
              },
            },
          },
        ],
      },
    });
  });

  it('passes projectId and project to handler on success', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withProjectAuth(handler);

    const req = createRequest('/api/projects/' + PROJECT_ID, { method: 'GET' });
    await wrapped(req, routeParams({ id: PROJECT_ID }));

    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        userId: USER_ID,
        projectId: PROJECT_ID,
        project: mockProject,
        params: { id: PROJECT_ID },
        prisma: mockPrisma,
      }),
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const handler = vi.fn();
    const wrapped = withProjectAuth(handler);

    const req = createRequest('/api/projects/' + PROJECT_ID, { method: 'GET' });
    const res = await wrapped(req, routeParams({ id: PROJECT_ID }));
    const body = await parseJson(res);

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_REQUIRED');
    expect(mockPrisma.project.findFirst).not.toHaveBeenCalled();
  });

  it('validates CSRF on mutation methods', async () => {
    mockValidateCsrf.mockReturnValue('CSRF failed');
    const handler = vi.fn();
    const wrapped = withProjectAuth(handler);

    const req = createRequest('/api/projects/' + PROJECT_ID, {
      method: 'PATCH',
      body: { name: 'Updated' },
    });
    const res = await wrapped(req, routeParams({ id: PROJECT_ID }));
    const body = await parseJson(res);

    expect(res.status).toBe(403);
    expect(body.code).toBe('CSRF_ERROR');
  });

  it('applies rate limiting', async () => {
    const rateLimitResponse = new Response(
      JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }),
      { status: 429 },
    );
    mockRateLimit.mockResolvedValue(rateLimitResponse);

    const handler = vi.fn();
    const wrapped = withProjectAuth(handler);

    const req = createRequest('/api/projects/' + PROJECT_ID, { method: 'GET' });
    const res = await wrapped(req, routeParams({ id: PROJECT_ID }));

    expect(res.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
  });
});

// =============================================================================
// parseBody
// =============================================================================

describe('parseBody', () => {
  const schema = z.object({
    name: z.string().min(1),
    count: z.number().int().positive(),
  });

  it('returns data for a valid JSON body matching the schema', async () => {
    const req = createRequest('/api/test', {
      method: 'POST',
      body: { name: 'hello', count: 5 },
    });

    const result = await parseBody(req, schema);

    expect('data' in result).toBe(true);
    if ('data' in result) {
      expect(result.data).toEqual({ name: 'hello', count: 5 });
    }
  });

  it('returns 400 INVALID_JSON for non-JSON body', async () => {
    const req = new NextRequest(new URL('/api/test', 'http://localhost:22000'), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'this is not json',
    });

    const result = await parseBody(req, schema);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(400);
      const body = await result.error.json();
      expect(body.code).toBe('INVALID_JSON');
    }
  });

  it('returns 400 VALIDATION_ERROR when body fails Zod validation', async () => {
    const req = createRequest('/api/test', {
      method: 'POST',
      body: { name: '', count: -1 },
    });

    const result = await parseBody(req, schema);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.status).toBe(400);
      const body = await result.error.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toBeDefined();
    }
  });

  it('returns VALIDATION_ERROR with field details for missing fields', async () => {
    const req = createRequest('/api/test', {
      method: 'POST',
      body: {},
    });

    const result = await parseBody(req, schema);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      const body = await result.error.json();
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details.name).toBeDefined();
      expect(body.details.count).toBeDefined();
    }
  });
});
