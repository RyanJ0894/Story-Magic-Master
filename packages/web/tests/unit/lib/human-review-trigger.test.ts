/**
 * Tests for lib/human-review/trigger.ts — triggerHumanReviewIfPurchased
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  purchase: { findFirst: vi.fn() },
  humanReview: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  project: { findUnique: vi.fn() },
  profile: { findUnique: vi.fn() },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockSendEmail = vi.fn();
vi.mock('@/lib/email/resend', () => ({
  sendHumanReviewRequestEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

const { triggerHumanReviewIfPurchased } = await import('@/lib/human-review/trigger');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = 'user_123';
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const JOB_ID = '660e8400-e29b-41d4-a716-446655440001';
const REVIEW_ID = '770e8400-e29b-41d4-a716-446655440002';
const ORCHESTRATOR_RESULT = { audioUrl: 'https://cdn.example.com/audio.m4a' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('triggerHumanReviewIfPurchased', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.purchase.findFirst.mockResolvedValue({ id: 'purchase-1' });
    mockPrisma.humanReview.findUnique.mockResolvedValue(null);
    mockPrisma.project.findUnique.mockResolvedValue({ name: 'My Screenplay' });
    mockPrisma.profile.findUnique.mockResolvedValue({ fullName: 'Jane Writer', email: 'jane@example.com' });
    mockPrisma.humanReview.create.mockResolvedValue({ id: REVIEW_ID });
    mockPrisma.humanReview.update.mockResolvedValue({});
    mockSendEmail.mockResolvedValue({ success: true });
  });

  it('creates review and sends email when purchase exists', async () => {
    await triggerHumanReviewIfPurchased(USER_ID, PROJECT_ID, JOB_ID, ORCHESTRATOR_RESULT);

    expect(mockPrisma.humanReview.create).toHaveBeenCalledOnce();
    expect(mockPrisma.humanReview.create).toHaveBeenCalledWith({
      data: { projectId: PROJECT_ID, jobId: JOB_ID, userId: USER_ID },
      select: { id: true },
    });
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it('returns early when no human_review purchase exists', async () => {
    mockPrisma.purchase.findFirst.mockResolvedValue(null);

    await triggerHumanReviewIfPurchased(USER_ID, PROJECT_ID, JOB_ID, ORCHESTRATOR_RESULT);

    expect(mockPrisma.humanReview.create).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('is idempotent — skips if review already exists for this job', async () => {
    mockPrisma.humanReview.findUnique.mockResolvedValue({ id: REVIEW_ID });

    await triggerHumanReviewIfPurchased(USER_ID, PROJECT_ID, JOB_ID, ORCHESTRATOR_RESULT);

    expect(mockPrisma.humanReview.create).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('updates notifiedReviewerAt when email succeeds', async () => {
    await triggerHumanReviewIfPurchased(USER_ID, PROJECT_ID, JOB_ID, ORCHESTRATOR_RESULT);

    expect(mockPrisma.humanReview.update).toHaveBeenCalledOnce();
    const updateCall = mockPrisma.humanReview.update.mock.calls[0][0];
    expect(updateCall.data.notifiedReviewerAt).toBeInstanceOf(Date);
  });

  it('does not update notifiedReviewerAt when email fails', async () => {
    mockSendEmail.mockResolvedValue({ success: false });

    await triggerHumanReviewIfPurchased(USER_ID, PROJECT_ID, JOB_ID, ORCHESTRATOR_RESULT);

    expect(mockPrisma.humanReview.update).not.toHaveBeenCalled();
  });

  it('resolves audioUrl from camelCase orchestrator result', async () => {
    await triggerHumanReviewIfPurchased(USER_ID, PROJECT_ID, JOB_ID, { audioUrl: 'https://cdn.example.com/a.m4a' });

    const emailArgs = mockSendEmail.mock.calls[0][0];
    expect(emailArgs.audioUrl).toBe('https://cdn.example.com/a.m4a');
  });

  it('resolves audioUrl from snake_case orchestrator result', async () => {
    await triggerHumanReviewIfPurchased(USER_ID, PROJECT_ID, JOB_ID, { audio_url: 'https://cdn.example.com/b.m4a' });

    const emailArgs = mockSendEmail.mock.calls[0][0];
    expect(emailArgs.audioUrl).toBe('https://cdn.example.com/b.m4a');
  });

  it('handles missing project/profile gracefully', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    mockPrisma.profile.findUnique.mockResolvedValue(null);

    await triggerHumanReviewIfPurchased(USER_ID, PROJECT_ID, JOB_ID, ORCHESTRATOR_RESULT);

    // Should still create review and attempt email with fallback names
    expect(mockPrisma.humanReview.create).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const emailArgs = mockSendEmail.mock.calls[0][0];
    expect(emailArgs.projectName).toBe('Untitled');
    expect(emailArgs.customerName).toBe('A customer');
  });
});
