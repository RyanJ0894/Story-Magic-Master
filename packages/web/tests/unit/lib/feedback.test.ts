import { describe, it, expect } from 'vitest';
import {
  Feedback,
  FeedbackRating,
  FeedbackTarget,
  RejectionReason,
  REJECTION_REASONS,
  rowToFeedback,
  feedbackToRow,
  ratingToScore,
  calculateHelpfulness,
  calculateFeedbackStats,
} from '@/lib/feedback/types';

describe('Feedback Types', () => {
  describe('REJECTION_REASONS', () => {
    it('should have all rejection reasons defined', () => {
      const reasons: RejectionReason[] = [
        'not_relevant',
        'already_addressed',
        'disagree',
        'too_vague',
        'wrong_location',
        'wrong_category',
        'other',
      ];

      reasons.forEach((reason) => {
        expect(REJECTION_REASONS[reason]).toBeDefined();
        expect(REJECTION_REASONS[reason].label).toBeTruthy();
        expect(REJECTION_REASONS[reason].description).toBeTruthy();
      });
    });

    it('should have 7 rejection reasons', () => {
      expect(Object.keys(REJECTION_REASONS)).toHaveLength(7);
    });
  });

  describe('ratingToScore', () => {
    it('should convert helpful to 100', () => {
      expect(ratingToScore('helpful')).toBe(100);
    });

    it('should convert somewhat_helpful to 66', () => {
      expect(ratingToScore('somewhat_helpful')).toBe(66);
    });

    it('should convert not_helpful to 33', () => {
      expect(ratingToScore('not_helpful')).toBe(33);
    });

    it('should convert harmful to 0', () => {
      expect(ratingToScore('harmful')).toBe(0);
    });
  });

  describe('calculateHelpfulness', () => {
    it('should return 50 for empty array', () => {
      expect(calculateHelpfulness([])).toBe(50);
    });

    it('should return 50 for feedbacks without ratings', () => {
      const feedbacks: Feedback[] = [
        createMockFeedback({ rating: undefined }),
        createMockFeedback({ rating: undefined }),
      ];
      expect(calculateHelpfulness(feedbacks)).toBe(50);
    });

    it('should calculate average correctly', () => {
      const feedbacks: Feedback[] = [
        createMockFeedback({ rating: 'helpful' }), // 100
        createMockFeedback({ rating: 'not_helpful' }), // 33
      ];
      // (100 + 33) / 2 = 66.5, rounded to 67
      expect(calculateHelpfulness(feedbacks)).toBe(67);
    });

    it('should return 100 for all helpful', () => {
      const feedbacks: Feedback[] = [
        createMockFeedback({ rating: 'helpful' }),
        createMockFeedback({ rating: 'helpful' }),
        createMockFeedback({ rating: 'helpful' }),
      ];
      expect(calculateHelpfulness(feedbacks)).toBe(100);
    });

    it('should return 0 for all harmful', () => {
      const feedbacks: Feedback[] = [
        createMockFeedback({ rating: 'harmful' }),
        createMockFeedback({ rating: 'harmful' }),
      ];
      expect(calculateHelpfulness(feedbacks)).toBe(0);
    });
  });

  describe('calculateFeedbackStats', () => {
    it('should calculate stats for empty array', () => {
      const stats = calculateFeedbackStats([]);

      expect(stats.total).toBe(0);
      expect(stats.avgHelpfulnessScore).toBe(50);
    });

    it('should count ratings correctly', () => {
      const feedbacks: Feedback[] = [
        createMockFeedback({ rating: 'helpful' }),
        createMockFeedback({ rating: 'helpful' }),
        createMockFeedback({ rating: 'somewhat_helpful' }),
        createMockFeedback({ rating: 'not_helpful' }),
      ];

      const stats = calculateFeedbackStats(feedbacks);

      expect(stats.total).toBe(4);
      expect(stats.byRating.helpful).toBe(2);
      expect(stats.byRating.somewhat_helpful).toBe(1);
      expect(stats.byRating.not_helpful).toBe(1);
      expect(stats.byRating.harmful).toBe(0);
    });

    it('should count targets correctly', () => {
      const feedbacks: Feedback[] = [
        createMockFeedback({ target: 'suggestion' }),
        createMockFeedback({ target: 'suggestion' }),
        createMockFeedback({ target: 'rewrite' }),
        createMockFeedback({ target: 'score' }),
      ];

      const stats = calculateFeedbackStats(feedbacks);

      expect(stats.byTarget.suggestion).toBe(2);
      expect(stats.byTarget.rewrite).toBe(1);
      expect(stats.byTarget.score).toBe(1);
      expect(stats.byTarget.audio).toBe(0);
    });

    it('should count rejection reasons correctly', () => {
      const feedbacks: Feedback[] = [
        createMockFeedback({ rejectionReason: 'not_relevant' }),
        createMockFeedback({ rejectionReason: 'disagree' }),
        createMockFeedback({ rejectionReason: 'disagree' }),
      ];

      const stats = calculateFeedbackStats(feedbacks);

      expect(stats.byRejectionReason.not_relevant).toBe(1);
      expect(stats.byRejectionReason.disagree).toBe(2);
      expect(stats.byRejectionReason.too_vague).toBe(0);
    });
  });

  describe('rowToFeedback', () => {
    it('should convert database row to Feedback object', () => {
      const row = {
        id: 'fb-123',
        user_id: 'user-456',
        project_id: 'project-789',
        target: 'suggestion' as FeedbackTarget,
        target_id: 'sug-111',
        rating: 'helpful' as FeedbackRating,
        rejection_reason: null,
        comment: 'Great suggestion!',
        metadata: { source: 'modal' },
        created_at: '2026-01-22T12:00:00Z',
      };

      const feedback = rowToFeedback(row);

      expect(feedback.id).toBe('fb-123');
      expect(feedback.userId).toBe('user-456');
      expect(feedback.projectId).toBe('project-789');
      expect(feedback.target).toBe('suggestion');
      expect(feedback.targetId).toBe('sug-111');
      expect(feedback.rating).toBe('helpful');
      expect(feedback.rejectionReason).toBeUndefined();
      expect(feedback.comment).toBe('Great suggestion!');
      expect(feedback.metadata).toEqual({ source: 'modal' });
    });

    it('should handle null optional fields', () => {
      const row = {
        id: 'fb-123',
        user_id: 'user-456',
        project_id: 'project-789',
        target: 'suggestion' as FeedbackTarget,
        target_id: 'sug-111',
        rating: null,
        rejection_reason: null,
        comment: null,
        metadata: null,
        created_at: '2026-01-22T12:00:00Z',
      };

      const feedback = rowToFeedback(row);

      expect(feedback.rating).toBeUndefined();
      expect(feedback.rejectionReason).toBeUndefined();
      expect(feedback.comment).toBeUndefined();
      expect(feedback.metadata).toBeUndefined();
    });
  });

  describe('feedbackToRow', () => {
    it('should convert Feedback to database row format', () => {
      const feedback: Omit<Feedback, 'id' | 'createdAt'> = {
        userId: 'user-456',
        projectId: 'project-789',
        target: 'suggestion',
        targetId: 'sug-111',
        rating: 'helpful',
        comment: 'Great!',
      };

      const row = feedbackToRow(feedback);

      expect(row.user_id).toBe('user-456');
      expect(row.project_id).toBe('project-789');
      expect(row.target).toBe('suggestion');
      expect(row.target_id).toBe('sug-111');
      expect(row.rating).toBe('helpful');
      expect(row.rejection_reason).toBeNull();
      expect(row.comment).toBe('Great!');
    });

    it('should convert undefined to null', () => {
      const feedback: Omit<Feedback, 'id' | 'createdAt'> = {
        userId: 'user-456',
        projectId: 'project-789',
        target: 'suggestion',
        targetId: 'sug-111',
      };

      const row = feedbackToRow(feedback);

      expect(row.rating).toBeNull();
      expect(row.rejection_reason).toBeNull();
      expect(row.comment).toBeNull();
      expect(row.metadata).toBeNull();
    });
  });
});

// Helper function to create mock feedback
function createMockFeedback(
  overrides: Partial<{
    rating: FeedbackRating;
    target: FeedbackTarget;
    rejectionReason: RejectionReason;
  }>
): Feedback {
  return {
    id: `fb-${Math.random().toString(36).substring(7)}`,
    userId: 'user-123',
    projectId: 'project-123',
    target: overrides.target ?? 'suggestion',
    targetId: 'target-123',
    rating: overrides.rating,
    rejectionReason: overrides.rejectionReason,
    createdAt: new Date().toISOString(),
  };
}
