/**
 * Story-Adviser Module
 *
 * AI-powered suggestion system for screenplay improvement.
 * Builds on StoryScore to provide actionable feedback.
 */

// Types
export {
  SUGGESTION_CATEGORIES,
  SEVERITY_LEVELS,
  SUGGESTION_STATUS,
  type SuggestionCategory,
  type SeverityLevel,
  type SuggestionStatus,
  type ScriptLocation,
  type Suggestion,
  type Rewrite,
  type SuggestionRow,
  type RewriteRow,
  type GenerateSuggestionsRequest,
  type GenerateSuggestionsResponse,
  type RespondToSuggestionRequest,
  type LLMSuggestionsResponse,
  // Utilities
  rowToSuggestion,
  suggestionToRow,
  rowToRewrite,
  sortSuggestions,
  groupByCategory,
  categoryFromDimension,
  calculateStats,
} from './types';

// Prompts
export {
  buildSuggestionPrompt,
  buildRewritePrompt,
  validateSuggestionsResponse,
  validateRewriteResponse,
  findExcerptInScript,
} from './prompts';

// Service
export {
  generateSuggestions,
  getSuggestions,
  getSuggestion,
  respondToSuggestion,
  deleteSuggestion,
  generateRewrites,
  getRewrites,
  selectRewrite,
  getSuggestionStats,
} from './service';
