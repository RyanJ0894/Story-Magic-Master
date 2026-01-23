/**
 * StoryScore Type Definitions
 *
 * Shared types used across:
 * - Database schema (Supabase)
 * - API routes
 * - React components
 * - LLM prompts
 *
 * Single source of truth for type safety across all layers.
 */

// =============================================================================
// Dimension Definitions
// =============================================================================

/**
 * The 12 evaluation dimensions with metadata
 */
export const DIMENSIONS = {
  premiseOriginality: {
    key: 'premiseOriginality',
    dbKey: 'premise_originality',
    label: 'Premise Originality',
    description: 'Fresh concept, unique hook, differentiation from existing films',
    category: 'concept',
    weight: 10,
    maxScore: 10,
  },
  loglineClarity: {
    key: 'loglineClarity',
    dbKey: 'logline_clarity',
    label: 'Logline Clarity',
    description: 'Can the core concept be expressed in one compelling sentence?',
    category: 'concept',
    weight: 8,
    maxScore: 10,
  },
  commercialViability: {
    key: 'commercialViability',
    dbKey: 'commercial_viability',
    label: 'Commercial Viability',
    description: 'Market fit, four-quadrant appeal, comparable success stories',
    category: 'concept',
    weight: 7,
    maxScore: 10,
  },
  threeActIntegrity: {
    key: 'threeActIntegrity',
    dbKey: 'three_act_integrity',
    label: 'Three-Act Integrity',
    description: 'Save the Cat beats present, turning points land, causality',
    category: 'structure',
    weight: 10,
    maxScore: 10,
  },
  pacingMomentum: {
    key: 'pacingMomentum',
    dbKey: 'pacing_momentum',
    label: 'Pacing & Momentum',
    description: 'Scene economy, no fat, reader engagement maintained',
    category: 'structure',
    weight: 8,
    maxScore: 10,
  },
  stakesEscalation: {
    key: 'stakesEscalation',
    dbKey: 'stakes_escalation',
    label: 'Stakes & Escalation',
    description: 'Rising tension, consequences that matter, ticking clocks',
    category: 'structure',
    weight: 7,
    maxScore: 10,
  },
  protagonistArc: {
    key: 'protagonistArc',
    dbKey: 'protagonist_arc',
    label: 'Protagonist Arc',
    description: 'Clear want/need, transformation, internal + external journey',
    category: 'character',
    weight: 10,
    maxScore: 10,
  },
  supportingCast: {
    key: 'supportingCast',
    dbKey: 'supporting_cast',
    label: 'Supporting Cast',
    description: 'Dimensional antagonist, distinct supporting characters, relationships',
    category: 'character',
    weight: 8,
    maxScore: 10,
  },
  castability: {
    key: 'castability',
    dbKey: 'castability',
    label: 'Castability',
    description: 'Roles actors want to play, star vehicle potential, memorable scenes',
    category: 'character',
    weight: 7,
    maxScore: 10,
  },
  dialogueQuality: {
    key: 'dialogueQuality',
    dbKey: 'dialogue_quality',
    label: 'Dialogue Quality',
    description: 'Subtext, distinctive voices, economy, memorable lines',
    category: 'craft',
    weight: 10,
    maxScore: 10,
  },
  visualStorytelling: {
    key: 'visualStorytelling',
    dbKey: 'visual_storytelling',
    label: 'Visual Storytelling',
    description: 'Show don\'t tell, cinematic moments, action writing',
    category: 'craft',
    weight: 8,
    maxScore: 10,
  },
  technicalExecution: {
    key: 'technicalExecution',
    dbKey: 'technical_execution',
    label: 'Technical Execution',
    description: 'Formatting, clarity, professional presentation',
    category: 'craft',
    weight: 7,
    maxScore: 10,
  },
} as const;

export type DimensionKey = keyof typeof DIMENSIONS;
export type DimensionDbKey = typeof DIMENSIONS[DimensionKey]['dbKey'];
export type Category = 'concept' | 'structure' | 'character' | 'craft';

/**
 * Category definitions with metadata
 */
export const CATEGORIES = {
  concept: {
    key: 'concept',
    label: 'Concept',
    icon: '💡',
    color: 'violet',
    dimensions: ['premiseOriginality', 'loglineClarity', 'commercialViability'] as DimensionKey[],
    weight: 25,
  },
  structure: {
    key: 'structure',
    label: 'Structure',
    icon: '📐',
    color: 'blue',
    dimensions: ['threeActIntegrity', 'pacingMomentum', 'stakesEscalation'] as DimensionKey[],
    weight: 25,
  },
  character: {
    key: 'character',
    label: 'Character',
    icon: '👤',
    color: 'amber',
    dimensions: ['protagonistArc', 'supportingCast', 'castability'] as DimensionKey[],
    weight: 25,
  },
  craft: {
    key: 'craft',
    label: 'Craft',
    icon: '✍️',
    color: 'emerald',
    dimensions: ['dialogueQuality', 'visualStorytelling', 'technicalExecution'] as DimensionKey[],
    weight: 25,
  },
} as const;

