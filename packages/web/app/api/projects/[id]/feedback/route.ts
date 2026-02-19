/**
 * Feedback API Route
 *
 * POST /api/projects/[id]/feedback - Submit feedback
 * GET /api/projects/[id]/feedback - Get feedback stats (admin only)
 *
 * NOTE: No Prisma model for feedback yet. This route logs feedback
 * to console until the feedback table migration is applied.
 */

import { withProjectAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  FeedbackRow,
  rowToFeedback,
  calculateFeedbackStats,
} from '@/lib/feedback/types';
import { log } from '@/lib/logger';

// =============================================================================
// Validation
// =============================================================================

const SubmitFeedbackSchema = z.object({
  target: z.enum(['suggestion', 'rewrite', 'score', 'audio', 'general'] as const),
  targetId: z.string().min(1, 'Target ID is required'),
  rating: z.enum(['helpful', 'somewhat_helpful', 'not_helpful', 'harmful'] as const).optional(),
  rejectionReason: z
    .enum([
      'not_relevant',
      'already_addressed',
      'disagree',
      'too_vague',
      'wrong_location',
      'wrong_category',
      'other',
    ] as const)
    .optional(),
  comment: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// POST - Submit feedback
// =============================================================================

export const POST = withProjectAuth(async (request, { userId, prisma, projectId }) => {
  const parsed = await parseBody(request, SubmitFeedbackSchema);
  if ('error' in parsed) return parsed.error;

  const { target, targetId, rating, rejectionReason, comment, metadata } = parsed.data;

  try {
    // Insert feedback via raw SQL since no Prisma model exists yet
    const feedback = await prisma.$queryRaw<FeedbackRow[]>`
      INSERT INTO feedback (user_id, project_id, target, target_id, rating, rejection_reason, comment, metadata)
      VALUES (${userId}, ${projectId}::uuid, ${target}, ${targetId}, ${rating || null}, ${rejectionReason || null}, ${comment || null}, ${JSON.stringify(metadata || null)}::jsonb)
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      feedback: feedback[0] ? rowToFeedback(feedback[0]) : null,
    });
  } catch (error) {
    // If feedback table doesn't exist, log and return success anyway
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
      log.info('[Feedback] Table does not exist, feedback logged', {
        projectId,
        target,
        targetId,
        rating,
        rejectionReason,
      });
      return NextResponse.json({
        success: true,
        logged: true,
        message: 'Feedback logged (table pending migration)',
      });
    }

    log.error('[Feedback] Error submitting', error);
    return NextResponse.json(
      {
        error: 'Failed to submit feedback',
        code: 'SUBMIT_ERROR',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// GET - Get feedback stats (admin/development)
// =============================================================================

export const GET = withProjectAuth(async (_request, { prisma, projectId }) => {
  try {
    const data = await prisma.$queryRaw<FeedbackRow[]>`
      SELECT * FROM feedback
      WHERE project_id = ${projectId}::uuid
      ORDER BY created_at DESC
    `;

    const feedbacks = (data || []).map((row) => rowToFeedback(row));
    const stats = calculateFeedbackStats(feedbacks);

    return NextResponse.json({
      feedback: feedbacks,
      stats,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
      return NextResponse.json({
        feedback: [],
        stats: null,
        message: 'Feedback table pending migration',
      });
    }

    log.error('[Feedback] Error fetching', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch feedback',
        code: 'FETCH_ERROR',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
});
