/**
 * Tests for Team Members API Route
 *
 * GET    /api/teams/[teamId]/members — list members
 * POST   /api/teams/[teamId]/members — invite member
 * DELETE /api/teams/[teamId]/members — remove member
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

// Mock prisma used inside withAuth
const mockPrisma = {};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

// Mock the teams service
const mockListMembers = vi.fn();
const mockAddMember = vi.fn();
const mockRemoveMember = vi.fn();

class MockTeamServiceError extends Error {
  code: string;
  statusCode: number;
  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'TeamServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

vi.mock('@/lib/services/teams', () => ({
  listMembers: (...args: unknown[]) => mockListMembers(...args),
  addMember: (...args: unknown[]) => mockAddMember(...args),
  removeMember: (...args: unknown[]) => mockRemoveMember(...args),
  TeamServiceError: MockTeamServiceError,
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

const { GET, POST, DELETE } = await import(
  '@/app/api/teams/[teamId]/members/route'
);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEAM_ID = '550e8400-e29b-41d4-a716-446655440010';
const USER_ID = 'user_teams_test';
const MEMBER_ID = '550e8400-e29b-41d4-a716-446655440011';

const MOCK_MEMBER = {
  id: MEMBER_ID,
  userId: 'user_other',
  invitedEmail: 'alice@example.com',
  role: 'member',
  status: 'active',
  joinedAt: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(method: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/teams/${TEAM_ID}/members`, {
    method,
    headers: { 'Content-Type': 'application/json', origin: 'http://localhost:22000' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams() {
  return { params: Promise.resolve({ teamId: TEAM_ID }) };
}

function setupAuth() {
  mockAuth.mockReturnValue({ userId: USER_ID });
}

// =============================================================================
// GET — List members
// =============================================================================

describe('GET /api/teams/[teamId]/members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it('returns member list for authenticated user', async () => {
    mockListMembers.mockResolvedValue({ members: [MOCK_MEMBER], teamId: TEAM_ID });

    const res = await GET(makeRequest('GET'), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members).toHaveLength(1);
    expect(data.members[0].invitedEmail).toBe('alice@example.com');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const res = await GET(makeRequest('GET'), makeParams());

    expect(res.status).toBe(401);
  });

  it('propagates TeamServiceError as the correct status code', async () => {
    mockListMembers.mockRejectedValue(
      new MockTeamServiceError('Team not found', 'TEAM_NOT_FOUND', 404)
    );

    const res = await GET(makeRequest('GET'), makeParams());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.code).toBe('TEAM_NOT_FOUND');
  });

  it('returns 500 on unexpected service error', async () => {
    mockListMembers.mockRejectedValue(new Error('DB crash'));

    const res = await GET(makeRequest('GET'), makeParams());

    expect(res.status).toBe(500);
  });
});

// =============================================================================
// POST — Invite member
// =============================================================================

describe('POST /api/teams/[teamId]/members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it('invites a member and returns 201', async () => {
    mockAddMember.mockResolvedValue({ member: MOCK_MEMBER });

    const req = makeRequest('POST', { email: 'alice@example.com', role: 'member' });
    const res = await POST(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(mockAddMember).toHaveBeenCalledWith(
      expect.anything(),
      TEAM_ID,
      USER_ID,
      { email: 'alice@example.com', role: 'member' }
    );
    expect(data.member).toBeDefined();
  });

  it('invites with no role (defaults to service)', async () => {
    mockAddMember.mockResolvedValue({ member: MOCK_MEMBER });

    const req = makeRequest('POST', { email: 'bob@example.com' });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(201);
    expect(mockAddMember).toHaveBeenCalledWith(
      expect.anything(),
      TEAM_ID,
      USER_ID,
      { email: 'bob@example.com', role: undefined }
    );
  });

  it('returns 400 for invalid email', async () => {
    const req = makeRequest('POST', { email: 'not-an-email' });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
    expect(mockAddMember).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid role value', async () => {
    const req = makeRequest('POST', { email: 'alice@example.com', role: 'superadmin' });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
    expect(mockAddMember).not.toHaveBeenCalled();
  });

  it('propagates TeamServiceError with correct status code', async () => {
    mockAddMember.mockRejectedValue(
      new MockTeamServiceError('Member already exists', 'MEMBER_EXISTS', 409)
    );

    const req = makeRequest('POST', { email: 'alice@example.com' });
    const res = await POST(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.code).toBe('MEMBER_EXISTS');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const req = makeRequest('POST', { email: 'test@example.com' });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(401);
  });
});

// =============================================================================
// DELETE — Remove member
// =============================================================================

describe('DELETE /api/teams/[teamId]/members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it('removes a member and returns success', async () => {
    mockRemoveMember.mockResolvedValue(undefined);

    const req = makeRequest('DELETE', { memberId: MEMBER_ID });
    const res = await DELETE(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRemoveMember).toHaveBeenCalledWith(
      expect.anything(),
      TEAM_ID,
      USER_ID,
      MEMBER_ID
    );
  });

  it('returns 400 for invalid memberId (not UUID)', async () => {
    const req = makeRequest('DELETE', { memberId: 'not-a-uuid' });
    const res = await DELETE(req, makeParams());

    expect(res.status).toBe(400);
    expect(mockRemoveMember).not.toHaveBeenCalled();
  });

  it('returns 400 when memberId is missing', async () => {
    const req = makeRequest('DELETE', {});
    const res = await DELETE(req, makeParams());

    expect(res.status).toBe(400);
  });

  it('propagates TeamServiceError as the correct status code', async () => {
    mockRemoveMember.mockRejectedValue(
      new MockTeamServiceError('Forbidden', 'FORBIDDEN', 403)
    );

    const req = makeRequest('DELETE', { memberId: MEMBER_ID });
    const res = await DELETE(req, makeParams());
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.code).toBe('FORBIDDEN');
  });

  it('returns 500 on unexpected error', async () => {
    mockRemoveMember.mockRejectedValue(new Error('Unexpected'));

    const req = makeRequest('DELETE', { memberId: MEMBER_ID });
    const res = await DELETE(req, makeParams());

    expect(res.status).toBe(500);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const req = makeRequest('DELETE', { memberId: MEMBER_ID });
    const res = await DELETE(req, makeParams());

    expect(res.status).toBe(401);
  });
});
