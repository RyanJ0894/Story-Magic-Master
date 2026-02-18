/**
 * Individual Suggestion API Route
 *
 * GET /api/suggestions/[id] - Get suggestion details
 * PUT /api/suggestions/[id] - Respond to suggestion
 * DELETE /api/suggestions/[id] - Delete suggestion
 */

import { withAuth } from '@/lib/api/middleware';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isFeatureEnabled } from '@/lib/features';
import {
  getSuggestion,
  respondToSuggestion,
  deleteSuggestion,
  getRewrites,
} from '@/lib/adviser';
import { log } from '@/lib/logger';

// =============================================================================
// Validation
// =============================================================================

const RespondSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'dismissed']),
  feedback: z.string().max(1000).optional(),
});

// =============================================================================
// Helper to verify ownership
// =============================================================================

async function verifySuggestionOwnership(
  suggestionId: string,
  userId: string
): Promise<{ owned: boolean; projectId?: string }> {
  const suggestion = await prisma.suggestion.findUnique({
    where: { id: suggestionId },
    select: {
      projectId: true,
      project: { select: { userId: true } },
    },
  });

  if (!suggestion) return { owned: false };

  return {
    owned: suggestion.project.userId === userId,
    projectId: suggestion.projectId,
  };
}

// =============================================================================
// GET - Get suggestion details with rewrites
// =============================================================================

export const GET = withAuth(async (_request, { userId, params }) => {
  if (!isFeatureEnabled('STORY_ADVISER')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const suggestionId = params.id;

  const { owned } = await verifySuggestionOwnership(suggestionId, userId);
  if (!owned) {
    return NextResponse.json(
      { error: 'Suggestion not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  try {
    const [suggestion, rewrites] = await Promise.all([
      getSuggestion(suggestionId),
      getRewrites(suggestionId),
    ]);

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      suggestion,
      rewrites,
    });
  } catch (error) {
    log.error('[Suggestion] Error fetching', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch suggestion',
        code: 'FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// PUT - Respond to suggestion
// =============================================================================

export const PUT = withAuth(async (request, { userId, params }) => {
  if (!isFeatureEnabled('STORY_ADVISER')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const suggestionId = params.id;

  const { owned } = await verifySuggestionOwnership(suggestionId, userId);
  if (!owned) {
    return NextResponse.json(
      { error: 'Suggestion not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON', code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  const parseResult = RespondSchema.safeParse(body);
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
    const suggestion = await respondToSuggestion(
      suggestionId,
      parseResult.data.status,
      parseResult.data.feedback
    );

    return NextResponse.json({
      success: true,
      suggestion,
    });
  } catch (error) {
    log.error('[Suggestion] Error responding', error);
    return NextResponse.json(
      {
        error: 'Failed to respond to suggestion',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

// =============================================================================
// DELETE - Delete suggestion
// =============================================================================

export const DELETE = withAuth(async (_request, { userId, params }) => {
  if (!isFeatureEnabled('STORY_ADVISER')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const suggestionId = params.id;

  const { owned } = await verifySuggestionOwnership(suggestionId, userId);
  if (!owned) {
    return NextResponse.json(
      { error: 'Suggestion not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  try {
    await deleteSuggestion(suggestionId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    log.error('[Suggestion] Error deleting', error);
    return NextResponse.json(
      {
        error: 'Failed to delete suggestion',
        code: 'DELETE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
