/**
 * Suggestion Action API Route
 *
 * PATCH /api/projects/[id]/suggestions/[suggestionId] - Accept/reject/dismiss a suggestion
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isFeatureEnabled } from '@/lib/features';
import { withProjectAuth } from '@/lib/api/middleware';
import { getSuggestion, respondToSuggestion } from '@/lib/adviser';

// =============================================================================
// Validation
// =============================================================================

const UpdateSuggestionSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'dismissed']),
  feedback: z.string().optional(),
});

// =============================================================================
// PATCH - Update suggestion status
// =============================================================================

export const PATCH = withProjectAuth(
  async (request, { projectId }) => {
    if (!isFeatureEnabled('STORY_ADVISER')) {
      return NextResponse.json(
        { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
        { status: 403 }
      );
    }

    // Extract suggestionId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const suggestionId = pathParts[pathParts.length - 1];

    if (!suggestionId) {
      return NextResponse.json(
        { error: 'Suggestion ID required', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    // Verify suggestion belongs to this project
    const suggestion = await getSuggestion(suggestionId);
    if (!suggestion || suggestion.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Suggestion not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'PARSE_ERROR' },
        { status: 400 }
      );
    }

    const parseResult = UpdateSuggestionSchema.safeParse(body);
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

    try {
      const updated = await respondToSuggestion(
        suggestionId,
        parseResult.data.status,
        parseResult.data.feedback
      );

      return NextResponse.json({ success: true, suggestion: updated });
    } catch (error) {
      console.error('[Suggestions] Error updating:', error);
      return NextResponse.json(
        {
          error: 'Failed to update suggestion',
          code: 'UPDATE_ERROR',
        },
        { status: 500 }
      );
    }
  },
  { rateLimit: 'normal' }
);
