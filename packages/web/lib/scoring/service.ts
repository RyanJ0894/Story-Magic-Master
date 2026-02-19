/**
 * StoryScore Service
 *
 * Handles LLM-based screenplay evaluation using OpenAI GPT-4.
 * Provides scoring, caching, and database persistence.
 */

import { getOpenAI } from '@/lib/ai/openai';
import { prisma } from '@/lib/db';
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
  Rating,
} from './types';
import { buildScoringPrompt, validateLLMResponse } from './prompts';

// =============================================================================
// Prisma-to-Row Adapter (type-safe camelCase → snake_case mapping)
// =============================================================================

/** Map Prisma storyScore result to StoryScoreRow */
function toStoryScoreRow(data: Record<string, unknown>): StoryScoreRow {
  return {
    id: data.id as string,
    project_id: data.projectId as string,
    version: data.version as number,
    premise_originality: data.premiseOriginality as number,
    premise_originality_reasoning: data.premiseOriginalityReasoning as string,
    logline_clarity: data.loglineClarity as number,
    logline_clarity_reasoning: data.loglineClarityReasoning as string,
    commercial_viability: data.commercialViability as number,
    commercial_viability_reasoning: data.commercialViabilityReasoning as string,
    three_act_integrity: data.threeActIntegrity as number,
    three_act_integrity_reasoning: data.threeActIntegrityReasoning as string,
    pacing_momentum: data.pacingMomentum as number,
    pacing_momentum_reasoning: data.pacingMomentumReasoning as string,
    stakes_escalation: data.stakesEscalation as number,
    stakes_escalation_reasoning: data.stakesEscalationReasoning as string,
    protagonist_arc: data.protagonistArc as number,
    protagonist_arc_reasoning: data.protagonistArcReasoning as string,
    supporting_cast: data.supportingCast as number,
    supporting_cast_reasoning: data.supportingCastReasoning as string,
    castability: data.castability as number,
    castability_reasoning: data.castabilityReasoning as string,
    dialogue_quality: data.dialogueQuality as number,
    dialogue_quality_reasoning: data.dialogueQualityReasoning as string,
    visual_storytelling: data.visualStorytelling as number,
    visual_storytelling_reasoning: data.visualStorytellingReasoning as string,
    technical_execution: data.technicalExecution as number,
    technical_execution_reasoning: data.technicalExecutionReasoning as string,
    concept_score: data.conceptScore as number,
    structure_score: data.structureScore as number,
    character_score: data.characterScore as number,
    craft_score: data.craftScore as number,
    overall_score: data.overallScore as number,
    rating: data.rating as Rating,
    strengths: data.strengths as string[],
    weaknesses: data.weaknesses as string[],
    confidence: data.confidence as number,
    model_version: data.modelVersion as string,
    created_at: String(data.createdAt),
  };
}

// OpenAI client imported from shared singleton (@/lib/ai/openai)

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

  // Build the scoring prompt
  const prompt = buildScoringPrompt(
    scriptText,
    options?.title,
    options?.genre,
    options?.logline
  );

  // Call OpenAI
  const response = await getOpenAI().chat.completions.create({
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
  const versionResult = await prisma.$queryRaw<[{ get_next_score_version: number }]>`
    SELECT get_next_score_version(${projectId}::uuid)
  `;
  const version = versionResult?.[0]?.get_next_score_version || 1;

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
  try {
    const insertedRow = await prisma.storyScore.create({
      data: {
        projectId: row.project_id,
        version: row.version,
        premiseOriginality: row.premise_originality,
        premiseOriginalityReasoning: row.premise_originality_reasoning,
        loglineClarity: row.logline_clarity,
        loglineClarityReasoning: row.logline_clarity_reasoning,
        commercialViability: row.commercial_viability,
        commercialViabilityReasoning: row.commercial_viability_reasoning,
        threeActIntegrity: row.three_act_integrity,
        threeActIntegrityReasoning: row.three_act_integrity_reasoning,
        pacingMomentum: row.pacing_momentum,
        pacingMomentumReasoning: row.pacing_momentum_reasoning,
        stakesEscalation: row.stakes_escalation,
        stakesEscalationReasoning: row.stakes_escalation_reasoning,
        protagonistArc: row.protagonist_arc,
        protagonistArcReasoning: row.protagonist_arc_reasoning,
        supportingCast: row.supporting_cast,
        supportingCastReasoning: row.supporting_cast_reasoning,
        castability: row.castability,
        castabilityReasoning: row.castability_reasoning,
        dialogueQuality: row.dialogue_quality,
        dialogueQualityReasoning: row.dialogue_quality_reasoning,
        visualStorytelling: row.visual_storytelling,
        visualStorytellingReasoning: row.visual_storytelling_reasoning,
        technicalExecution: row.technical_execution,
        technicalExecutionReasoning: row.technical_execution_reasoning,
        conceptScore: row.concept_score,
        structureScore: row.structure_score,
        characterScore: row.character_score,
        craftScore: row.craft_score,
        overallScore: row.overall_score,
        rating: row.rating,
        strengths: row.strengths,
        weaknesses: row.weaknesses,
        confidence: row.confidence,
        modelVersion: row.model_version,
      },
    });

    // Return with database-generated ID
    return rowToStoryScore(toStoryScoreRow(insertedRow));
  } catch (error) {
    throw new Error(`Failed to save score: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the latest score for a project
 */
export async function getLatestScore(projectId: string): Promise<StoryScore | null> {
  const data = await prisma.storyScore.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
  });

  if (!data) {
    return null;
  }

  return rowToStoryScore(toStoryScoreRow(data));
}

/**
 * Get all scores for a project (version history)
 */
export async function getScoreHistory(projectId: string): Promise<StoryScore[]> {
  const data = await prisma.storyScore.findMany({
    where: { projectId },
    orderBy: { version: 'desc' },
  });

  return data.map((d: Record<string, unknown>) => rowToStoryScore(toStoryScoreRow(d)));
}

/**
 * Delete a specific score version
 */
export async function deleteScore(scoreId: string): Promise<void> {
  try {
    await prisma.storyScore.delete({
      where: { id: scoreId },
    });
  } catch (error) {
    throw new Error(`Failed to delete score: ${error instanceof Error ? error.message : String(error)}`);
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
