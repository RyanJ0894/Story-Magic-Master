/**
 * StoryScore API Route
 *
 * POST /api/projects/[id]/score - Generate a new score for a project
 * GET /api/projects/[id]/score - Get the latest score for a project
 * GET /api/projects/[id]/score?history=true - Get all score versions
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';
import { isFeatureEnabled } from '@/lib/features';
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check feature flag
  if (!isFeatureEnabled('STORY_SCORE')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { id: projectId } = await params;

  // Verify authentication
  const { data: { user } } = await supabase.auth.getUser();
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
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Generate new score
// =============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check feature flag
  if (!isFeatureEnabled('STORY_SCORE')) {
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
  const { data: { user } } = await supabase.auth.getUser();
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

  // Fetch project with script text
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, user_id, name, script_text')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
      { status: 404 }
    );
  }

  // Validate script text exists
  if (!project.script_text || project.script_text.trim().length < 100) {
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
    const score = await generateScore(projectId, project.script_text, {
      title: parseResult.data.title || project.name,
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
}
