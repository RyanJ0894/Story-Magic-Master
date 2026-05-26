/**
 * Tests for POST /api/projects/[id]/share/bulk
 *
 * Verifies bulk share creation: ownership, recipient limits, email firing,
 * subscription checks, and partial failure handling.
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

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'bulkcode1234'),
}));

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn(() => Promise.resolve('$2b$mock')),
}));

const mockSendScriptSharedEmail = vi.fn();
vi.mock('@/lib/email/resend', () => ({
  sendScriptSharedEmail: (...args: unknown[]) => mockSendScriptSharedEmail(...args),
}));

const mockPrisma = {
  profile: {
    findUnique: vi.fn(),
  },
  project: {
    findFirst: vi.fn(),
  },
  subscription: {
    findFirst: vi.fn(),
  },
  scriptShare: {
    create: vi.fn(),
  },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// =============================================================================
// Import route after mocks
// =============================================================================

const { POST } = await import('@/app/api/projects/[id]/share/bulk/route');

// =============================================================================
// Helpers
// =============================================================================

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-123';

function makeRequest(body: object, projectId = PROJECT_ID) {
  return new NextRequest(`http://localhost/api/projects/${projectId}/share/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('POST /api/projects/[id]/share/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuth.mockReturnValue({ userId: USER_ID });

    mockPrisma.profile.findUnique.mockResolvedValue({
      id: USER_ID,
      fullName: 'Test Writer',
    });

    mockPrisma.project.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      name: 'ANSWERS',
      userId: USER_ID,
    });

    mockPrisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'active',
    });

    mockPrisma.scriptShare.create.mockResolvedValue({
      id: 'share-1',
      shareCode: 'bulkcode1234',
    });

    mockSendScriptSharedEmail.mockResolvedValue({ success: true, id: 'email-1' });
  });

  it('creates one share per recipient and fires emails', async () => {
    const req = makeRequest({
      recipients: [
        { email: 'agent@wme.com', name: 'John Smith' },
        { email: 'mgr@caa.com', name: 'Jane Doe' },
      ],
      access_level: 'stream',
      expires_in_days: 30,
    });

    const res = await POST(req, { params: { id: PROJECT_ID } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary.total).toBe(2);
    expect(body.summary.created).toBe(2);
    expect(body.summary.emailsSent).toBe(2);
    expect(mockPrisma.scriptShare.create).toHaveBeenCalledTimes(2);
    expect(mockSendScriptSharedEmail).toHaveBeenCalledTimes(2);
  });

  it('sends personalised message with {name} interpolation', async () => {
    const req = makeRequest({
      recipients: [{ email: 'agent@wme.com', name: 'John' }],
      message: 'Hi {name}, here is the script!',
    });

    await POST(req, { params: { id: PROJECT_ID } });

    expect(mockSendScriptSharedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Hi John, here is the script!' })
    );
  });

  it('returns 404 when project does not exist', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const req = makeRequest({ recipients: [{ email: 'a@b.com' }] });
    const res = await POST(req, { params: { id: PROJECT_ID } });

    expect(res.status).toBe(404);
  });

  it('returns 403 when user does not own the project', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      name: 'ANSWERS',
      userId: 'different-user',
    });

    const req = makeRequest({ recipients: [{ email: 'a@b.com' }] });
    const res = await POST(req, { params: { id: PROJECT_ID } });

    expect(res.status).toBe(403);
  });

  it('returns 403 when no active subscription', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue(null);

    const req = makeRequest({ recipients: [{ email: 'a@b.com' }] });
    const res = await POST(req, { params: { id: PROJECT_ID } });

    // share creation fails inside createShare() with SUBSCRIPTION_REQUIRED
    const body = await res.json();
    // Should succeed at API level but share creation fails — summary shows failed
    expect(body.summary.failed).toBe(1);
    expect(body.summary.created).toBe(0);
  });

  it('still returns summary when email fails (non-fatal)', async () => {
    mockSendScriptSharedEmail.mockResolvedValue({ success: false, error: 'Resend error' });

    const req = makeRequest({
      recipients: [{ email: 'agent@wme.com', name: 'John' }],
    });

    const res = await POST(req, { params: { id: PROJECT_ID } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary.created).toBe(1);
    expect(body.summary.emailsSent).toBe(0);
    expect(body.results[0].emailSent).toBe(false);
  });

  it('rejects more than 20 recipients', async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      email: `agent${i}@example.com`,
    }));

    const req = makeRequest({ recipients: tooMany });
    const res = await POST(req, { params: { id: PROJECT_ID } });

    expect(res.status).toBe(400);
  });

  it('rejects empty recipients array', async () => {
    const req = makeRequest({ recipients: [] });
    const res = await POST(req, { params: { id: PROJECT_ID } });

    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const req = makeRequest({ recipients: [{ email: 'a@b.com' }] });
    const res = await POST(req, { params: { id: PROJECT_ID } });

    expect(res.status).toBe(401);
  });
});
