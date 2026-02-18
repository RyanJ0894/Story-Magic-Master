/**
 * Story-Adviser Service
 *
 * Handles suggestion generation, storage, and rewrite creation.
 * Uses OpenAI GPT-4o for fast, cost-effective generation.
 */

import { getOpenAI } from '@/lib/ai/openai';
import { prisma } from '@/lib/db';
import { getLatestScore } from '@/lib/scoring';
import {
  Suggestion,
  Rewrite,
  SuggestionRow,
  RewriteRow,
  SuggestionCategory,
  SuggestionStatus,
  rowToSuggestion,
  rowToRewrite,
  suggestionToRow,
  sortSuggestions,
} from './types';
import {
  buildSuggestionPrompt,
  buildRewritePrompt,
  validateSuggestionsResponse,
  validateRewriteResponse,
  findExcerptInScript,
} from './prompts';

// =============================================================================
// Prisma-to-Row Adapters (type-safe camelCase → snake_case mapping)
// =============================================================================

/** Map Prisma suggestion result to SuggestionRow */
function toSuggestionRow(data: Record<string, unknown>): SuggestionRow {
  return {
    id: data.id as string,
    project_id: data.projectId as string,
    score_id: (data.scoreId as string | null) ?? null,
    start_line: data.startLine as number,
    end_line: data.endLine as number,
    start_char: (data.startChar as number | null) ?? null,
    end_char: (data.endChar as number | null) ?? null,
    excerpt: data.excerpt as string,
    scene_number: (data.sceneNumber as number | null) ?? null,
    scene_heading: (data.sceneHeading as string | null) ?? null,
    category: data.category as SuggestionRow['category'],
    severity: data.severity as SuggestionRow['severity'],
    title: data.title as string,
    explanation: data.explanation as string,
    suggestion: data.suggestion as string,
    status: data.status as SuggestionRow['status'],
    user_feedback: (data.userFeedback as string | null) ?? null,
    confidence: data.confidence as number,
    created_at: String(data.createdAt),
    responded_at: data.respondedAt ? String(data.respondedAt) : null,
  };
}

/** Map Prisma rewrite result to RewriteRow */
function toRewriteRow(data: Record<string, unknown>): RewriteRow {
  return {
    id: data.id as string,
    suggestion_id: data.suggestionId as string,
    original_text: data.originalText as string,
    rewritten_text: data.rewrittenText as string,
    explanation: data.explanation as string,
    style: (data.style as string | null) ?? null,
    selected: data.selected as boolean,
    created_at: String(data.createdAt),
  };
}

// =============================================================================
// Suggestion Generation
// =============================================================================

/**
 * Generate suggestions for a project's script.
 *
 * @param projectId - The project ID
 * @param scriptText - The script text to analyze
 * @param options - Generation options
 */
