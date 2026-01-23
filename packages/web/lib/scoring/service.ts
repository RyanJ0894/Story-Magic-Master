/**
 * StoryScore Service
 *
 * Handles LLM-based screenplay evaluation using OpenAI GPT-4.
 * Provides scoring, caching, and database persistence.
 */

import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import {
  StoryScore,
  DimensionScores,
  DimensionKey,
  DIMENSIONS,
  calculateCategoryScore,
  calculateOverallScore,
  calculateRating,
  storyScoreToRow,
  rowToStoryScore,
  StoryScoreRow,
} from './types';
import { buildScoringPrompt, validateLLMResponse } from './prompts';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a new score for a project's script
 */
export async function generateScore(
  projectId: string,
  scriptText: string,
  options?: {
    title?: string;
    genre?: string;
    logline?: string;
    model?: string;
  }
): Promise<StoryScore> {
  const model = options?.model || 'gpt-4o';
  const supabase = await createClient();

  // Build the scoring prompt
  const prompt = buildScoringPrompt(
    scriptText,
    options?.title,
    options?.genre,
    options?.logline
  );

  // Call OpenAI
  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3, // Lower temperature for more consistent scoring
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  });

  // Extract and parse the response
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

  // Validate response structure
  if (!validateLLMResponse(parsed)) {
    throw new Error('LLM response does not match expected schema');
  }

  // Build dimension scores
  const dimensions: DimensionScores = {} as DimensionScores;
  for (const key of Object.keys(DIMENSIONS) as DimensionKey[]) {
    const dim = parsed.dimensions[key];
    if (!dim) {
      throw new Error(`Missing dimension: ${key}`);
    }
    dimensions[key] = {
      score: dim.score,
      reasoning: dim.reasoning,
    };
  }

  // Calculate derived scores
  const categoryScores = {
    concept: calculateCategoryScore(dimensions, 'concept'),
    structure: calculateCategoryScore(dimensions, 'structure'),
    character: calculateCategoryScore(dimensions, 'character'),
    craft: calculateCategoryScore(dimensions, 'craft'),
  };

  const overallScore = calculateOverallScore(dimensions);
  const rating = calculateRating(overallScore);

  // Get next version number
  const { data: versionData } = await supabase
    .rpc('get_next_score_version', { p_project_id: projectId });
  const version = versionData || 1;

  // Build the score object
  const storyScore: StoryScore = {
    id: '', // Will be set by database
    projectId,
    version,
    dimensions,
    categoryScores,
    overallScore,
    rating,
    strengths: parsed.strengths,
    weaknesses: parsed.weaknesses,
    confidence: parsed.confidence,
    modelVersion: model,
    createdAt: new Date().toISOString(),
  };

  // Convert to database row format
  const row = storyScoreToRow(storyScore);

  // Insert into database
  const { data: insertedRow, error } = await supabase
    .from('story_scores')
    .insert(row)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save score: ${error.message}`);
  }

  // Return with database-generated ID
  return rowToStoryScore(insertedRow as StoryScoreRow);
}

/**
 * Get the latest score for a project
 */
export async function getLatestScore(projectId: string): Promise<StoryScore | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('story_scores')
    .select('*')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch score: ${error.message}`);
  }

  return rowToStoryScore(data as StoryScoreRow);
}

/**
 * Get all scores for a project (version history)
 */
export async function getScoreHistory(projectId: string): Promise<StoryScore[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('story_scores')
    .select('*')
    .eq('project_id', projectId)
    .order('version', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch score history: ${error.message}`);
  }

  return (data as StoryScoreRow[]).map(rowToStoryScore);
}

/**
 * Delete a specific score version
 */
export async function deleteScore(scoreId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('story_scores')
    .delete()
    .eq('id', scoreId);

  if (error) {
    throw new Error(`Failed to delete score: ${error.message}`);
  }
}

/**
 * Compare two scores (for revision tracking)
 */
export function compareScores(
  oldScore: StoryScore,
  newScore: StoryScore
): {
  improved: DimensionKey[];
  declined: DimensionKey[];
  unchanged: DimensionKey[];
  overallChange: number;
} {
  const improved: DimensionKey[] = [];
  const declined: DimensionKey[] = [];
  const unchanged: DimensionKey[] = [];

  for (const key of Object.keys(DIMENSIONS) as DimensionKey[]) {
    const oldVal = oldScore.dimensions[key].score;
    const newVal = newScore.dimensions[key].score;

    if (newVal > oldVal) {
      improved.push(key);
    } else if (newVal < oldVal) {
      declined.push(key);
    } else {
      unchanged.push(key);
    }
  }

  return {
    improved,
    declined,
    unchanged,
    overallChange: newScore.overallScore - oldScore.overallScore,
  };
}
