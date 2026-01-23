/**
 * Rewrite Generation API Route
 *
 * POST /api/suggestions/[id]/rewrite - Generate rewrite options
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';
import { isFeatureEnabled } from '@/lib/features';
import { generateRewrites, getRewrites, selectRewrite } from '@/lib/adviser';

// =============================================================================
// Validation
// =============================================================================

const GenerateRewriteSchema = z.object({
  count: z.number().min(1).max(5).optional(),
  style: z.enum(['conservative', 'moderate', 'bold']).optional(),
});

const SelectRewriteSchema = z.object({
  rewriteId: z.string().uuid(),
});

// =============================================================================
// Helper to verify ownership
// =============================================================================

async function verifySuggestionOwnership(
  suggestionId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('suggestions')
    .select('project_id, projects!inner(user_id)')
    .eq('id', suggestionId)
    .single();

  if (!data) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectUserId = (data as any).projects?.user_id;
  return projectUserId === userId;
}

// =============================================================================
// GET - Get existing rewrites
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

  const owned = await verifySuggestionOwnership(suggestionId, user.id);
  if (!owned) {
    return NextResponse.json(
      { error: 'Suggestion not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  try {
    const rewrites = await getRewrites(suggestionId);

    return NextResponse.json({
      rewrites,
    });
  } catch (error) {
    console.error('[Rewrite] Error fetching:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch rewrites',
        code: 'FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Generate rewrites or select one
// =============================================================================

export async function POST(
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

  const owned = await verifySuggestionOwnership(suggestionId, user.id);
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
    body = {};
  }

  // Check if this is a select request
  const selectResult = SelectRewriteSchema.safeParse(body);
  if (selectResult.success) {
    try {
      const rewrite = await selectRewrite(selectResult.data.rewriteId);
      return NextResponse.json({
        success: true,
        selected: rewrite,
      });
    } catch (error) {
      console.error('[Rewrite] Error selecting:', error);
      return NextResponse.json(
        {
          error: 'Failed to select rewrite',
          code: 'SELECT_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }

  // Otherwise, generate rewrites
  const generateResult = GenerateRewriteSchema.safeParse(body);
  if (!generateResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: generateResult.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
  }

  try {
    const rewrites = await generateRewrites(suggestionId, {
      count: generateResult.data.count,
      style: generateResult.data.style,
    });

    return NextResponse.json({
      success: true,
      rewrites,
    });
  } catch (error) {
    console.error('[Rewrite] Error generating:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate rewrites',
        code: 'GENERATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
