/**
 * Tests for Share Detail API Routes
 *
 * GET /api/shares/[shareId] - Get share details
 * PATCH /api/shares/[shareId] - Update share settings
 * DELETE /api/shares/[shareId] - Revoke/delete share
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
  scriptShare: {
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

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn(() => Promise.resolve('$2b$12$mockedhash')),
  verifyPassword: vi.fn(),
  isBcryptHash: vi.fn(),
}));

// Import after mocks
const { GET, PATCH, DELETE } = await import('@/app/api/shares/[shareId]/route');

// =============================================================================
// Helpers
// =============================================================================

const SHARE_ID = 'share-123';

const mockShare = {
  id: SHARE_ID,
  projectId: 'proj-1',
  sharedBy: 'user_test123',
  shareCode: 'abc123',
  accessLevel: 'stream',
  isActive: true,
  project: {
    id: 'proj-1',
    name: 'My Script',
    pageCount: 10,
  },
};

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

function routeParams(shareId: string) {
  return { params: Promise.resolve({ shareId }) };
}

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'user_test123' });
});

// =============================================================================
// GET /api/shares/[shareId]
// =============================================================================

describe('GET /api/shares/[shareId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`);
    const res = await GET(req, routeParams(SHARE_ID));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('AUTH_REQUIRED');
  });

  it('returns 404 when share not found', async () => {
    mockPrisma.scriptShare.findFirst.mockResolvedValue(null);

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`);
    const res = await GET(req, routeParams(SHARE_ID));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Share not found');
  });

  it('returns share details for the owner', async () => {
    mockPrisma.scriptShare.findFirst.mockResolvedValue(mockShare);

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`);
    const res = await GET(req, routeParams(SHARE_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.share.id).toBe(SHARE_ID);
    expect(data.share.project.name).toBe('My Script');

    // Verify the query filters by sharedBy
    expect(mockPrisma.scriptShare.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SHARE_ID, sharedBy: 'user_test123' },
      }),
    );
  });
});

// =============================================================================
// PATCH /api/shares/[shareId]
// =============================================================================

describe('PATCH /api/shares/[shareId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`, {
      method: 'PATCH',
      body: { is_active: false },
    });
    const res = await PATCH(req, routeParams(SHARE_ID));

    expect(res.status).toBe(401);
  });

  it('returns 404 when share not owned by user', async () => {
    // verifyOwnership returns null for non-owned resources
    mockPrisma.scriptShare.findFirst.mockResolvedValue(null);

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`, {
      method: 'PATCH',
      body: { is_active: false },
    });
    const res = await PATCH(req, routeParams(SHARE_ID));

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid update payload', async () => {
    mockPrisma.scriptShare.findFirst.mockResolvedValue(mockShare);

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`, {
      method: 'PATCH',
      body: { access_level: 'invalid-level' },
    });
    const res = await PATCH(req, routeParams(SHARE_ID));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid request parameters');
  });

  it('updates share settings successfully', async () => {
    mockPrisma.scriptShare.findFirst.mockResolvedValue(mockShare);
    const updatedShare = { ...mockShare, accessLevel: 'download', isActive: false };
    mockPrisma.scriptShare.update.mockResolvedValue(updatedShare);

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`, {
      method: 'PATCH',
      body: { access_level: 'download', is_active: false },
    });
    const res = await PATCH(req, routeParams(SHARE_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.share.accessLevel).toBe('download');
  });

  it('hashes password when updating password', async () => {
    mockPrisma.scriptShare.findFirst.mockResolvedValue(mockShare);
    mockPrisma.scriptShare.update.mockResolvedValue(mockShare);

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`, {
      method: 'PATCH',
      body: { password: 'newpassword' },
    });
    await PATCH(req, routeParams(SHARE_ID));

    const { hashPassword } = await import('@/lib/password');
    expect(hashPassword).toHaveBeenCalledWith('newpassword');

    expect(mockPrisma.scriptShare.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: '$2b$12$mockedhash' }),
      }),
    );
  });

  it('returns 500 when update fails', async () => {
    mockPrisma.scriptShare.findFirst.mockResolvedValue(mockShare);
    mockPrisma.scriptShare.update.mockRejectedValue(new Error('DB error'));

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`, {
      method: 'PATCH',
      body: { is_active: false },
    });
    const res = await PATCH(req, routeParams(SHARE_ID));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to update share');
  });
});

// =============================================================================
// DELETE /api/shares/[shareId]
// =============================================================================

describe('DELETE /api/shares/[shareId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`, {
      method: 'DELETE',
    });
    const res = await DELETE(req, routeParams(SHARE_ID));

    expect(res.status).toBe(401);
  });

  it('returns 404 when share not owned by user', async () => {
    mockPrisma.scriptShare.findFirst.mockResolvedValue(null);

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`, {
      method: 'DELETE',
    });
    const res = await DELETE(req, routeParams(SHARE_ID));

    expect(res.status).toBe(404);
  });

  it('soft-deletes share by deactivating', async () => {
    mockPrisma.scriptShare.findFirst.mockResolvedValue(mockShare);
    mockPrisma.scriptShare.update.mockResolvedValue({ ...mockShare, isActive: false });

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`, {
      method: 'DELETE',
    });
    const res = await DELETE(req, routeParams(SHARE_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.scriptShare.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SHARE_ID },
        data: { isActive: false },
      }),
    );
  });

  it('returns 500 when delete fails', async () => {
    mockPrisma.scriptShare.findFirst.mockResolvedValue(mockShare);
    mockPrisma.scriptShare.update.mockRejectedValue(new Error('DB error'));

    const req = createRequest(`http://localhost:22000/api/shares/${SHARE_ID}`, {
      method: 'DELETE',
    });
    const res = await DELETE(req, routeParams(SHARE_ID));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to delete share');
  });
});
