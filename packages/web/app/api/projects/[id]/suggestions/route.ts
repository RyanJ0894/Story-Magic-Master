/**
 * Suggestions API Route
 *
 * GET /api/projects/[id]/suggestions - List suggestions
 * POST /api/projects/[id]/suggestions - Generate new suggestions
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isFeatureEnabled } from '@/lib/features';
import { withProjectAuth } from '@/lib/api/middleware';
import {
  generateSuggestions,
  getSuggestions,
  getSuggestionStats,
  SUGGESTION_CATEGORIES,
  type SuggestionCategory,
  type SuggestionStatus,
} from '@/lib/adviser';
import { log } from '@/lib/logger';

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

export const GET = withProjectAuth(
  async (request, { projectId }) => {
    if (!isFeatureEnabled('STORY_ADVISER')) {
      return NextResponse.json(
        { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
        { status: 403 }
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
      log.error('[Suggestions] Error fetching', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch suggestions',
          code: 'FETCH_ERROR',
        },
        { status: 500 }
      );
    }
  },
  { rateLimit: 'normal' }
);

// =============================================================================
// POST - Generate suggestions
// =============================================================================

export const POST = withProjectAuth(
  async (request, { projectId, project }) => {
    if (!isFeatureEnabled('STORY_ADVISER')) {
      return NextResponse.json(
        { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
        { status: 403 }
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

    // Validate script text
    const scriptText = project.script_text as string | undefined;
    if (!scriptText || scriptText.trim().length < 100) {
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
      const suggestions = await generateSuggestions(projectId, scriptText, {
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
      log.error('[Suggestions] Error generating', error);
      return NextResponse.json(
        {
          error: 'Failed to generate suggestions',
          code: 'GENERATION_ERROR',
        },
        { status: 500 }
      );
    }
  },
  { rateLimit: 'strict' }
);