export async function generateSuggestions(
  projectId: string,
  scriptText: string,
  options?: {
    scoreId?: string;
    maxSuggestions?: number;
    focusCategories?: SuggestionCategory[];
    model?: string;
  }
): Promise<Suggestion[]> {
  const model = options?.model || 'gpt-4o';
  const maxSuggestions = options?.maxSuggestions || 15;

  // Get StoryScore if available (to focus on weak areas)
  let storyScore = null;
  if (options?.scoreId) {
    const data = await prisma.storyScore.findFirst({
      where: { id: options.scoreId },
    });

    if (data) {
      // Convert to StoryScore type (simplified for this use)
      storyScore = await getLatestScore(projectId);
    }
  } else {
    // Try to get latest score
    storyScore = await getLatestScore(projectId);
  }

  // Build the prompt
  const prompt = buildSuggestionPrompt(
    scriptText,
    storyScore,
    maxSuggestions,
    options?.focusCategories
  );

  // Call OpenAI
  const response = await getOpenAI().chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4, // Slightly higher for varied suggestions
    max_tokens: 8192,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from LLM');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse LLM response as JSON');
  }

  if (!validateSuggestionsResponse(parsed)) {
    throw new Error('LLM response does not match expected schema');
  }

  // Clear existing pending suggestions for this project
  await prisma.suggestion.deleteMany({
    where: {
      projectId,
      status: 'pending',
    },
  });

  // Process and store suggestions
  const suggestions: Suggestion[] = [];

  for (const raw of parsed.suggestions) {
    // Verify line numbers by finding excerpt in script
    const verified = findExcerptInScript(scriptText, raw.excerpt);
    const startLine = verified?.startLine || raw.startLine;
    const endLine = verified?.endLine || raw.endLine;

    const suggestion: Omit<Suggestion, 'id' | 'createdAt'> = {
      projectId,
      scoreId: storyScore?.id,
      location: {
        startLine,
        endLine,
        excerpt: raw.excerpt,
      },
      category: raw.category as SuggestionCategory,
      severity: raw.severity as 'critical' | 'important' | 'minor',
      title: raw.title,
      explanation: raw.explanation,
      suggestion: raw.suggestion,
      status: 'pending',
      confidence: raw.confidence,
    };

    const row = suggestionToRow(suggestion);

    try {
      const inserted = await prisma.suggestion.create({
        data: {
          projectId: row.project_id,
          scoreId: row.score_id || null,
          startLine: row.start_line,
          endLine: row.end_line,
          excerpt: row.excerpt,
          category: row.category,
          severity: row.severity,
          title: row.title,
          explanation: row.explanation,
          suggestion: row.suggestion,
          status: row.status,
          confidence: row.confidence,
        },
      });

      suggestions.push(rowToSuggestion(toSuggestionRow(inserted)));
    } catch (err) {
      console.error('Failed to insert suggestion:', err);
      continue;
    }
  }

  return sortSuggestions(suggestions);
}

// =============================================================================
// Suggestion Retrieval
// =============================================================================

/**
 * Get all suggestions for a project
 */
export async function getSuggestions(
  projectId: string,
  options?: {
    status?: SuggestionStatus;
    category?: SuggestionCategory;
  }
): Promise<Suggestion[]> {
  const where: Record<string, unknown> = { projectId };

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.category) {
    where.category = options.category;
  }

  const data = await prisma.suggestion.findMany({
    where,
    orderBy: { startLine: 'asc' },
  });

  return sortSuggestions(data.map((d) => rowToSuggestion(toSuggestionRow(d))));
}

/**
 * Get a single suggestion by ID
 */
export async function getSuggestion(suggestionId: string): Promise<Suggestion | null> {
  const data = await prisma.suggestion.findFirst({
    where: { id: suggestionId },
  });

  if (!data) {
    return null;
  }

  return rowToSuggestion(toSuggestionRow(data));
}

// =============================================================================
// Suggestion Actions
// =============================================================================

/**
 * Respond to a suggestion (accept, reject, or dismiss)
 */
