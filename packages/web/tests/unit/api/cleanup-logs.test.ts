/**
 * Tests for POST /api/cron/cleanup-logs
 *
 * Verifies:
 * - Missing / wrong CRON_SECRET → 401
 * - Correct secret → deleteMany called with 90-day cutoff, 200 returned
 * - Database error → 500 returned with structured body
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// Mocks
// =============================================================================

const mockDeleteMany = vi.fn();

const mockPrisma = {
  contentAccessLog: {
    deleteMany: mockDeleteMany,
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), error: vi.fn() } }));

// =============================================================================
// Import route after mocks
// =============================================================================

const { POST } = await import('@/app/api/cron/cleanup-logs/route');

// =============================================================================
// Helpers
// =============================================================================

const CRON_SECRET = 'test-cron-secret-abc123';

function makeRequest(secret?: string) {
  return new NextRequest('http://localhost/api/cron/cleanup-logs', {
    method: 'POST',
    headers: secret ? { 'x-cron-secret': secret } : {},
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/cron/cleanup-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    mockDeleteMany.mockResolvedValue({ count: 42 });
  });

  it('returns 401 when x-cron-secret header is missing', async () => {
    const req = makeRequest();
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it('returns 401 when x-cron-secret is wrong', async () => {
    const req = makeRequest('wrong-secret');
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it('calls deleteMany with a cutoff ~90 days ago and returns 200', async () => {
    const before = Date.now();
    const req = makeRequest(CRON_SECRET);
    const res = await POST(req);
    const after = Date.now();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe(42);

    // Verify deleteMany called with a cutoff date in the 90-day window
    expect(mockDeleteMany).toHaveBeenCalledOnce();
    const { where } = mockDeleteMany.mock.calls[0][0];
    const cutoff: Date = where.createdAt.lt;
    const expectedMin = new Date(before - 90 * 24 * 60 * 60 * 1000);
    const expectedMax = new Date(after - 90 * 24 * 60 * 60 * 1000);
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
    expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
  });

  it('returns 500 when the database throws', async () => {
    mockDeleteMany.mockRejectedValue(new Error('DB timeout'));
    const req = makeRequest(CRON_SECRET);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Cleanup failed');
  });
});
