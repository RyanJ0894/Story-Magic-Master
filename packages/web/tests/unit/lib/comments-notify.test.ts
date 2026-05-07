/**
 * Tests for lib/comments/notify.ts — notifyNewComment
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  profile: { findUnique: vi.fn() },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockSendEmail = vi.fn();
vi.mock('@/lib/email/resend', () => ({
  sendCommentNotificationEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

const { notifyNewComment } = await import('@/lib/comments/notify');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const OWNER_ID = 'user_owner123';

const MOCK_COMMENT = {
  id: 'comment-1',
  body: 'Loved the scene!',
  sceneIndex: 2,
  audioTimestampMs: 45000,
  author: { fullName: 'Alice Writer', email: 'alice@example.com' },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('notifyNewComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.profile.findUnique.mockResolvedValue({
      email: 'owner@example.com',
      fullName: 'Project Owner',
    });
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it('sends notification email to project owner', async () => {
    await notifyNewComment({
      projectId: PROJECT_ID,
      projectName: 'Test Script',
      comment: MOCK_COMMENT,
      ownerId: OWNER_ID,
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const args = mockSendEmail.mock.calls[0][0];
    expect(args.to).toBe('owner@example.com');
    expect(args.ownerName).toBe('Project Owner');
    expect(args.commenterName).toBe('Alice Writer');
    expect(args.projectName).toBe('Test Script');
    expect(args.commentBody).toBe('Loved the scene!');
    expect(args.projectUrl).toContain(PROJECT_ID);
  });

  it('returns early when owner profile not found', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);

    await notifyNewComment({
      projectId: PROJECT_ID,
      projectName: 'Test Script',
      comment: MOCK_COMMENT,
      ownerId: OWNER_ID,
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('returns early when owner has no email', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ email: null, fullName: 'No Email' });

    await notifyNewComment({
      projectId: PROJECT_ID,
      projectName: 'Test Script',
      comment: MOCK_COMMENT,
      ownerId: OWNER_ID,
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('falls back to email as commenter name when fullName is null', async () => {
    await notifyNewComment({
      projectId: PROJECT_ID,
      projectName: 'Test Script',
      comment: { ...MOCK_COMMENT, author: { fullName: null, email: 'anon@example.com' } },
      ownerId: OWNER_ID,
    });

    const args = mockSendEmail.mock.calls[0][0];
    expect(args.commenterName).toBe('anon@example.com');
  });

  it('uses fallback commenter name when both fullName and email are null', async () => {
    await notifyNewComment({
      projectId: PROJECT_ID,
      projectName: 'Test Script',
      comment: { ...MOCK_COMMENT, author: { fullName: null, email: null } },
      ownerId: OWNER_ID,
    });

    const args = mockSendEmail.mock.calls[0][0];
    expect(args.commenterName).toBe('A collaborator');
  });

  it('uses fallback owner name when fullName is null', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ email: 'owner@example.com', fullName: null });

    await notifyNewComment({
      projectId: PROJECT_ID,
      projectName: 'Test Script',
      comment: MOCK_COMMENT,
      ownerId: OWNER_ID,
    });

    const args = mockSendEmail.mock.calls[0][0];
    expect(args.ownerName).toBe('Creator');
  });
});
