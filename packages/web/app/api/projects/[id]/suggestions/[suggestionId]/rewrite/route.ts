/**
 * Rewrite Generation API Route
 *
 * POST /api/projects/[id]/suggestions/[suggestionId]/rewrite - Generate rewrites for a suggestion
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isFeatureEnabled } from '@/lib/features';
import { withProjectAuth } from '@/lib/api/middleware';
import { getSuggestion, generateRewrites } from '@/lib/adviser';

// =============================================================================
// Validation
// =============================================================================

const GenerateRewriteSchema = z.object({
  count: z.number().min(1).max(5).optional(),
  style: z.enum(['conservative', 'moderate', 'bold']).optional(),
});

// =============================================================================
// POST - Generate rewrites
// =============================================================================

export const POST = withProjectAuth(
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
    // URL pattern: /api/projects/[id]/suggestions/[suggestionId]/rewrite
    const suggestionId = pathParts[pathParts.length - 2];

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
      body = {};
    }

    const parseResult = GenerateRewriteSchema.safeParse(body);
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

    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    try {
      const rewrites = await generateRewrites(suggestionId, {
        count: parseResult.data.count,
        style: parseResult.data.style,
      });

      return NextResponse.json({
        success: true,
        rewrites,
      });
    } catch (error) {
      console.error('[Rewrites] Error generating:', error);
      return NextResponse.json(
        {
          error: 'Failed to generate rewrites',
          code: 'GENERATION_ERROR',
        },
        { status: 500 }
      );
    }
  },
  { rateLimit: 'strict' }
);
