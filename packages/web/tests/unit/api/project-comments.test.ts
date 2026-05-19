/**
 * Tests for Project Comments API
 *
 * GET/POST /api/projects/[id]/comments
 * DELETE   /api/projects/[id]/comments/[commentId]
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
  teamShare: { findFirst: vi.fn() },
  scriptShare: { findFirst: vi.fn() },
  projectComment: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  profile: { findUnique: vi.fn() },
  $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/comments/notify', () => ({
  notifyNewComment: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

const { GET, POST } = await import('@/app/api/projects/[id]/comments/route');
const { DELETE } = await import('@/app/api/projects/[id]/comments/[commentId]/route');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user_clerk123';
const OWNER_ID = 'owner_clerk456';
const COMMENT_ID = '660e8400-e29b-41d4-a716-446655440001';

const MOCK_PROJECT = { id: PROJECT_ID, userId: OWNER_ID, name: 'Test Project' };
const MOCK_COMMENT = {
  id: COMMENT_ID,
  body: 'Great scene!',
  sceneIndex: 0,
  audioTimestampMs: 12000,
  createdAt: new Date().toISOString(),
  userId: USER_ID,
  author: { fullName: 'Test User', email: 'test@test.com' },
};

function makeReq(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/projects/[id]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: OWNER_ID });
    mockPrisma.project.findFirst.mockResolvedValue(MOCK_PROJECT);
    mockPrisma.teamShare.findFirst.mockResolvedValue(null);
    mockPrisma.scriptShare.findFirst.mockResolvedValue(null);
    mockPrisma.projectComment.findMany.mockResolvedValue([MOCK_COMMENT]);
  });

  it('returns comments for project owner', async () => {
    const res = await GET(
      makeReq('GET', `https://app.com/api/projects/${PROJECT_ID}/comments`),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.comments).toHaveLength(1);
    expect(json.comments[0].text).toBe('Great scene!');
  });

  it('returns comments for TeamShare member', async () => {
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue({ ...MOCK_PROJECT, userId: 'someone_else' });
    mockPrisma.teamShare.findFirst.mockResolvedValue({ id: 'ts-1' });

    const res = await GET(
      makeReq('GET', `https://app.com/api/projects/${PROJECT_ID}/comments`),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    expect(res.status).toBe(200);
  });

  it('returns comments for ScriptShare recipient', async () => {
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue({ ...MOCK_PROJECT, userId: 'someone_else' });
    mockPrisma.teamShare.findFirst.mockResolvedValue(null);
    mockPrisma.scriptShare.findFirst.mockResolvedValue({ id: 'ss-1' });

    const res = await GET(
      makeReq('GET', `https://app.com/api/projects/${PROJECT_ID}/comments`),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    expect(res.status).toBe(200);
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const res = await GET(
      makeReq('GET', `https://app.com/api/projects/${PROJECT_ID}/comments`),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 for project without access', async () => {
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue({ ...MOCK_PROJECT, userId: 'different_owner' });
    mockPrisma.teamShare.findFirst.mockResolvedValue(null);
    mockPrisma.scriptShare.findFirst.mockResolvedValue(null);

    const res = await GET(
      makeReq('GET', `https://app.com/api/projects/${PROJECT_ID}/comments`),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('POST /api/projects/[id]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    // USER_ID is owner so access check passes
    mockPrisma.project.findFirst.mockResolvedValue({ ...MOCK_PROJECT, userId: USER_ID });
    mockPrisma.teamShare.findFirst.mockResolvedValue(null);
    mockPrisma.scriptShare.findFirst.mockResolvedValue(null);
    mockPrisma.projectComment.create.mockResolvedValue(MOCK_COMMENT);
  });

  it('creates a comment and returns 201', async () => {
    const res = await POST(
      makeReq('POST', `https://app.com/api/projects/${PROJECT_ID}/comments`, {
        body: 'Great scene!',
        sceneIndex: 0,
        audioTimestampMs: 12000,
      }),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.comment.text).toBe('Great scene!');
  });

  it('returns 400 for empty body', async () => {
    const res = await POST(
      makeReq('POST', `https://app.com/api/projects/${PROJECT_ID}/comments`, { body: '' }),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for body over 2000 chars', async () => {
    const res = await POST(
      makeReq('POST', `https://app.com/api/projects/${PROJECT_ID}/comments`, {
        body: 'a'.repeat(2001),
      }),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const res = await POST(
      makeReq('POST', `https://app.com/api/projects/${PROJECT_ID}/comments`, { body: 'hi' }),
      { params: Promise.resolve({ id: PROJECT_ID }) },
    );
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/projects/[id]/comments/[commentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ userId: USER_ID });
    mockPrisma.projectComment.findUnique.mockResolvedValue({ userId: USER_ID });
    mockPrisma.projectComment.delete.mockResolvedValue({});
  });

  it('deletes own comment', async () => {
    const res = await DELETE(
      makeReq('DELETE', `https://app.com/api/projects/${PROJECT_ID}/comments/${COMMENT_ID}`),
      { params: Promise.resolve({ id: PROJECT_ID, commentId: COMMENT_ID }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 403 when deleting another user\'s comment', async () => {
    mockPrisma.projectComment.findUnique.mockResolvedValue({ userId: 'someone_else' });
    const res = await DELETE(
      makeReq('DELETE', `https://app.com/api/projects/${PROJECT_ID}/comments/${COMMENT_ID}`),
      { params: Promise.resolve({ id: PROJECT_ID, commentId: COMMENT_ID }) },
    );
    expect(res.status).toBe(403);
  });

  it('returns 404 when comment not found', async () => {
    mockPrisma.projectComment.findUnique.mockResolvedValue(null);
    const res = await DELETE(
      makeReq('DELETE', `https://app.com/api/projects/${PROJECT_ID}/comments/${COMMENT_ID}`),
      { params: Promise.resolve({ id: PROJECT_ID, commentId: COMMENT_ID }) },
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockReturnValue({ userId: null });
    const res = await DELETE(
      makeReq('DELETE', `https://app.com/api/projects/${PROJECT_ID}/comments/${COMMENT_ID}`),
      { params: Promise.resolve({ id: PROJECT_ID, commentId: COMMENT_ID }) },
    );
    expect(res.status).toBe(401);
  });
});
