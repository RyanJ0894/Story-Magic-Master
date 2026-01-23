/**
 * Story-Adviser Service
 *
 * Handles suggestion generation, storage, and rewrite creation.
 * Uses OpenAI GPT-4o for fast, cost-effective generation.
 */

import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
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

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  const supabase = await createClient();

  // Get StoryScore if available (to focus on weak areas)
  let storyScore = null;
  if (options?.scoreId) {
    const { data } = await supabase
      .from('story_scores')
      .select('*')
      .eq('id', options.scoreId)
      .single();

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
  const response = await openai.chat.completions.create({
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
  await supabase
    .from('suggestions')
    .delete()
    .eq('project_id', projectId)
    .eq('status', 'pending');

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

    const { data: inserted, error } = await supabase
      .from('suggestions')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('Failed to insert suggestion:', error);
      continue;
    }

    suggestions.push(rowToSuggestion(inserted as SuggestionRow));
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
  const supabase = await createClient();

  let query = supabase
    .from('suggestions')
    .select('*')
    .eq('project_id', projectId)
    .order('start_line', { ascending: true });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.category) {
    query = query.eq('category', options.category);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch suggestions: ${error.message}`);
  }

  return sortSuggestions((data as SuggestionRow[]).map(rowToSuggestion));
}

/**
 * Get a single suggestion by ID
 */
export async function getSuggestion(suggestionId: string): Promise<Suggestion | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('suggestions')
    .select('*')
    .eq('id', suggestionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch suggestion: ${error.message}`);
  }

  return rowToSuggestion(data as SuggestionRow);
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('suggestions')
    .update({
      status,
      user_feedback: feedback || null,
      responded_at: new Date().toISOString(),
    })
    .eq('id', suggestionId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update suggestion: ${error.message}`);
  }

  return rowToSuggestion(data as SuggestionRow);
}

/**
 * Delete a suggestion
 */
export async function deleteSuggestion(suggestionId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('suggestions')
    .delete()
    .eq('id', suggestionId);

  if (error) {
    throw new Error(`Failed to delete suggestion: ${error.message}`);
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
  const supabase = await createClient();

  // Get the suggestion
  const suggestion = await getSuggestion(suggestionId);
  if (!suggestion) {
    throw new Error('Suggestion not found');
  }

  // Check if rewrites already exist
  const { data: existing } = await supabase
    .from('rewrites')
    .select('*')
    .eq('suggestion_id', suggestionId);

  if (existing && existing.length >= count) {
    return (existing as RewriteRow[]).map(rowToRewrite);
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
  const response = await openai.chat.completions.create({
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
    const { data: inserted, error } = await supabase
      .from('rewrites')
      .insert({
        suggestion_id: suggestionId,
        original_text: suggestion.location.excerpt,
        rewritten_text: raw.rewrittenText,
        explanation: raw.explanation,
        selected: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert rewrite:', error);
      continue;
    }

    rewrites.push(rowToRewrite(inserted as RewriteRow));
  }

  return rewrites;
}

/**
 * Get rewrites for a suggestion
 */
export async function getRewrites(suggestionId: string): Promise<Rewrite[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('rewrites')
    .select('*')
    .eq('suggestion_id', suggestionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch rewrites: ${error.message}`);
  }

  return (data as RewriteRow[]).map(rowToRewrite);
}

/**
 * Select a rewrite (mark as chosen)
 */
export async function selectRewrite(rewriteId: string): Promise<Rewrite> {
  const supabase = await createClient();

  // Get the rewrite to find suggestion_id
  const { data: rewrite, error: fetchError } = await supabase
    .from('rewrites')
    .select('*')
    .eq('id', rewriteId)
    .single();

  if (fetchError || !rewrite) {
    throw new Error('Rewrite not found');
  }

  // Deselect all other rewrites for this suggestion
  await supabase
    .from('rewrites')
    .update({ selected: false })
    .eq('suggestion_id', rewrite.suggestion_id);

  // Select this one
  const { data, error } = await supabase
    .from('rewrites')
    .update({ selected: true })
    .eq('id', rewriteId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to select rewrite: ${error.message}`);
  }

  // Mark the suggestion as accepted
  await supabase
    .from('suggestions')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
    })
    .eq('id', rewrite.suggestion_id);

  return rowToRewrite(data as RewriteRow);
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
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_suggestion_stats', {
    p_project_id: projectId,
  });

  if (error) {
    throw new Error(`Failed to get stats: ${error.message}`);
  }

  return data?.[0] || {
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    dismissed: 0,
    critical: 0,
    important: 0,
    minor: 0,
  };
}
