/**
 * Story-Adviser Type Definitions
 *
 * Modular suggestion system that builds on StoryScore.
 * Suggestions are linked to specific script locations and
 * map to the 12 StoryScore dimensions.
 */

import { DimensionKey } from '@/lib/scoring/types';

// =============================================================================
// Suggestion Categories (map to StoryScore dimensions)
// =============================================================================

/**
 * Suggestion categories align with StoryScore dimensions for coherent feedback.
 * Each category has specific prompt strategies and UI treatments.
 */
export const SUGGESTION_CATEGORIES = {
  premise: {
    key: 'premise',
    dimension: 'premiseOriginality' as DimensionKey,
    label: 'Premise',
    description: 'Concept originality and hook',
    icon: '💡',
    color: 'violet',
  },
  clarity: {
    key: 'clarity',
    dimension: 'loglineClarity' as DimensionKey,
    label: 'Clarity',
    description: 'Story comprehensibility',
    icon: '🎯',
    color: 'violet',
  },
  commercial: {
    key: 'commercial',
    dimension: 'commercialViability' as DimensionKey,
    label: 'Commercial',
    description: 'Market appeal',
    icon: '💰',
    color: 'violet',
  },
  structure: {
    key: 'structure',
    dimension: 'threeActIntegrity' as DimensionKey,
    label: 'Structure',
    description: 'Story architecture',
    icon: '📐',
    color: 'blue',
  },
  pacing: {
    key: 'pacing',
    dimension: 'pacingMomentum' as DimensionKey,
    label: 'Pacing',
    description: 'Scene economy and flow',
    icon: '⏱️',
    color: 'blue',
  },
  stakes: {
    key: 'stakes',
    dimension: 'stakesEscalation' as DimensionKey,
    label: 'Stakes',
    description: 'Tension and consequences',
    icon: '📈',
    color: 'blue',
  },
  protagonist: {
    key: 'protagonist',
    dimension: 'protagonistArc' as DimensionKey,
    label: 'Protagonist',
    description: 'Character journey',
    icon: '👤',
    color: 'amber',
  },
  supporting: {
    key: 'supporting',
    dimension: 'supportingCast' as DimensionKey,
    label: 'Supporting',
    description: 'Secondary characters',
    icon: '👥',
    color: 'amber',
  },
  castability: {
    key: 'castability',
    dimension: 'castability' as DimensionKey,
    label: 'Castability',
    description: 'Actor appeal',
    icon: '⭐',
    color: 'amber',
  },
  dialogue: {
    key: 'dialogue',
    dimension: 'dialogueQuality' as DimensionKey,
    label: 'Dialogue',
    description: 'Speech and subtext',
    icon: '💬',
    color: 'emerald',
  },
  visual: {
    key: 'visual',
    dimension: 'visualStorytelling' as DimensionKey,
    label: 'Visual',
    description: 'Show don\'t tell',
    icon: '🎬',
    color: 'emerald',
  },
  technical: {
    key: 'technical',
    dimension: 'technicalExecution' as DimensionKey,
    label: 'Technical',
    description: 'Format and presentation',
    icon: '📝',
    color: 'emerald',
  },
} as const;

export type SuggestionCategory = keyof typeof SUGGESTION_CATEGORIES;

// =============================================================================
// Severity Levels
// =============================================================================

export const SEVERITY_LEVELS = {
  critical: {
    key: 'critical',
    label: 'Critical',
    description: 'Fundamental issue that may block story success',
    color: 'red',
    priority: 1,
  },
  important: {
    key: 'important',
    label: 'Important',
    description: 'Significant impact on story quality',
    color: 'amber',
    priority: 2,
  },
  minor: {
    key: 'minor',
    label: 'Minor',
    description: 'Polish opportunity',
    color: 'blue',
    priority: 3,
  },
} as const;

export type SeverityLevel = keyof typeof SEVERITY_LEVELS;

// =============================================================================
// Suggestion Status
// =============================================================================

export const SUGGESTION_STATUS = {
  pending: {
    key: 'pending',
    label: 'Pending',
    description: 'Awaiting user review',
  },
  accepted: {
    key: 'accepted',
    label: 'Accepted',
    description: 'User applied the suggestion',
  },
  rejected: {
    key: 'rejected',
    label: 'Rejected',
    description: 'User disagreed with the suggestion',
  },
  dismissed: {
    key: 'dismissed',
    label: 'Dismissed',
    description: 'User acknowledged but chose not to act',
  },
} as const;

