/**
 * Tests for /api/projects/[id]/shares
 *
 * GET  — returns shares with engagement summary (ownership-verified)
 * PATCH — bulk deactivate all shares for the project
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

vi.mock('@/lib/csrf', () => ({
  validateCsrf: vi.fn(() => null),
}));

const mockPrisma = {
  project: {
    findFirst: vi.fn(),
  },
  scriptShare: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// =============================================================================
// Import route after mocks
// =============================================================================

const { GET, PATCH } = await import('@/app/api/projects/[id]/shares/route');

// =============================================================================
// Helpers
// =============================================================================

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-123';

const mockShare = {
  id: 'share-1',
  shareCode: 'abc123',
  recipientEmail: 'agent@wme.com',
  recipientName: 'John Smith',
  accessLevel: 'stream',
  expiresAt: null,
  isActive: true,
  createdAt: new Date('2026-05-20').toISOString(),
  viewCount: 3,
  playCount: 2,
  lastAccessedAt: new Date('2026-05-22').toISOString(),
};

function makeRequest(method: string, body?: object, projectId = PROJECT_ID) {
  return new NextRequest(`http://localhost/api/projects/${projectId}/shares`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('GET /api/projects/[id]/shares', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      name: 'ANSWERS',
    });
    mockPrisma.scriptShare.findMany.mockResolvedValue([mockShare]);
  });

  it('returns shares with hasListened + shareUrl enriched', async () => {
    const req = makeRequest('GET');
    const res = await GET(req, { params: { id: PROJECT_ID } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shares).toHaveLength(1);
    expect(body.shares[0].hasListened).toBe(true); // playCount 2 > 0
    expect(body.shares[0].shareUrl).toMatch(/\/s\/abc123/);
  });

  it('returns accurate summary counts', async () => {
    mockPrisma.scriptShare.findMany.mockResolvedValue([
      { ...mockShare, id: 'share-1', viewCount: 3, playCount: 2 }, // opened + listened
      { ...mockShare, id: 'share-2', viewCount: 1, playCount: 0 }, // opened only
      { ...mockShare, id: 'share-3', viewCount: 0, playCount: 0 }, // not opened
    ]);

    const req = makeRequest('GET');
    const res = await GET(req, { params: { id: PROJECT_ID } });
    const body = await res.json();

    expect(body.summary.total).toBe(3);
    expect(body.summary.listened).toBe(1);
    expect(body.summary.opened).toBe(2);
    expect(body.summary.notOpened).toBe(1);
  });

  it('returns 404 when project not found or not owned', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = makeRequest('GET');
    const res = await GET(req, { params: { id: PROJECT_ID } });

    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const req = makeRequest('GET');
    const res = await GET(req, { params: { id: PROJECT_ID } });

    expect(res.status).toBe(401);
  });

  it('returns empty shares array with correct summary when no shares', async () => {
    mockPrisma.scriptShare.findMany.mockResolvedValue([]);

    const req = makeRequest('GET');
    const res = await GET(req, { params: { id: PROJECT_ID } });
    const body = await res.json();

    expect(body.shares).toHaveLength(0);
    expect(body.summary).toEqual({ total: 0, listened: 0, opened: 0, notOpened: 0 });
  });
});

describe('PATCH /api/projects/[id]/shares (deactivate_all)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    mockPrisma.scriptShare.updateMany.mockResolvedValue({ count: 5 });
  });

  it('deactivates all active shares and returns count', async () => {
    const req = makeRequest('PATCH', { action: 'deactivate_all' });
    const res = await PATCH(req, { params: { id: PROJECT_ID } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deactivated).toBe(5);
    expect(mockPrisma.scriptShare.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: PROJECT_ID, isActive: true }),
        data: { isActive: false },
      })
    );
  });

  it('returns 400 for unknown action', async () => {
    const req = makeRequest('PATCH', { action: 'delete_all' });
    const res = await PATCH(req, { params: { id: PROJECT_ID } });

    expect(res.status).toBe(400);
  });

  it('returns 404 when project not owned', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = makeRequest('PATCH', { action: 'deactivate_all' });
    const res = await PATCH(req, { params: { id: PROJECT_ID } });

    expect(res.status).toBe(404);
  });
});
