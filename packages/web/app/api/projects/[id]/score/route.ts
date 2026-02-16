/**
 * StoryScore API Route
 *
 * POST /api/projects/[id]/score - Generate a new score for a project
 * GET /api/projects/[id]/score - Get the latest score for a project
 * GET /api/projects/[id]/score?history=true - Get all score versions
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isFeatureEnabled } from '@/lib/features';
import { withProjectAuth, parseBody } from '@/lib/api/middleware';
import {
  generateScore,
  getLatestScore,
  getScoreHistory,
  type GenerateScoreResponse,
} from '@/lib/scoring';

// =============================================================================
// Input Validation
// =============================================================================

const GenerateScoreRequestSchema = z.object({
  title: z.string().optional(),
  genre: z.string().optional(),
  logline: z.string().optional(),
  model: z.enum(['gpt-4o', 'gpt-4-turbo', 'gpt-4']).optional(),
});

// =============================================================================
// GET - Fetch scores
// =============================================================================

export const GET = withProjectAuth(
  async (request, { projectId }) => {
    // Check feature flag
    if (!isFeatureEnabled('STORY_SCORE')) {
      return NextResponse.json(
        { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
        { status: 403 }
      );
    }

    // Check if requesting history
    const url = new URL(request.url);
    const requestHistory = url.searchParams.get('history') === 'true';

    try {
      if (requestHistory) {
        const scores = await getScoreHistory(projectId);
        return NextResponse.json({ scores });
      } else {
        const score = await getLatestScore(projectId);
        if (!score) {
          return NextResponse.json(
            { score: null, message: 'No score exists for this project' },
            { status: 200 }
          );
        }
        return NextResponse.json({ score });
      }
    } catch (error) {
      console.error('[StoryScore] Error fetching score:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch score',
          code: 'FETCH_ERROR',
        },
        { status: 500 }
      );
    }
  },
  { rateLimit: 'normal' }
);

// =============================================================================
// POST - Generate new score
// =============================================================================

export const POST = withProjectAuth(
  async (request, { projectId, project }) => {
    // Check feature flag
    if (!isFeatureEnabled('STORY_SCORE')) {
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
      body = {}; // Allow empty body
    }

    const parseResult = GenerateScoreRequestSchema.safeParse(body);
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

    // Validate script text exists
    const scriptText = project.script_text as string | undefined;
    if (!scriptText || scriptText.trim().length < 100) {
      return NextResponse.json(
        {
          error: 'Script text is too short for evaluation (minimum 100 characters)',
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
      const score = await generateScore(projectId, scriptText, {
        title: parseResult.data.title || (project.name as string),
        genre: parseResult.data.genre,
        logline: parseResult.data.logline,
        model: parseResult.data.model,
      });

      const response: GenerateScoreResponse = {
        success: true,
        score,
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('[StoryScore] Error generating score:', error);

      const response: GenerateScoreResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate score',
      };

      return NextResponse.json(response, { status: 500 });
    }
  },
  { rateLimit: 'strict' }
);
