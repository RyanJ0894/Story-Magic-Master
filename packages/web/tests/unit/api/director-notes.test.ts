/**
 * Tests for Director Notes API Route
 * GET /api/projects/[id]/director-notes
 * PUT /api/projects/[id]/director-notes
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
  project: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn(() => null),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve(null)),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Import after mocks
const { GET, PUT } = await import('@/app/api/projects/[id]/director-notes/route');

// =============================================================================
// Helpers
// =============================================================================

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user_test123';

const mockProject = {
  id: PROJECT_ID,
  userId: USER_ID,
  directorNotes: null,
};

function createRequest(
  url: string,
  options: { method?: string; body?: unknown } = {}
): NextRequest {
  return new NextRequest(url, {
    method: options.method || 'GET',
    headers: { origin: 'http://localhost:22000' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

function createRouteParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// =============================================================================
// Tests
// =============================================================================

describe('GET /api/projects/[id]/director-notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue(mockProject);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/director-notes`);
    const res = await GET(req, createRouteParams(PROJECT_ID));
    expect(res.status).toBe(401);
  });

  it('returns null directorNotes when none set', async () => {
    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/director-notes`);
    const res = await GET(req, createRouteParams(PROJECT_ID));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.directorNotes).toBeNull();
  });

  it('returns existing directorNotes', async () => {
    const notes = { global: 'Tense.', characters: { SARAH: 'Speaks fast.' } };
    mockPrisma.project.findFirst.mockResolvedValue({ ...mockProject, directorNotes: notes });
    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/director-notes`);
    const res = await GET(req, createRouteParams(PROJECT_ID));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.directorNotes).toEqual(notes);
  });

  it('returns 404 when project not found', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const req = createRequest(`http://localhost:22000/api/projects/${PROJECT_ID}/director-notes`);
    const res = await GET(req, createRouteParams(PROJECT_ID));
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/projects/[id]/director-notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue(mockProject);
    mockPrisma.project.update.mockResolvedValue({ ...mockProject });
  });

  it('saves valid director notes', async () => {
    const notes = { global: 'Act 2 is tense.', characters: { SARAH: 'Sardonic.' } };
    mockPrisma.project.update.mockResolvedValue({ ...mockProject, directorNotes: notes });

    const req = createRequest(
      `http://localhost:22000/api/projects/${PROJECT_ID}/director-notes`,
      { method: 'PUT', body: { directorNotes: notes } }
    );
    const res = await PUT(req, createRouteParams(PROJECT_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.directorNotes).toEqual(notes);
    expect(mockPrisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PROJECT_ID },
        data: expect.objectContaining({ directorNotes: expect.any(Object) }),
      })
    );
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const req = createRequest(
      `http://localhost:22000/api/projects/${PROJECT_ID}/director-notes`,
      { method: 'PUT', body: { directorNotes: { global: 'x', characters: {} } } }
    );
    const res = await PUT(req, createRouteParams(PROJECT_ID));
    expect(res.status).toBe(401);
  });

  it('returns 404 when project not found', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const req = createRequest(
      `http://localhost:22000/api/projects/${PROJECT_ID}/director-notes`,
      { method: 'PUT', body: { directorNotes: { global: 'x', characters: {} } } }
    );
    const res = await PUT(req, createRouteParams(PROJECT_ID));
    expect(res.status).toBe(404);
  });

  it('rejects notes with global note exceeding 500 chars', async () => {
    const req = createRequest(
      `http://localhost:22000/api/projects/${PROJECT_ID}/director-notes`,
      { method: 'PUT', body: { directorNotes: { global: 'x'.repeat(501), characters: {} } } }
    );
    const res = await PUT(req, createRouteParams(PROJECT_ID));
    expect(res.status).toBe(400);
  });

  it('rejects notes with a character note exceeding 2000 chars', async () => {
    const req = createRequest(
      `http://localhost:22000/api/projects/${PROJECT_ID}/director-notes`,
      { method: 'PUT', body: { directorNotes: { global: '', characters: { SARAH: 'x'.repeat(2001) } } } }
    );
    const res = await PUT(req, createRouteParams(PROJECT_ID));
    expect(res.status).toBe(400);
  });

  it('clears notes when null is sent', async () => {
    mockPrisma.project.update.mockResolvedValue({ ...mockProject, directorNotes: null });
    const req = createRequest(
      `http://localhost:22000/api/projects/${PROJECT_ID}/director-notes`,
      { method: 'PUT', body: { directorNotes: null } }
    );
    const res = await PUT(req, createRouteParams(PROJECT_ID));
    expect(res.status).toBe(200);
    expect(mockPrisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { directorNotes: null } })
    );
  });
});