export async function respondToSuggestion(
  suggestionId: string,
  status: 'accepted' | 'rejected' | 'dismissed',
  feedback?: string
): Promise<Suggestion> {
  try {
    const data = await prisma.suggestion.update({
      where: { id: suggestionId },
      data: {
        status,
        userFeedback: feedback || null,
        respondedAt: new Date(),
      },
    });

    return rowToSuggestion(toSuggestionRow(data));
  } catch (err) {
    throw new Error(`Failed to update suggestion: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete a suggestion
 */
export async function deleteSuggestion(suggestionId: string): Promise<void> {
  try {
    await prisma.suggestion.delete({
      where: { id: suggestionId },
    });
  } catch (err) {
    throw new Error(`Failed to delete suggestion: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// =============================================================================
// Rewrite Generation
// =============================================================================

/**
 * Generate rewrite options for a suggestion (on-demand)
 */
export async function generateRewrites(
  suggestionId: string,
  options?: {
    count?: number;
    style?: 'conservative' | 'moderate' | 'bold';
    model?: string;
  }
): Promise<Rewrite[]> {
  const model = options?.model || 'gpt-4o';
  const count = options?.count || 3;
  const style = options?.style || 'moderate';

  // Get the suggestion
  const suggestion = await getSuggestion(suggestionId);
  if (!suggestion) {
    throw new Error('Suggestion not found');
  }

  // Check if rewrites already exist
  const existing = await prisma.rewrite.findMany({
    where: { suggestionId },
  });

  if (existing && existing.length >= count) {
    return existing.map((d) => rowToRewrite(toRewriteRow(d)));
  }

  // Build prompt
  const prompt = buildRewritePrompt(
    suggestion.location.excerpt,
    {
      category: suggestion.category,
      title: suggestion.title,
      explanation: suggestion.explanation,
      suggestion: suggestion.suggestion,
    },
    count,
    style
  );

  // Call OpenAI
  const response = await getOpenAI().chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7, // Higher for creative rewrites
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from LLM');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse LLM response as JSON');
  }

  if (!validateRewriteResponse(parsed)) {
    throw new Error('LLM response does not match expected schema');
  }

  // Store rewrites
  const rewrites: Rewrite[] = [];

  for (const raw of parsed.rewrites) {
    try {
      const inserted = await prisma.rewrite.create({
        data: {
          suggestionId,
          originalText: suggestion.location.excerpt,
          rewrittenText: raw.rewrittenText,
          explanation: raw.explanation,
          selected: false,
        },
      });

      rewrites.push(rowToRewrite(toRewriteRow(inserted)));
    } catch (err) {
      console.error('Failed to insert rewrite:', err);
      continue;
    }
  }

  return rewrites;
}

/**
 * Get rewrites for a suggestion
 */
export async function getRewrites(suggestionId: string): Promise<Rewrite[]> {
  const data = await prisma.rewrite.findMany({
    where: { suggestionId },
    orderBy: { createdAt: 'asc' },
  });

  return data.map((d) => rowToRewrite(toRewriteRow(d)));
}

/**
 * Select a rewrite (mark as chosen)
 */
export async function selectRewrite(rewriteId: string): Promise<Rewrite> {
  // Get the rewrite to find suggestionId
  const rewrite = await prisma.rewrite.findFirst({
    where: { id: rewriteId },
  });

  if (!rewrite) {
    throw new Error('Rewrite not found');
  }

  // Deselect all other rewrites for this suggestion
  await prisma.rewrite.updateMany({
    where: { suggestionId: rewrite.suggestionId },
    data: { selected: false },
  });

  // Select this one
  try {
    const data = await prisma.rewrite.update({
      where: { id: rewriteId },
      data: { selected: true },
    });

    // Mark the suggestion as accepted
    await prisma.suggestion.update({
      where: { id: rewrite.suggestionId },
      data: {
        status: 'accepted',
        respondedAt: new Date(),
      },
    });

    return rowToRewrite(toRewriteRow(data));
  } catch (err) {
    throw new Error(`Failed to select rewrite: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// =============================================================================
// Statistics
// =============================================================================

/**
 * Get suggestion statistics for a project
 */
export async function getSuggestionStats(projectId: string): Promise<{
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  dismissed: number;
  critical: number;
  important: number;
  minor: number;
}> {
  try {
    const data = await prisma.$queryRaw<[{
      total: bigint;
      pending: bigint;
      accepted: bigint;
      rejected: bigint;
      dismissed: bigint;
      critical: bigint;
      important: bigint;
      minor: bigint;
    }]>`
      SELECT * FROM get_suggestion_stats(${projectId}::uuid)
    `;

    const row = data?.[0];
    return {
      total: Number(row?.total ?? 0),
      pending: Number(row?.pending ?? 0),
      accepted: Number(row?.accepted ?? 0),
      rejected: Number(row?.rejected ?? 0),
      dismissed: Number(row?.dismissed ?? 0),
      critical: Number(row?.critical ?? 0),
      important: Number(row?.important ?? 0),
      minor: Number(row?.minor ?? 0),
    };
  } catch (err) {
    throw new Error(`Failed to get stats: ${err instanceof Error ? err.message : String(err)}`);
  }
}
