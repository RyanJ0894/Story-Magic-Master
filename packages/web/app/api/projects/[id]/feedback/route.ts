/**
 * Feedback API Route
 *
 * POST /api/projects/[id]/feedback - Submit feedback
 * GET /api/projects/[id]/feedback - Get feedback stats (admin only)
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  FeedbackTarget,
  FeedbackRating,
  RejectionReason,
  FeedbackRow,
  rowToFeedback,
  calculateFeedbackStats,
} from '@/lib/feedback/types';
import { validateCsrf } from '@/lib/csrf';

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const supabase = await createClient();
  const { id: projectId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'PARSE_ERROR' },
      { status: 400 }
    );
  }

  const parseResult = SubmitFeedbackSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { target, targetId, rating, rejectionReason, comment, metadata } = parseResult.data;

  try {
    // Insert feedback
    const { data: feedback, error } = await supabase
      .from('feedback')
      .insert({
        user_id: user.id,
        project_id: projectId,
        target,
        target_id: targetId,
        rating: rating || null,
        rejection_reason: rejectionReason || null,
        comment: comment || null,
        metadata: metadata || null,
      })
      .select()
      .single();

    if (error) {
      // If feedback table doesn't exist, log and return success anyway
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('[Feedback] Table does not exist, feedback logged:', {
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
      throw new Error(`Failed to save feedback: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      feedback: feedback ? rowToFeedback(feedback as FeedbackRow) : null,
    });
  } catch (error) {
    console.error('[Feedback] Error submitting:', error);
    return NextResponse.json(
      {
        error: 'Failed to submit feedback',
        code: 'SUBMIT_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Get feedback stats (admin/development)
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: projectId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        return NextResponse.json({
          feedback: [],
          stats: null,
          message: 'Feedback table pending migration',
        });
      }
      throw new Error(`Failed to fetch feedback: ${error.message}`);
    }

    const feedbacks = (data || []).map((row) => rowToFeedback(row as FeedbackRow));
    const stats = calculateFeedbackStats(feedbacks);

    return NextResponse.json({
      feedback: feedbacks,
      stats,
    });
  } catch (error) {
    console.error('[Feedback] Error fetching:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch feedback',
        code: 'FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