export type SuggestionStatus = keyof typeof SUGGESTION_STATUS;

// =============================================================================
// Location Types
// =============================================================================

/**
 * Script location - identifies where a suggestion applies.
 * Supports both line-based and character-based positioning.
 */
export interface ScriptLocation {
  // Line-based (primary, for display)
  startLine: number;
  endLine: number;

  // Character-based (for precise highlighting)
  startChar?: number;
  endChar?: number;

  // The actual text excerpt
  excerpt: string;

  // Optional: scene identifier if available
  sceneNumber?: number;
  sceneHeading?: string;
}

// =============================================================================
// Core Suggestion Type
// =============================================================================

/**
 * A single suggestion for script improvement.
 */
export interface Suggestion {
  id: string;
  projectId: string;
  scoreId?: string; // Link to StoryScore that generated this

  // Location in script
  location: ScriptLocation;

  // Classification
  category: SuggestionCategory;
  severity: SeverityLevel;

  // Content
  title: string; // Short, actionable (e.g., "Add subtext to this exchange")
  explanation: string; // Why this is a problem and why it matters
  suggestion: string; // What to do about it

  // Status
  status: SuggestionStatus;
  userFeedback?: string; // Optional user comment

  // Metadata
  confidence: number; // 0-1, how confident the AI is
  createdAt: string;
  respondedAt?: string;
}

// =============================================================================
// Rewrite Types
// =============================================================================

/**
 * A rewrite option for a suggestion.
 * Generated on-demand when user requests alternatives.
 */
export interface Rewrite {
  id: string;
  suggestionId: string;

  // Content
  originalText: string;
  rewrittenText: string;
  explanation: string; // Why this rewrite improves the script

  // Style used to generate this rewrite
  style?: 'conservative' | 'moderate' | 'bold';

  // Selection
  selected: boolean;
  isSelected?: boolean; // Alias for selected (for API compatibility)

  // Metadata
  createdAt: string;
}

/**
 * Rewrite request - what gets sent to the API
 */
export interface RewriteRequest {
  suggestionId: string;
  count?: number; // How many options to generate (default 3)
  style?: 'conservative' | 'moderate' | 'bold'; // How much to change
}

// =============================================================================
// Database Row Types (snake_case)
// =============================================================================

export interface SuggestionRow {
  id: string;
  project_id: string;
  score_id: string | null;

  // Location
  start_line: number;
  end_line: number;
  start_char: number | null;
  end_char: number | null;
  excerpt: string;
  scene_number: number | null;
  scene_heading: string | null;

  // Classification
  category: SuggestionCategory;
  severity: SeverityLevel;

  // Content
  title: string;
  explanation: string;
  suggestion: string;

  // Status
  status: SuggestionStatus;
  user_feedback: string | null;

  // Metadata
  confidence: number;
  created_at: string;
  responded_at: string | null;
}

export interface RewriteRow {
  id: string;
  suggestion_id: string;
  original_text: string;
  rewritten_text: string;
  explanation: string;
  style: string | null;
  selected: boolean;
  created_at: string;
}

// =============================================================================
// API Types
// =============================================================================

/**
 * Request to generate suggestions for a project
 */
export interface GenerateSuggestionsRequest {
  projectId: string;
  scoreId?: string; // Optional: focus on weak dimensions from this score
  maxSuggestions?: number; // Default 15
  focusCategories?: SuggestionCategory[]; // Optional: only these categories
}

/**
 * Response from suggestion generation
 */
export interface GenerateSuggestionsResponse {
  success: boolean;
  suggestions?: Suggestion[];
  error?: string;
}

/**
 * Request to respond to a suggestion
 */
export interface RespondToSuggestionRequest {
  status: 'accepted' | 'rejected' | 'dismissed';
  feedback?: string;
}

/**
 * LLM response format for suggestion generation
 */
export interface LLMSuggestionsResponse {
  suggestions: Array<{
    category: string;
    severity: string;
    title: string;
    explanation: string;
    suggestion: string;
    excerpt: string;
    startLine: number;
    endLine: number;
    confidence: number;
  }>;
}

// =============================================================================
// Conversion Utilities
// =============================================================================

/**
 * Convert database row to Suggestion object
 */
