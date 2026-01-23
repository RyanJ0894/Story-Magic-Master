/**
 * Comparable Scripts Types
 *
 * Types for finding and displaying similar scripts from the corpus.
 */

// =============================================================================
// Core Types
// =============================================================================

export interface ComparableScript {
  id: string;
  title: string;
  logline: string | null;
  genre: string[];
  tone: string | null;
  productionStatus: ProductionStatus | null;
  studio: string | null;
  budgetTier: BudgetTier | null;
  boxOfficeMillions: number | null;
  similarity: number; // 0-1 similarity score
}

export type ProductionStatus = 'sold' | 'produced' | 'optioned' | 'unproduced';

export type BudgetTier = 'micro' | 'indie' | 'mid' | 'tentpole';

// =============================================================================
// API Types
// =============================================================================

export interface SearchComparablesRequest {
  projectId: string;
  limit?: number;
  minSimilarity?: number;
  filterStatus?: ProductionStatus[];
  filterGenre?: string[];
}

export interface SearchComparablesResponse {
  comparables: ComparableScript[];
  queryLogline: string;
  matchCount: number;
}

// =============================================================================
// Database Types
// =============================================================================

export interface ScriptCorpusRow {
  id: string;
  title: string;
  logline: string | null;
  genre: string[];
  tone: string | null;
  writer: string | null;
  sale_date: string | null;
  production_status: string | null;
  studio: string | null;
  budget_tier: string | null;
  box_office_millions: number | null;
  logline_embedding: number[] | null;
  is_public: boolean;
  source: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// UI Display Types
// =============================================================================

export interface ComparableDisplay extends ComparableScript {
  matchLabel: MatchLabel;
  statusBadge: StatusBadge;
  relevancePercent: number;
}

export type MatchLabel = 'Strong Match' | 'Good Match' | 'Related' | 'Weak Match';

export interface StatusBadge {
  label: string;
  color: 'green' | 'blue' | 'yellow' | 'gray';
}

// =============================================================================
// Helper Functions
// =============================================================================

export function getMatchLabel(similarity: number): MatchLabel {
  if (similarity >= 0.85) return 'Strong Match';
  if (similarity >= 0.75) return 'Good Match';
  if (similarity >= 0.65) return 'Related';
  return 'Weak Match';
}

export function getStatusBadge(status: ProductionStatus | null): StatusBadge {
  switch (status) {
    case 'produced':
      return { label: 'Produced', color: 'green' };
    case 'sold':
      return { label: 'Sold', color: 'blue' };
    case 'optioned':
      return { label: 'Optioned', color: 'yellow' };
    default:
      return { label: 'Unproduced', color: 'gray' };
  }
}

export function toComparableDisplay(script: ComparableScript): ComparableDisplay {
  return {
    ...script,
    matchLabel: getMatchLabel(script.similarity),
    statusBadge: getStatusBadge(script.productionStatus),
    relevancePercent: Math.round(script.similarity * 100),
  };
}

export function formatBudgetTier(tier: BudgetTier | null): string {
  switch (tier) {
    case 'micro':
      return 'Micro Budget (<$1M)';
    case 'indie':
      return 'Independent ($1-15M)';
    case 'mid':
      return 'Mid-Budget ($15-80M)';
    case 'tentpole':
      return 'Tentpole ($80M+)';
    default:
      return 'Unknown';
  }
}

export function formatBoxOffice(millions: number | null): string {
  if (millions === null) return 'N/A';
  if (millions >= 1000) return `$${(millions / 1000).toFixed(1)}B`;
  return `$${millions}M`;
}
