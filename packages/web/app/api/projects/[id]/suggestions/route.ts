/**
 * Suggestions API Route
 *
 * GET /api/projects/[id]/suggestions - List suggestions
 * POST /api/projects/[id]/suggestions - Generate new suggestions
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';
import { isFeatureEnabled } from '@/lib/features';
import {
  generateSuggestions,
  getSuggestions,
  getSuggestionStats,
  SUGGESTION_CATEGORIES,
  type SuggestionCategory,
  type SuggestionStatus,
} from '@/lib/adviser';

// =============================================================================
// Validation Schemas
// =============================================================================

const GenerateRequestSchema = z.object({
  scoreId: z.string().uuid().optional(),
  maxSuggestions: z.number().min(1).max(30).optional(),
  focusCategories: z
    .array(z.enum(Object.keys(SUGGESTION_CATEGORIES) as [string, ...string[]]))
    .optional(),
});

const QueryParamsSchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected', 'dismissed']).optional(),
  category: z.enum(Object.keys(SUGGESTION_CATEGORIES) as [string, ...string[]]).optional(),
});

// =============================================================================
// GET - List suggestions
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check feature flag
  if (!isFeatureEnabled('STORY_ADVISER')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { id: projectId } = await params;

  // Verify authentication
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
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
    );
  }

  // Parse query params
  const url = new URL(request.url);
  const queryParams = {
    status: url.searchParams.get('status') || undefined,
    category: url.searchParams.get('category') || undefined,
  };

  const parseResult = QueryParamsSchema.safeParse(queryParams);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const [suggestions, stats] = await Promise.all([
      getSuggestions(projectId, {
        status: parseResult.data.status as SuggestionStatus | undefined,
        category: parseResult.data.category as SuggestionCategory | undefined,
      }),
      getSuggestionStats(projectId),
    ]);

    return NextResponse.json({
      suggestions,
      stats,
    });
  } catch (error) {
    console.error('[Suggestions] Error fetching:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch suggestions',
        code: 'FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Generate suggestions
// =============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check feature flag
  if (!isFeatureEnabled('STORY_ADVISER')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json(
      { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { id: projectId } = await params;

  // Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parseResult = GenerateRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  // Fetch project with script text
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, user_id, script_text')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
    );
  }

  // Validate script text
  if (!project.script_text || project.script_text.trim().length < 100) {
    return NextResponse.json(
      {
        error: 'Script text is too short for analysis',
        code: 'SCRIPT_TOO_SHORT',
      },
      { status: 400 }
    );
  }

  // Check OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured', code: 'CONFIG_ERROR' },
      { status: 500 }
    );
  }

  try {
    const suggestions = await generateSuggestions(projectId, project.script_text, {
      scoreId: parseResult.data.scoreId,
      maxSuggestions: parseResult.data.maxSuggestions,
      focusCategories: parseResult.data.focusCategories as SuggestionCategory[],
    });

    const stats = await getSuggestionStats(projectId);

    return NextResponse.json({
      success: true,
      suggestions,
      stats,
    });
  } catch (error) {
    console.error('[Suggestions] Error generating:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate suggestions',
        code: 'GENERATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