// =============================================================================
// Rating Definitions
// =============================================================================

export type Rating = 'STRONG_RECOMMEND' | 'RECOMMEND' | 'CONSIDER' | 'CONSIDER_WITH_RESERVATIONS' | 'PASS' | 'STRONG_PASS';

export const RATINGS: Record<Rating, { label: string; color: string; bgColor: string; minScore: number; maxScore: number; description: string }> = {
  STRONG_RECOMMEND: {
    label: 'Strong Recommend',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-500',
    minScore: 9.0,
    maxScore: 10.0,
    description: 'Exceptional - ready for production',
  },
  RECOMMEND: {
    label: 'Recommend',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-400',
    minScore: 8.0,
    maxScore: 8.9,
    description: 'Ready for market',
  },
  CONSIDER: {
    label: 'Consider',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-500',
    minScore: 7.0,
    maxScore: 7.9,
    description: 'Strong potential with revisions',
  },
  CONSIDER_WITH_RESERVATIONS: {
    label: 'Consider with Reservations',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500',
    minScore: 5.5,
    maxScore: 6.9,
    description: 'Needs significant work',
  },
  PASS: {
    label: 'Pass',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-400',
    minScore: 3.0,
    maxScore: 5.4,
    description: 'Not ready',
  },
  STRONG_PASS: {
    label: 'Strong Pass',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-500',
    minScore: 1.0,
    maxScore: 2.9,
    description: 'Fundamental issues',
  },
};

// =============================================================================
// Score Types
// =============================================================================

/**
 * Individual dimension score with reasoning
 */
export interface DimensionScore {
  score: number;
  reasoning: string;
}

/**
 * All dimension scores
 */
export type DimensionScores = {
  [K in DimensionKey]: DimensionScore;
};

/**
 * Category scores (computed from dimensions)
 */
export interface CategoryScores {
  concept: number;
  structure: number;
  character: number;
  craft: number;
}

/**
 * Complete StoryScore result
 */
export interface StoryScore {
  id: string;
  projectId: string;
  version: number;

  // Dimension scores
  dimensions: DimensionScores;

  // Computed category scores
  categoryScores: CategoryScores;

  // Overall
  overallScore: number;
  rating: Rating;

  // Analysis
  strengths: string[];
  weaknesses: string[];

  // Metadata
  confidence: number;
  modelVersion: string;
  createdAt: string;
}

/**
 * Database row format (snake_case)
 */
export interface StoryScoreRow {
  id: string;
  project_id: string;
  version: number;

  // Dimension scores (snake_case)
  premise_originality: number;
  premise_originality_reasoning: string;
  logline_clarity: number;
  logline_clarity_reasoning: string;
  commercial_viability: number;
  commercial_viability_reasoning: string;
  three_act_integrity: number;
  three_act_integrity_reasoning: string;
  pacing_momentum: number;
  pacing_momentum_reasoning: string;
  stakes_escalation: number;
  stakes_escalation_reasoning: string;
  protagonist_arc: number;
  protagonist_arc_reasoning: string;
  supporting_cast: number;
  supporting_cast_reasoning: string;
  castability: number;
  castability_reasoning: string;
  dialogue_quality: number;
  dialogue_quality_reasoning: string;
  visual_storytelling: number;
  visual_storytelling_reasoning: string;
  technical_execution: number;
  technical_execution_reasoning: string;

  // Category scores
  concept_score: number;
  structure_score: number;
  character_score: number;
  craft_score: number;

  // Overall
  overall_score: number;
  rating: Rating;

  // Analysis
  strengths: string[];
  weaknesses: string[];

  // Metadata
  confidence: number;
  model_version: string;
  created_at: string;
}

// =============================================================================
// API Types
// =============================================================================

/**
 * Request to generate a score
 */
export interface GenerateScoreRequest {
  projectId: string;
  scriptText: string;
  title?: string;
  genre?: string;
  logline?: string;
}

/**
 * Response from score generation
 */
export interface GenerateScoreResponse {
  success: boolean;
  score?: StoryScore;
  error?: string;
}

/**
 * LLM response format
 */
