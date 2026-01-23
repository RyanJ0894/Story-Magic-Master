/**
 * Individual Suggestion API Route
 *
 * GET /api/suggestions/[id] - Get suggestion details
 * PUT /api/suggestions/[id] - Respond to suggestion
 * DELETE /api/suggestions/[id] - Delete suggestion
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';
import { isFeatureEnabled } from '@/lib/features';
import {
  getSuggestion,
  respondToSuggestion,
  deleteSuggestion,
  getRewrites,
} from '@/lib/adviser';

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
  const supabase = await createClient();

  const { data } = await supabase
    .from('suggestions')
    .select('project_id, projects!inner(user_id)')
    .eq('id', suggestionId)
    .single();

  if (!data) return { owned: false };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectUserId = (data as any).projects?.user_id;
  return {
    owned: projectUserId === userId,
    projectId: data.project_id,
  };
}

// =============================================================================
// GET - Get suggestion details with rewrites
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled('STORY_ADVISER')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { id: suggestionId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const { owned } = await verifySuggestionOwnership(suggestionId, user.id);
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
    console.error('[Suggestion] Error fetching:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch suggestion',
        code: 'FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Respond to suggestion
// =============================================================================

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled('STORY_ADVISER')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json(
      { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { id: suggestionId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const { owned } = await verifySuggestionOwnership(suggestionId, user.id);
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
    console.error('[Suggestion] Error responding:', error);
    return NextResponse.json(
      {
        error: 'Failed to respond to suggestion',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete suggestion
// =============================================================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled('STORY_ADVISER')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json(
      { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { id: suggestionId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const { owned } = await verifySuggestionOwnership(suggestionId, user.id);
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
    console.error('[Suggestion] Error deleting:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete suggestion',
        code: 'DELETE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
