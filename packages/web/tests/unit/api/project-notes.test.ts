/**
 * Tests for Project Notes API Route (Sprint M)
 *
 * GET    /api/projects/[id]/notes         — list current user's notes
 * POST   /api/projects/[id]/notes         — create note
 * DELETE /api/projects/[id]/notes?noteId= — delete own note
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

const mockPrisma = {
  project: { findFirst: vi.fn() },
  projectNote: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/csrf', () => ({ validateCsrf: vi.fn(() => null) }));
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve(null)),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));
vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

const { GET, POST, DELETE } = await import('@/app/api/projects/[id]/notes/route');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440020';
const USER_ID = 'user_notes_test';
const NOTE_ID = '550e8400-e29b-41d4-a716-446655440021';

const MOCK_PROJECT = { id: PROJECT_ID, userId: USER_ID };
const MOCK_NOTE = {
  id: NOTE_ID,
  projectId: PROJECT_ID,
  authorId: USER_ID,
  noteText: 'Great scene here',
  lineId: 'line-1',
  timestamp: null,
  createdAt: new Date().toISOString(),
};

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:22000',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams(id = PROJECT_ID) {
  return { params: Promise.resolve({ id }) };
}

// =============================================================================
// GET — List notes
// =============================================================================

describe('GET /api/projects/[id]/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
  });

  it('returns notes for authenticated project owner', async () => {
    mockPrisma.projectNote.findMany.mockResolvedValue([MOCK_NOTE]);

    const res = await GET(
      makeRequest('GET', `http://localhost/api/projects/${PROJECT_ID}/notes`),
      makeParams()
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toHaveLength(1);
    expect(data.notes[0].noteText).toBe('Great scene here');
  });

  it('returns empty array when no notes exist', async () => {
    mockPrisma.projectNote.findMany.mockResolvedValue([]);

    const res = await GET(
      makeRequest('GET', `http://localhost/api/projects/${PROJECT_ID}/notes`),
      makeParams()
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toEqual([]);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await GET(
      makeRequest('GET', `http://localhost/api/projects/${PROJECT_ID}/notes`),
      makeParams()
    );

    expect(res.status).toBe(401);
  });

  it('returns 404 when project not found', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const res = await GET(
      makeRequest('GET', `http://localhost/api/projects/${PROJECT_ID}/notes`),
      makeParams()
    );

    expect(res.status).toBe(404);
  });
});

// =============================================================================
// POST — Create note
// =============================================================================

describe('POST /api/projects/[id]/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
  });

  it('creates a note and returns 201', async () => {
    mockPrisma.projectNote.create.mockResolvedValue(MOCK_NOTE);

    const res = await POST(
      makeRequest('POST', `http://localhost/api/projects/${PROJECT_ID}/notes`, {
        noteText: 'Great scene here',
        lineId: 'line-1',
      }),
      makeParams()
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(mockPrisma.projectNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: PROJECT_ID,
          authorId: USER_ID,
          noteText: 'Great scene here',
          lineId: 'line-1',
        }),
      })
    );
    expect(data.id).toBe(NOTE_ID);
  });

  it('creates a note without optional lineId / timestamp', async () => {
    mockPrisma.projectNote.create.mockResolvedValue({ ...MOCK_NOTE, lineId: null });

    const res = await POST(
      makeRequest('POST', `http://localhost/api/projects/${PROJECT_ID}/notes`, {
        noteText: 'Simple note',
      }),
      makeParams()
    );

    expect(res.status).toBe(201);
    expect(mockPrisma.projectNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lineId: null, timestamp: null }),
      })
    );
  });

  it('returns 400 for empty noteText', async () => {
    const res = await POST(
      makeRequest('POST', `http://localhost/api/projects/${PROJECT_ID}/notes`, {
        noteText: '',
      }),
      makeParams()
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.projectNote.create).not.toHaveBeenCalled();
  });

  it('returns 400 for missing noteText', async () => {
    const res = await POST(
      makeRequest('POST', `http://localhost/api/projects/${PROJECT_ID}/notes`, {}),
      makeParams()
    );

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest(
      `http://localhost/api/projects/${PROJECT_ID}/notes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'http://localhost:22000' },
        body: 'not-json',
      }
    );
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// DELETE — Delete note (author only)
// =============================================================================

describe('DELETE /api/projects/[id]/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
  });

  it('deletes own note and returns success', async () => {
    mockPrisma.projectNote.findUnique.mockResolvedValue(MOCK_NOTE);
    mockPrisma.projectNote.delete.mockResolvedValue(MOCK_NOTE);

    const res = await DELETE(
      makeRequest('DELETE', `http://localhost/api/projects/${PROJECT_ID}/notes?noteId=${NOTE_ID}`),
      makeParams()
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.projectNote.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: NOTE_ID } })
    );
  });

  it('returns 403 when deleting another user\'s note', async () => {
    mockPrisma.projectNote.findUnique.mockResolvedValue({
      ...MOCK_NOTE,
      authorId: 'user_someone_else',
    });

    const res = await DELETE(
      makeRequest('DELETE', `http://localhost/api/projects/${PROJECT_ID}/notes?noteId=${NOTE_ID}`),
      makeParams()
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.projectNote.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when note does not exist', async () => {
    mockPrisma.projectNote.findUnique.mockResolvedValue(null);

    const res = await DELETE(
      makeRequest('DELETE', `http://localhost/api/projects/${PROJECT_ID}/notes?noteId=${NOTE_ID}`),
      makeParams()
    );

    expect(res.status).toBe(404);
  });

  it('returns 400 when noteId query param is missing', async () => {
    const res = await DELETE(
      makeRequest('DELETE', `http://localhost/api/projects/${PROJECT_ID}/notes`),
      makeParams()
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.projectNote.delete).not.toHaveBeenCalled();
  });
});
