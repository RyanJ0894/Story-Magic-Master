/**
 * Tests for Team Share API Route
 *
 * POST   /api/teams/share — assign project to team
 * DELETE /api/teams/share — remove project from team
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

const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockPrisma = {
  project: { findFirst: vi.fn() },
  team: { findUnique: vi.fn() },
  teamShare: { upsert: vi.fn(), deleteMany: vi.fn() },
  teamMember: { findMany: vi.fn().mockResolvedValue([]) },
  projectAssignment: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  $transaction: vi.fn(),
};
// Executes the transaction callback with the same mock so existing assertions still work.
mockPrisma.$transaction.mockImplementation(
  (cb: ((tx: typeof mockPrisma) => Promise<unknown>) | Promise<unknown>[]) => {
    if (typeof cb === 'function') return cb(mockPrisma);
    return Promise.all(cb);
  }
);
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const { POST, DELETE } = await import('@/app/api/teams/share/route');

// =============================================================================
// Helpers
// =============================================================================

const USER_ID = 'user_share_test';
const PROJECT_ID = '11111111-1111-1111-1111-111111111111';
const TEAM_ID = '22222222-2222-2222-2222-222222222222';

function makeRequest(method: 'POST' | 'DELETE', body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/teams/share', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// =============================================================================
// POST — assign project to team
// =============================================================================

describe('POST /api/teams/share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await POST(makeRequest('POST', { projectId: PROJECT_ID, teamId: TEAM_ID }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing projectId', async () => {
    const res = await POST(makeRequest('POST', { teamId: TEAM_ID }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid uuid projectId', async () => {
    const res = await POST(makeRequest('POST', { projectId: 'not-a-uuid', teamId: TEAM_ID }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid uuid teamId', async () => {
    const res = await POST(makeRequest('POST', { projectId: PROJECT_ID, teamId: 'bad' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when project not found or not owned', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest('POST', { projectId: PROJECT_ID, teamId: TEAM_ID }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe('PROJECT_NOT_FOUND');
  });

  it('returns 404 when team not found', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    mockPrisma.team.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest('POST', { projectId: PROJECT_ID, teamId: TEAM_ID }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe('TEAM_NOT_FOUND');
  });

  it('upserts share and returns 200 on success', async () => {
    const share = { id: 'share-1', projectId: PROJECT_ID, teamId: TEAM_ID, accessLevel: 'stream' };
    mockPrisma.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, name: 'Test Team', ownerId: USER_ID });
    mockPrisma.teamShare.upsert.mockResolvedValue(share);

    const res = await POST(makeRequest('POST', { projectId: PROJECT_ID, teamId: TEAM_ID }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.share).toEqual(share);
  });

  it('passes accessLevel to upsert when provided', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, name: 'T', ownerId: USER_ID });
    mockPrisma.teamShare.upsert.mockResolvedValue({ id: 'share-2' });

    await POST(makeRequest('POST', { projectId: PROJECT_ID, teamId: TEAM_ID, accessLevel: 'download' }));

    expect(mockPrisma.teamShare.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ accessLevel: 'download' }),
      })
    );
  });

  it('seeds ProjectAssignment rows for all active team members', async () => {
    const MEMBER_A = 'user_member_a';
    const MEMBER_B = 'user_member_b';
    mockPrisma.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, name: 'T', ownerId: USER_ID });
    mockPrisma.teamShare.upsert.mockResolvedValue({ id: 'share-3' });
    mockPrisma.teamMember.findMany.mockResolvedValue([
      { userId: MEMBER_A },
      { userId: MEMBER_B },
    ]);

    await POST(makeRequest('POST', { projectId: PROJECT_ID, teamId: TEAM_ID }));

    expect(mockPrisma.projectAssignment.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ projectId: PROJECT_ID, userId: MEMBER_A, teamId: TEAM_ID }),
        expect.objectContaining({ projectId: PROJECT_ID, userId: MEMBER_B, teamId: TEAM_ID }),
      ]),
      skipDuplicates: true,
    });
  });

  it('skips createMany when team has no active members', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    mockPrisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, name: 'T', ownerId: USER_ID });
    mockPrisma.teamShare.upsert.mockResolvedValue({ id: 'share-4' });
    mockPrisma.teamMember.findMany.mockResolvedValue([]);

    await POST(makeRequest('POST', { projectId: PROJECT_ID, teamId: TEAM_ID }));

    expect(mockPrisma.projectAssignment.createMany).not.toHaveBeenCalled();
  });
});

// =============================================================================
// DELETE — remove project from team
// =============================================================================

describe('DELETE /api/teams/share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(makeRequest('DELETE', { projectId: PROJECT_ID, teamId: TEAM_ID }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing fields', async () => {
    const res = await DELETE(makeRequest('DELETE', { projectId: PROJECT_ID }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when project not owned by user', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    const res = await DELETE(makeRequest('DELETE', { projectId: PROJECT_ID, teamId: TEAM_ID }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe('PROJECT_NOT_FOUND');
  });

  it('deletes share and returns 200 on success', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    mockPrisma.teamShare.deleteMany.mockResolvedValue({ count: 1 });

    const res = await DELETE(makeRequest('DELETE', { projectId: PROJECT_ID, teamId: TEAM_ID }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('scopes deleteMany to correct projectId and teamId', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    mockPrisma.teamShare.deleteMany.mockResolvedValue({ count: 1 });

    await DELETE(makeRequest('DELETE', { projectId: PROJECT_ID, teamId: TEAM_ID }));

    expect(mockPrisma.teamShare.deleteMany).toHaveBeenCalledWith({
      where: { projectId: PROJECT_ID, teamId: TEAM_ID },
    });
  });
});
