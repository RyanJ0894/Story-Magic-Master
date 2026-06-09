/**
 * Story-Adviser Service
 *
 * Handles suggestion generation, storage, and rewrite creation.
 * Uses Claude Sonnet via providers.ts (T3-2 of cost-opt Phase 2).
 *
 * Migrated from raw OpenAI gpt-4o on 2026-06-09. See MODEL_MATRIX.md
 * history row for the rationale: Claude is materially cheaper per-token
 * for the same quality bar, and the migration moves Adviser onto the
 * same provider abstraction the rest of the web package uses.
 */

import { log } from '@/lib/logger';
import { generateText, resolveModel, MODELS } from '@/lib/ai/providers';
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
// Response cleaners
// =============================================================================

/**
 * Extract the first top-level JSON object from `text`. Claude sometimes wraps
 * JSON in ```json fences or includes a sentence of context before/after. We
 * find the outermost `{...}` block by walking the braces.
 *
 * If we can't find a balanced object, return the original text and let
 * `JSON.parse` produce the (informative) error.
 */
function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) return text;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text;
}

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
  // T3-2 of cost-opt: was 'gpt-4o', now Claude Sonnet via providers.ts.
  // Caller can still override `model` for one-off experiments.
  const model = options?.model || MODELS.PRODUCTION;
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

  // Call Claude via the providers.ts abstraction. Output is JSON wrapped in
  // the prompt instructions; we parse + validate the text exactly as the
  // legacy code did, only the upstream call shape changed.
  const { text } = await generateText({
    model: resolveModel(model),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4, // Slightly higher for varied suggestions
    maxOutputTokens: 8192,
  });

  if (!text) {
    throw new Error('No response from LLM');
  }

  // Claude sometimes wraps JSON in ```json fences or includes prose around
  // it. Strip fences + extract the first top-level JSON object.
  const cleaned = extractJsonObject(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
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
    } catch (error) {
      log.error('Failed to insert suggestion', error);
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

  return sortSuggestions(data.map((d: Record<string, unknown>) => rowToSuggestion(toSuggestionRow(d))));
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
  } catch (error) {
    throw new Error(`Failed to update suggestion: ${error instanceof Error ? error.message : String(error)}`);
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
  } catch (error) {
    throw new Error(`Failed to delete suggestion: ${error instanceof Error ? error.message : String(error)}`);
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
  // T3-2 of cost-opt: was 'gpt-4o', now Claude Sonnet.
  const model = options?.model || MODELS.PRODUCTION;
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
    return existing.map((d: Record<string, unknown>) => rowToRewrite(toRewriteRow(d)));
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

  // Call Claude via providers.ts.
  const { text } = await generateText({
    model: resolveModel(model),
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7, // Higher for creative rewrites
    maxOutputTokens: 4096,
  });

  if (!text) {
    throw new Error('No response from LLM');
  }

  const cleaned = extractJsonObject(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
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
    } catch (error) {
      log.error('Failed to insert rewrite', error);
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

  return data.map((d: Record<string, unknown>) => rowToRewrite(toRewriteRow(d)));
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
  } catch (error) {
    throw new Error(`Failed to select rewrite: ${error instanceof Error ? error.message : String(error)}`);
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
  } catch (error) {
    throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : String(error)}`);
  }
}
