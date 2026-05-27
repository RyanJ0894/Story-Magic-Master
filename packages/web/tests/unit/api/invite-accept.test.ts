/**
 * Tests for POST /api/invite/[token] — Accept Invite
 *
 * Regression coverage for:
 *   Bug: new Clerk users had no Profile row, causing a FK violation on
 *   teamMember.userId → profiles.id when accepting an invite.
 *   Fix: ensureProfile(userId) is called before teamMember.update.
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

// Track call order to verify ensureProfile is called BEFORE teamMember.update
const callOrder: string[] = [];

const mockEnsureProfile = vi.fn().mockImplementation(() => {
  callOrder.push('ensureProfile');
  return Promise.resolve({ id: 'user_new', fullName: 'New User', email: 'new@example.com' });
});
vi.mock('@/lib/ensure-profile', () => ({
  ensureProfile: (...args: unknown[]) => mockEnsureProfile(...args),
}));

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn().mockImplementation(() => {
  callOrder.push('teamMember.update');
  return Promise.resolve({ id: 'invite_id', status: 'accepted' });
});
const mockProfileFindUnique = vi.fn().mockResolvedValue({ fullName: 'New User' });
const mockAlertCreate = vi.fn().mockResolvedValue({});

vi.mock('@/lib/db', () => ({
  prisma: {
    teamMember: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    profile: {
      findUnique: (...args: unknown[]) => mockProfileFindUnique(...args),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    alert: {
      create: (...args: unknown[]) => mockAlertCreate(...args),
    },
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

const { POST } = await import('@/app/api/invite/[token]/route');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TOKEN = 'test-invite-token-abc123';
const USER_ID = 'user_new_clerk_id';
const TEAM_ID = '550e8400-e29b-41d4-a716-446655440001';

const MOCK_INVITE = {
  id: 'invite_id',
  teamId: TEAM_ID,
  status: 'pending',
  invitedEmail: 'new@example.com',
  team: {
    id: TEAM_ID,
    name: 'Test Team',
    ownerId: 'user_owner',
  },
};

function makeRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/invite/${TOKEN}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:22000',
      'X-Requested-With': 'story-magic',
    },
  });
}

function makeParams() {
  return { params: Promise.resolve({ token: TOKEN }) };
}

// =============================================================================
// POST — Accept invite
// =============================================================================

describe('POST /api/invite/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    mockAuth.mockReturnValue({ userId: USER_ID });
    // Distinguish the two findFirst calls by their where clause:
    //   - invite lookup   (where.inviteToken present) → MOCK_INVITE
    //   - membership check (where.status present)     → null (no duplicate membership)
    mockFindFirst.mockImplementation((args: { where?: Record<string, unknown> }) => {
      if (args?.where?.inviteToken !== undefined) return Promise.resolve(MOCK_INVITE);
      return Promise.resolve(null);
    });
    mockValidateCsrf.mockReturnValue(null);
  });

  // ── Regression: new user FK violation ─────────────────────────────────────

  it('calls ensureProfile before teamMember.update (FK ordering)', async () => {
    const res = await POST(makeRequest(), makeParams());

    expect(res.status).toBe(200);
    // Both were called
    expect(mockEnsureProfile).toHaveBeenCalledWith(USER_ID);
    expect(mockUpdate).toHaveBeenCalled();
    // ensureProfile must precede update — this is the regression
    expect(callOrder.indexOf('ensureProfile')).toBeLessThan(
      callOrder.indexOf('teamMember.update')
    );
  });

  it('accepts invite for a brand-new Clerk user (no prior dashboard visit)', async () => {
    const res = await POST(makeRequest(), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.team.id).toBe(TEAM_ID);
  });

  it('passes userId to teamMember.update', async () => {
    await POST(makeRequest(), makeParams());

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID, status: 'accepted' }),
      })
    );
  });

  // ── Auth checks ────────────────────────────────────────────────────────────

  it('returns 401 with AUTH_REQUIRED when unauthenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const res = await POST(makeRequest(), makeParams());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.code).toBe('AUTH_REQUIRED');
    expect(mockEnsureProfile).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // ── Token validation ───────────────────────────────────────────────────────

  it('returns 404 for unknown token', async () => {
    mockFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest(), makeParams());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.code).toBe('NOT_FOUND');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for already-accepted invite', async () => {
    mockFindFirst.mockResolvedValue({ ...MOCK_INVITE, status: 'accepted' });

    const res = await POST(makeRequest(), makeParams());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe('INVALID_STATUS');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  it('returns 500 when update throws (e.g. DB error)', async () => {
    mockUpdate.mockRejectedValue(new Error('DB constraint violation'));

    const res = await POST(makeRequest(), makeParams());
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.code).toBe('ACCEPT_ERROR');
  });
});
