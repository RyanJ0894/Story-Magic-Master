/**
 * Tests for POST /api/shares/access/[code]/play
 *
 * Verifies play/complete event tracking:
 * - playCount incremented only on 'play' action (not 'complete')
 * - ContentAccessLog row created for both actions
 * - IP + user-agent captured
 * - Invalid/inactive shares rejected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// Mocks
// =============================================================================

const mockShareFindFirst = vi.fn();
const mockShareUpdate = vi.fn();
const mockLogCreate = vi.fn();

const mockPrisma = {
  scriptShare: {
    findFirst: mockShareFindFirst,
    update: mockShareUpdate,
  },
  contentAccessLog: {
    create: mockLogCreate,
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// =============================================================================
// Import route after mocks
// =============================================================================

const { POST } = await import('@/app/api/shares/access/[code]/play/route');

// =============================================================================
// Helpers
// =============================================================================

const mockShare = {
  id: 'share-uuid-1',
  projectId: 'project-uuid-1',
  playCount: 3,
};

function makeRequest(code: string, body?: object, headers?: Record<string, string>) {
  return new NextRequest(`http://localhost/api/shares/access/${code}/play`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': 'TestBrowser/1.0',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/shares/access/[code]/play', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShareFindFirst.mockResolvedValue(mockShare);
    mockShareUpdate.mockResolvedValue({ ...mockShare, playCount: 4 });
    mockLogCreate.mockResolvedValue({ id: 'log-1' });
  });

  it('increments playCount and writes ContentAccessLog on play action', async () => {
    const req = makeRequest('abc123def', { action: 'play' });
    const res = await POST(req, { params: Promise.resolve({ code: 'abc123def' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.action).toBe('play');

    expect(mockShareUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          playCount: { increment: 1 }, // atomic Prisma increment
        }),
      })
    );

    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'project-uuid-1',
          shareId: 'share-uuid-1',
          accessType: 'play',
          userAgent: 'TestBrowser/1.0',
        }),
      })
    );
  });

  it('does NOT increment playCount on complete action', async () => {
    const req = makeRequest('abc123def', { action: 'complete', progressPct: 100 });
    const res = await POST(req, { params: Promise.resolve({ code: 'abc123def' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBe('complete');

    // playCount update should NOT be called
    expect(mockShareUpdate).not.toHaveBeenCalled();

    // ContentAccessLog should still be written
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessType: 'complete',
        }),
      })
    );
  });

  it('defaults to play action when no body provided', async () => {
    const req = makeRequest('abc123def');
    const res = await POST(req, { params: Promise.resolve({ code: 'abc123def' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBe('play');
    expect(mockShareUpdate).toHaveBeenCalled();
  });

  it('returns 404 when share not found or inactive', async () => {
    mockShareFindFirst.mockResolvedValue(null);

    const req = makeRequest('nonexistent1');
    const res = await POST(req, { params: Promise.resolve({ code: 'nonexistent1' }) });

    expect(res.status).toBe(404);
    expect(mockShareUpdate).not.toHaveBeenCalled();
    expect(mockLogCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for code shorter than 6 chars', async () => {
    const req = makeRequest('abc');
    const res = await POST(req, { params: Promise.resolve({ code: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('captures x-forwarded-for IP in ContentAccessLog', async () => {
    const req = makeRequest(
      'abc123def',
      { action: 'play' },
      { 'x-forwarded-for': '203.0.113.42, 10.0.0.1' }
    );
    const res = await POST(req, { params: Promise.resolve({ code: 'abc123def' }) });

    expect(res.status).toBe(200);
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ipAddress: '203.0.113.42', // first IP only
        }),
      })
    );
  });
});
