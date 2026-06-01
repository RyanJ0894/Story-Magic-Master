/**
 * Tests for Comments API
 * GET  /api/projects/[id]/comments
 * POST /api/projects/[id]/comments
 * DELETE /api/projects/[id]/comments/[commentId]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// Mocks
// =============================================================================

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));

const mockPrisma = {
  project: { findFirst: vi.fn() },
  teamShare: { findFirst: vi.fn() },
  scriptShare: { findFirst: vi.fn() },
  projectComment: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/comments/notify', () => ({ notifyNewComment: vi.fn() }));

const mockEnsureProfile = vi.fn().mockResolvedValue({ id: 'user_owner' });
vi.mock('@/lib/ensure-profile', () => ({
  ensureProfile: (...args: unknown[]) => mockEnsureProfile(...args),
}));

const { GET, POST } = await import('@/app/api/projects/[id]/comments/route');
const { DELETE } = await import('@/app/api/projects/[id]/comments/[commentId]/route');

// =============================================================================
// Helpers
// =============================================================================

const PROJECT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'user_owner';
const OTHER_USER_ID = 'user_other';
const COMMENT_ID = 'cccccccc-0000-0000-0000-000000000001';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeCommentParams(id: string, commentId: string) {
  return { params: Promise.resolve({ id, commentId }) };
}

function jsonRequest(body: unknown) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BASE_COMMENT = {
  id: COMMENT_ID,
  body: 'Nice delivery here.',
  reactionType: null,
  sceneIndex: 1,
  audioTimestampMs: 5200,
  createdAt: new Date('2026-05-15T12:00:00Z'),
  userId: USER_ID,
  author: { fullName: 'Ryan J.', email: 'ryan@example.com' },
};

const OWNER_PROJECT = { id: PROJECT_ID, userId: USER_ID, name: 'Test Script' };

// =============================================================================
// Tests
// =============================================================================

describe('GET /api/projects/[id]/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue(OWNER_PROJECT);
    mockPrisma.teamShare.findFirst.mockResolvedValue(null);
    mockPrisma.scriptShare.findFirst.mockResolvedValue(null);
    mockPrisma.projectComment.findMany.mockResolvedValue([BASE_COMMENT]);
  });

  it('returns comments with text alias for body', async () => {
    const res = await GET(new Request('http://localhost'), makeParams(PROJECT_ID));
    const json = await res.json() as { comments: { text: string; reactionType: null }[] };
    expect(res.status).toBe(200);
    expect(json.comments).toHaveLength(1);
    expect(json.comments[0].text).toBe('Nice delivery here.');
    expect(json.comments[0].reactionType).toBeNull();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await GET(new Request('http://localhost'), makeParams(PROJECT_ID));
    expect(res.status).toBe(401);
  });

  it('returns 404 for inaccessible project', async () => {
    mockAuth.mockResolvedValue({ userId: OTHER_USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue(OWNER_PROJECT);
    const res = await GET(new Request('http://localhost'), makeParams(PROJECT_ID));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/projects/[id]/comments — text note', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue(OWNER_PROJECT);
    mockPrisma.teamShare.findFirst.mockResolvedValue(null);
    mockPrisma.scriptShare.findFirst.mockResolvedValue(null);
    mockPrisma.projectComment.create.mockResolvedValue(BASE_COMMENT);
    mockPrisma.projectComment.deleteMany.mockResolvedValue({ count: 0 });
    mockEnsureProfile.mockResolvedValue({ id: USER_ID });
  });

  it('creates a comment with sceneIndex + audioTimestampMs', async () => {
    const res = await POST(
      jsonRequest({ text: 'Great line.', sceneIndex: 2, audioTimestampMs: 8100 }),
      makeParams(PROJECT_ID)
    );
    const json = await res.json() as { comment: { text: string } };
    expect(res.status).toBe(201);
    expect(mockPrisma.projectComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sceneIndex: 2, audioTimestampMs: 8100 }),
      })
    );
    expect(json.comment.text).toBe('Nice delivery here.');
  });

  it('accepts legacy body field as alias for text', async () => {
    const res = await POST(
      jsonRequest({ body: 'Legacy field.', sceneIndex: 1 }),
      makeParams(PROJECT_ID)
    );
    expect(res.status).toBe(201);
    expect(mockPrisma.projectComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ body: 'Legacy field.' }),
      })
    );
  });

  it('returns 400 when neither text nor reactionType provided', async () => {
    const res = await POST(
      jsonRequest({ sceneIndex: 1 }),
      makeParams(PROJECT_ID)
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /api/projects/[id]/comments — reaction upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.project.findFirst.mockResolvedValue(OWNER_PROJECT);
    mockPrisma.teamShare.findFirst.mockResolvedValue(null);
    mockPrisma.scriptShare.findFirst.mockResolvedValue(null);
    mockPrisma.projectComment.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.projectComment.create.mockResolvedValue({
      ...BASE_COMMENT,
      body: null,
      reactionType: 'like',
    });
    mockEnsureProfile.mockResolvedValue({ id: USER_ID });
  });

  it('deletes existing reaction for same user+scene then inserts new', async () => {
    const res = await POST(
      jsonRequest({ reactionType: 'like', sceneIndex: 1 }),
      makeParams(PROJECT_ID)
    );
    expect(res.status).toBe(201);
    expect(mockPrisma.projectComment.deleteMany).toHaveBeenCalledWith({
      where: { projectId: PROJECT_ID, userId: USER_ID, sceneIndex: 1, reactionType: { not: null } },
    });
    const json = await res.json() as { comment: { reactionType: string } };
    expect(json.comment.reactionType).toBe('like');
  });

  it('returns 400 for invalid reactionType', async () => {
    const res = await POST(
      jsonRequest({ reactionType: 'banana', sceneIndex: 1 }),
      makeParams(PROJECT_ID)
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/projects/[id]/comments/[commentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.projectComment.delete.mockResolvedValue(BASE_COMMENT);
  });

  it('deletes own comment', async () => {
    mockAuth.mockResolvedValue({ userId: USER_ID });
    mockPrisma.projectComment.findUnique.mockResolvedValue({ userId: USER_ID });
    const res = await DELETE(
      new Request('http://localhost', { method: 'DELETE' }),
      makeCommentParams(PROJECT_ID, COMMENT_ID)
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.projectComment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
  });

  it('returns 403 when non-owner tries to delete', async () => {
    mockAuth.mockResolvedValue({ userId: OTHER_USER_ID });
    mockPrisma.projectComment.findUnique.mockResolvedValue({ userId: USER_ID });
    const res = await DELETE(
      new Request('http://localhost', { method: 'DELETE' }),
      makeCommentParams(PROJECT_ID, COMMENT_ID)
    );
    expect(res.status).toBe(403);
    expect(mockPrisma.projectComment.delete).not.toHaveBeenCalled();
  });
});
