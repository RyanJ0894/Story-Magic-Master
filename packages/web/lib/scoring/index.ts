/**
 * StoryScore Module
 *
 * AI-powered 12-dimension screenplay evaluation system.
 * Exports types, utilities, and service functions.
 */

// Types and constants
export {
  DIMENSIONS,
  CATEGORIES,
  RATINGS,
  type DimensionKey,
  type DimensionDbKey,
  type Category,
  type Rating,
  type DimensionScore,
  type DimensionScores,
  type CategoryScores,
  type StoryScore,
  type StoryScoreRow,
  type GenerateScoreRequest,
  type GenerateScoreResponse,
  type LLMScoreResponse,
  // Utility functions
  calculateRating,
  calculateCategoryScore,
  calculateOverallScore,
  rowToStoryScore,
  storyScoreToRow,
} from './types';

// Prompts
export {
  SCORING_CRITERIA,
  buildScoringPrompt,
  validateLLMResponse,
} from './prompts';

// Service functions
export {
  generateScore,
  getLatestScore,
  getScoreHistory,
  deleteScore,
  compareScores,
} from './service';
