/**
 * Feedback Loop Type Definitions
 *
 * Collects user feedback on AI-generated content to improve future outputs.
 * Supports suggestions, rewrites, scores, and general feedback.
 */

// =============================================================================
// Feedback Types
// =============================================================================

/**
 * Type of content the feedback is about
 */
export type FeedbackTarget = 'suggestion' | 'rewrite' | 'score' | 'audio' | 'general';

/**
 * Quick rating options for fast feedback
 */
export type FeedbackRating = 'helpful' | 'somewhat_helpful' | 'not_helpful' | 'harmful';

/**
 * Reasons for rejecting/dismissing suggestions
 */
export type RejectionReason =
  | 'not_relevant' // Doesn't apply to my script
  | 'already_addressed' // I've already handled this
  | 'disagree' // I intentionally wrote it this way
  | 'too_vague' // Need more specific guidance
  | 'wrong_location' // Highlighted wrong part of script
  | 'wrong_category' // Misclassified the issue
  | 'other'; // Custom reason

/**
 * Configuration for rejection reasons
 */
export const REJECTION_REASONS: Record<
  RejectionReason,
  { label: string; description: string }
> = {
  not_relevant: {
    label: 'Not Relevant',
    description: "This suggestion doesn't apply to my script",
  },
  already_addressed: {
    label: 'Already Addressed',
    description: "I've already handled this elsewhere",
  },
  disagree: {
    label: 'Intentional Choice',
    description: 'I wrote it this way on purpose',
  },
  too_vague: {
    label: 'Too Vague',
    description: 'Need more specific guidance',
  },
  wrong_location: {
    label: 'Wrong Location',
    description: 'The highlighted section is incorrect',
  },
  wrong_category: {
    label: 'Wrong Category',
    description: 'This issue is misclassified',
  },
  other: {
    label: 'Other',
    description: 'Another reason (please specify)',
  },
};

// =============================================================================
// Core Feedback Types
// =============================================================================

/**
 * A single feedback entry
 */
export interface Feedback {
  id: string;
  userId: string;
  projectId: string;

  // What the feedback is about
  target: FeedbackTarget;
  targetId: string; // ID of the suggestion, rewrite, score, etc.

  // Quick feedback
  rating?: FeedbackRating;

  // Detailed feedback for rejections
  rejectionReason?: RejectionReason;

  // Free-form feedback
  comment?: string;

  // Context
  metadata?: Record<string, unknown>;

  // Timestamps
  createdAt: string;
}

/**
 * Aggregated feedback stats
 */
export interface FeedbackStats {
  total: number;
  byRating: Record<FeedbackRating, number>;
  byTarget: Record<FeedbackTarget, number>;
  byRejectionReason: Record<RejectionReason, number>;
  avgHelpfulnessScore: number; // 0-100, where helpful=100, somewhat=66, not=33, harmful=0
}

// =============================================================================
// Database Row Types
// =============================================================================

export interface FeedbackRow {
  id: string;
  user_id: string;
  project_id: string;
  target: FeedbackTarget;
  target_id: string;
  rating: FeedbackRating | null;
  rejection_reason: RejectionReason | null;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// =============================================================================
// API Types
// =============================================================================

/**
 * Request to submit feedback
 */
export interface SubmitFeedbackRequest {
  target: FeedbackTarget;
  targetId: string;
  rating?: FeedbackRating;
  rejectionReason?: RejectionReason;
  comment?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Conversion Utilities
// =============================================================================

/**
 * Convert database row to Feedback object
 */
export function rowToFeedback(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    target: row.target,
    targetId: row.target_id,
    rating: row.rating || undefined,
    rejectionReason: row.rejection_reason || undefined,
    comment: row.comment || undefined,
    metadata: row.metadata || undefined,
    createdAt: row.created_at,
  };
}

/**
 * Convert Feedback to database row format
 */
export function feedbackToRow(
  feedback: Omit<Feedback, 'id' | 'createdAt'>
): Omit<FeedbackRow, 'id' | 'created_at'> {
  return {
    user_id: feedback.userId,
    project_id: feedback.projectId,
    target: feedback.target,
    target_id: feedback.targetId,
    rating: feedback.rating || null,
    rejection_reason: feedback.rejectionReason || null,
    comment: feedback.comment || null,
    metadata: feedback.metadata || null,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate helpfulness score from rating
 */
export function ratingToScore(rating: FeedbackRating): number {
  switch (rating) {
    case 'helpful':
      return 100;
    case 'somewhat_helpful':
      return 66;
    case 'not_helpful':
      return 33;
    case 'harmful':
      return 0;
    default:
      return 50;
  }
}

/**
 * Calculate average helpfulness from feedback array
 */
export function calculateHelpfulness(feedbacks: Feedback[]): number {
  const withRatings = feedbacks.filter((f) => f.rating);
  if (withRatings.length === 0) return 50;

  const total = withRatings.reduce(
    (sum, f) => sum + ratingToScore(f.rating!),
    0
  );
  return Math.round(total / withRatings.length);
}

/**
 * Calculate comprehensive feedback stats
 */
export function calculateFeedbackStats(feedbacks: Feedback[]): FeedbackStats {
  const stats: FeedbackStats = {
    total: feedbacks.length,
    byRating: {
      helpful: 0,
      somewhat_helpful: 0,
      not_helpful: 0,
      harmful: 0,
    },
    byTarget: {
      suggestion: 0,
      rewrite: 0,
      score: 0,
      audio: 0,
      general: 0,
    },
    byRejectionReason: {
      not_relevant: 0,
      already_addressed: 0,
      disagree: 0,
      too_vague: 0,
      wrong_location: 0,
      wrong_category: 0,
      other: 0,
    },
    avgHelpfulnessScore: calculateHelpfulness(feedbacks),
  };

  for (const f of feedbacks) {
    if (f.rating) stats.byRating[f.rating]++;
    stats.byTarget[f.target]++;
    if (f.rejectionReason) stats.byRejectionReason[f.rejectionReason]++;
  }

  return stats;
}