export interface LLMScoreResponse {
  dimensions: {
    [key: string]: {
      score: number;
      reasoning: string;
    };
  };
  strengths: string[];
  weaknesses: string[];
  confidence: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate rating from overall score
 */
export function calculateRating(score: number): Rating {
  if (score >= 9.0) return 'STRONG_RECOMMEND';
  if (score >= 8.0) return 'RECOMMEND';
  if (score >= 7.0) return 'CONSIDER';
  if (score >= 5.5) return 'CONSIDER_WITH_RESERVATIONS';
  if (score >= 3.0) return 'PASS';
  return 'STRONG_PASS';
}

/**
 * Calculate category score from dimension scores
 */
export function calculateCategoryScore(dimensions: DimensionScores, category: Category): number {
  const categoryDimensions = CATEGORIES[category].dimensions;
  let totalWeight = 0;
  let weightedSum = 0;

  for (const dimKey of categoryDimensions) {
    const dim = DIMENSIONS[dimKey];
    const score = dimensions[dimKey].score;
    weightedSum += score * dim.weight;
    totalWeight += dim.weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculate overall score from dimension scores
 */
export function calculateOverallScore(dimensions: DimensionScores): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, dim] of Object.entries(DIMENSIONS)) {
    const score = dimensions[key as DimensionKey].score;
    weightedSum += score * dim.weight;
    totalWeight += dim.weight;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
}

/**
 * Convert database row to StoryScore object
 */
export function rowToStoryScore(row: StoryScoreRow): StoryScore {
  const dimensions: DimensionScores = {
    premiseOriginality: { score: row.premise_originality, reasoning: row.premise_originality_reasoning },
    loglineClarity: { score: row.logline_clarity, reasoning: row.logline_clarity_reasoning },
    commercialViability: { score: row.commercial_viability, reasoning: row.commercial_viability_reasoning },
    threeActIntegrity: { score: row.three_act_integrity, reasoning: row.three_act_integrity_reasoning },
    pacingMomentum: { score: row.pacing_momentum, reasoning: row.pacing_momentum_reasoning },
    stakesEscalation: { score: row.stakes_escalation, reasoning: row.stakes_escalation_reasoning },
    protagonistArc: { score: row.protagonist_arc, reasoning: row.protagonist_arc_reasoning },
    supportingCast: { score: row.supporting_cast, reasoning: row.supporting_cast_reasoning },
    castability: { score: row.castability, reasoning: row.castability_reasoning },
    dialogueQuality: { score: row.dialogue_quality, reasoning: row.dialogue_quality_reasoning },
    visualStorytelling: { score: row.visual_storytelling, reasoning: row.visual_storytelling_reasoning },
    technicalExecution: { score: row.technical_execution, reasoning: row.technical_execution_reasoning },
  };

  return {
    id: row.id,
    projectId: row.project_id,
    version: row.version,
    dimensions,
    categoryScores: {
      concept: row.concept_score,
      structure: row.structure_score,
      character: row.character_score,
      craft: row.craft_score,
    },
    overallScore: row.overall_score,
    rating: row.rating,
    strengths: row.strengths,
    weaknesses: row.weaknesses,
    confidence: row.confidence,
    modelVersion: row.model_version,
    createdAt: row.created_at,
  };
}

/**
 * Convert StoryScore to database row format
 */
export function storyScoreToRow(score: StoryScore): Omit<StoryScoreRow, 'id' | 'created_at'> {
  return {
    project_id: score.projectId,
    version: score.version,
    premise_originality: score.dimensions.premiseOriginality.score,
    premise_originality_reasoning: score.dimensions.premiseOriginality.reasoning,
    logline_clarity: score.dimensions.loglineClarity.score,
    logline_clarity_reasoning: score.dimensions.loglineClarity.reasoning,
    commercial_viability: score.dimensions.commercialViability.score,
    commercial_viability_reasoning: score.dimensions.commercialViability.reasoning,
    three_act_integrity: score.dimensions.threeActIntegrity.score,
    three_act_integrity_reasoning: score.dimensions.threeActIntegrity.reasoning,
    pacing_momentum: score.dimensions.pacingMomentum.score,
    pacing_momentum_reasoning: score.dimensions.pacingMomentum.reasoning,
    stakes_escalation: score.dimensions.stakesEscalation.score,
    stakes_escalation_reasoning: score.dimensions.stakesEscalation.reasoning,
    protagonist_arc: score.dimensions.protagonistArc.score,
    protagonist_arc_reasoning: score.dimensions.protagonistArc.reasoning,
    supporting_cast: score.dimensions.supportingCast.score,
    supporting_cast_reasoning: score.dimensions.supportingCast.reasoning,
    castability: score.dimensions.castability.score,
    castability_reasoning: score.dimensions.castability.reasoning,
    dialogue_quality: score.dimensions.dialogueQuality.score,
    dialogue_quality_reasoning: score.dimensions.dialogueQuality.reasoning,
    visual_storytelling: score.dimensions.visualStorytelling.score,
    visual_storytelling_reasoning: score.dimensions.visualStorytelling.reasoning,
    technical_execution: score.dimensions.technicalExecution.score,
    technical_execution_reasoning: score.dimensions.technicalExecution.reasoning,
    concept_score: score.categoryScores.concept,
    structure_score: score.categoryScores.structure,
    character_score: score.categoryScores.character,
    craft_score: score.categoryScores.craft,
    overall_score: score.overallScore,
    rating: score.rating,
    strengths: score.strengths,
    weaknesses: score.weaknesses,
    confidence: score.confidence,
    model_version: score.modelVersion,
  };
}