export function rowToSuggestion(row: SuggestionRow): Suggestion {
  return {
    id: row.id,
    projectId: row.project_id,
    scoreId: row.score_id || undefined,
    location: {
      startLine: row.start_line,
      endLine: row.end_line,
      startChar: row.start_char || undefined,
      endChar: row.end_char || undefined,
      excerpt: row.excerpt,
      sceneNumber: row.scene_number || undefined,
      sceneHeading: row.scene_heading || undefined,
    },
    category: row.category,
    severity: row.severity,
    title: row.title,
    explanation: row.explanation,
    suggestion: row.suggestion,
    status: row.status,
    userFeedback: row.user_feedback || undefined,
    confidence: row.confidence,
    createdAt: row.created_at,
    respondedAt: row.responded_at || undefined,
  };
}

/**
 * Convert Suggestion object to database row format
 */
export function suggestionToRow(
  suggestion: Omit<Suggestion, 'id' | 'createdAt'>
): Omit<SuggestionRow, 'id' | 'created_at'> {
  return {
    project_id: suggestion.projectId,
    score_id: suggestion.scoreId || null,
    start_line: suggestion.location.startLine,
    end_line: suggestion.location.endLine,
    start_char: suggestion.location.startChar || null,
    end_char: suggestion.location.endChar || null,
    excerpt: suggestion.location.excerpt,
    scene_number: suggestion.location.sceneNumber || null,
    scene_heading: suggestion.location.sceneHeading || null,
    category: suggestion.category,
    severity: suggestion.severity,
    title: suggestion.title,
    explanation: suggestion.explanation,
    suggestion: suggestion.suggestion,
    status: suggestion.status,
    user_feedback: suggestion.userFeedback || null,
    confidence: suggestion.confidence,
    responded_at: suggestion.respondedAt || null,
  };
}

/**
 * Convert database row to Rewrite object
 */
export function rowToRewrite(row: RewriteRow): Rewrite {
  return {
    id: row.id,
    suggestionId: row.suggestion_id,
    originalText: row.original_text,
    rewrittenText: row.rewritten_text,
    explanation: row.explanation,
    style: row.style as Rewrite['style'],
    selected: row.selected,
    isSelected: row.selected, // Alias for API compatibility
    createdAt: row.created_at,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get suggestions sorted by priority (critical first, then by line number)
 */
export function sortSuggestions(suggestions: Suggestion[]): Suggestion[] {
  return [...suggestions].sort((a, b) => {
    // First by severity priority
    const severityDiff =
      SEVERITY_LEVELS[a.severity].priority - SEVERITY_LEVELS[b.severity].priority;
    if (severityDiff !== 0) return severityDiff;

    // Then by line number
    return a.location.startLine - b.location.startLine;
  });
}

/**
 * Group suggestions by category
 */
export function groupByCategory(
  suggestions: Suggestion[]
): Record<SuggestionCategory, Suggestion[]> {
  const groups: Record<SuggestionCategory, Suggestion[]> = {
    premise: [],
    clarity: [],
    commercial: [],
    structure: [],
    pacing: [],
    stakes: [],
    protagonist: [],
    supporting: [],
    castability: [],
    dialogue: [],
    visual: [],
    technical: [],
  };

  for (const suggestion of suggestions) {
    groups[suggestion.category].push(suggestion);
  }

  return groups;
}

/**
 * Get category from StoryScore dimension key
 */
export function categoryFromDimension(dimension: DimensionKey): SuggestionCategory {
  for (const [key, config] of Object.entries(SUGGESTION_CATEGORIES)) {
    if (config.dimension === dimension) {
      return key as SuggestionCategory;
    }
  }
  return 'technical'; // fallback
}

/**
 * Calculate suggestion stats
 */
export function calculateStats(suggestions: Suggestion[]): {
  total: number;
  bySeverity: Record<SeverityLevel, number>;
  byStatus: Record<SuggestionStatus, number>;
  byCategory: Record<SuggestionCategory, number>;
} {
  const stats = {
    total: suggestions.length,
    bySeverity: { critical: 0, important: 0, minor: 0 } as Record<SeverityLevel, number>,
    byStatus: { pending: 0, accepted: 0, rejected: 0, dismissed: 0 } as Record<SuggestionStatus, number>,
    byCategory: {} as Record<SuggestionCategory, number>,
  };

  // Initialize category counts
  for (const key of Object.keys(SUGGESTION_CATEGORIES)) {
    stats.byCategory[key as SuggestionCategory] = 0;
  }

  for (const s of suggestions) {
    stats.bySeverity[s.severity]++;
    stats.byStatus[s.status]++;
    stats.byCategory[s.category]++;
  }

  return stats;
}
