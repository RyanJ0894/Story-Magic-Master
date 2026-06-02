/**
 * Tests for POST /api/teams — Create Team
 *
 * Regression coverage for:
 *   Bug #78: enterprise/team page called setTeams([res.json(), ...]) without
 *   unwrapping { team: {...} }. The raw JSON envelope was stored as a Team
 *   object → team.members was undefined → crash when rendering.
 *   Fix: page now calls loadTeams() after creation instead of manually
 *   splicing the unwrapped response.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockPrisma = {};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockListTeams = vi.fn();
const mockCreateTeam = vi.fn();

vi.mock('@/lib/services/teams', () => ({
  listTeams: (...args: unknown[]) => mockListTeams(...args),
  createTeam: (...args: unknown[]) => mockCreateTeam(...args),
}));

vi.mock('@/lib/api/middleware', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/middleware')>('@/lib/api/middleware');
  return {
    ...actual,
    withAuth: (handler: Function) => async (request: NextRequest, ctx: unknown) => {
      const { userId } = mockAuth();
      if (!userId) {
        const { NextResponse } = await import('next/server');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return handler(request, { userId, prisma: mockPrisma }, ctx);
    },
    parseBody: actual.parseBody,
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('POST /api/teams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: 'user_123' });
  });

  it('returns 201 with { team: {...} } envelope', async () => {
    const created = { id: 'team_abc', name: 'Acme', ownerId: 'user_123', createdAt: new Date() };
    mockCreateTeam.mockResolvedValue(created);

    const { POST } = await import('@/app/api/teams/route');
    const res = await POST(makeRequest({ name: 'Acme' }));

    expect(res.status).toBe(201);
    const body = await res.json();
    // The API wraps the result so clients MUST unwrap body.team
    expect(body).toHaveProperty('team');
    expect(body.team).toMatchObject({ id: 'team_abc', name: 'Acme' });
    // body itself is NOT a Team — it has no .members
    expect(body.members).toBeUndefined();
  });

  it('passes userId as ownerId to createTeam', async () => {
    mockCreateTeam.mockResolvedValue({ id: 'team_1', name: 'Test', ownerId: 'user_123' });

    const { POST } = await import('@/app/api/teams/route');
    await POST(makeRequest({ name: 'Test' }));

    expect(mockCreateTeam).toHaveBeenCalledWith(
      mockPrisma,
      'user_123',
      expect.objectContaining({ name: 'Test' }),
    );
  });

  it('returns 400 for missing name', async () => {
    const { POST } = await import('@/app/api/teams/route');
    const res = await POST(makeRequest({ name: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 500 on service error', async () => {
    mockCreateTeam.mockRejectedValue(new Error('DB connection failed'));

    const { POST } = await import('@/app/api/teams/route');
    const res = await POST(makeRequest({ name: 'Test' }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty('code', 'CREATE_ERROR');
  });

  it('returns 401 for unauthenticated request', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const { POST } = await import('@/app/api/teams/route');
    const res = await POST(makeRequest({ name: 'Test' }));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/teams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: 'user_123' });
  });

  it('returns teams list from service', async () => {
    const payload = { owned: [{ id: 't1', name: 'Owned', members: [] }], member: [], teams: [] };
    mockListTeams.mockResolvedValue(payload);

    const { GET } = await import('@/app/api/teams/route');
    const req = new NextRequest('http://localhost/api/teams');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.owned).toHaveLength(1);
    expect(body.owned[0]).toHaveProperty('members'); // shape includes members
  });
});
