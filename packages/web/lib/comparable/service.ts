/**
 * Comparable Scripts Service
 *
 * Finds similar scripts in the corpus using embedding similarity search.
 */

import { createClient } from '@/lib/supabase/server';
import {
  ComparableScript,
  ProductionStatus,
  BudgetTier,
  ScriptCorpusRow,
} from './types';
import { generateLoglineEmbedding, toPgvectorFormat } from './embeddings';

// =============================================================================
// Search Comparable Scripts
// =============================================================================

export interface SearchOptions {
  limit?: number;
  minSimilarity?: number;
  filterStatus?: ProductionStatus[];
  filterGenre?: string[];
}

/**
 * Search for comparable scripts based on a project's logline
 */
export async function searchComparables(
  projectId: string,
  options: SearchOptions = {}
): Promise<{ comparables: ComparableScript[]; queryLogline: string }> {
  const { limit = 5, minSimilarity = 0.6, filterStatus, filterGenre } = options;

  const supabase = await createClient();

  // Get the project's logline from the latest score
  const { data: scoreData, error: scoreError } = await supabase
    .from('story_scores')
    .select('reasoning')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (scoreError || !scoreData) {
    throw new Error('No score found for project. Generate a StoryScore first.');
  }

  // Extract logline from the score's reasoning
  const reasoning = scoreData.reasoning as Record<string, { reasoning: string }>;
  const loglineReasoning = reasoning?.loglineClarity?.reasoning || '';

  // If we don't have a logline from the score, try to get the project name/description
  const { data: project } = await supabase
    .from('projects')
    .select('name, description')
    .eq('id', projectId)
    .single();

  const queryLogline =
    project?.description || project?.name || loglineReasoning || '';

  if (!queryLogline.trim()) {
    return { comparables: [], queryLogline: '' };
  }

  // Generate embedding for the query
  const queryEmbedding = await generateLoglineEmbedding(queryLogline);

  // Search using the database function
  const { data, error } = await supabase.rpc('search_similar_scripts', {
    query_embedding: toPgvectorFormat(queryEmbedding),
    match_threshold: minSimilarity,
    match_count: limit,
    filter_production_status: filterStatus || null,
    filter_genre: filterGenre || null,
  });

  if (error) {
    console.error('[Comparable] Search error:', error);
    throw new Error('Failed to search comparable scripts');
  }

  const comparables: ComparableScript[] = (data || []).map((row: {
    id: string;
    title: string;
    logline: string | null;
    genre: string[];
    tone: string | null;
    production_status: string | null;
    studio: string | null;
    budget_tier: string | null;
    box_office_millions: number | null;
    similarity: number;
  }) => ({
    id: row.id,
    title: row.title,
    logline: row.logline,
    genre: row.genre || [],
    tone: row.tone,
    productionStatus: row.production_status as ProductionStatus | null,
    studio: row.studio,
    budgetTier: row.budget_tier as BudgetTier | null,
    boxOfficeMillions: row.box_office_millions,
    similarity: row.similarity,
  }));

  return { comparables, queryLogline };
}

/**
 * Search for comparable scripts using a raw logline (for preview/testing)
 */
export async function searchComparablesByLogline(
  logline: string,
  options: SearchOptions = {}
): Promise<ComparableScript[]> {
  const { limit = 5, minSimilarity = 0.6, filterStatus, filterGenre } = options;

  if (!logline.trim()) {
    return [];
  }

  const supabase = await createClient();

  // Generate embedding for the query
  const queryEmbedding = await generateLoglineEmbedding(logline);

  // Search using the database function
  const { data, error } = await supabase.rpc('search_similar_scripts', {
    query_embedding: toPgvectorFormat(queryEmbedding),
    match_threshold: minSimilarity,
    match_count: limit,
    filter_production_status: filterStatus || null,
    filter_genre: filterGenre || null,
  });

  if (error) {
    console.error('[Comparable] Search error:', error);
    throw new Error('Failed to search comparable scripts');
  }

  return (data || []).map((row: {
    id: string;
    title: string;
    logline: string | null;
    genre: string[];
    tone: string | null;
    production_status: string | null;
    studio: string | null;
    budget_tier: string | null;
    box_office_millions: number | null;
    similarity: number;
  }) => ({
    id: row.id,
    title: row.title,
    logline: row.logline,
    genre: row.genre || [],
    tone: row.tone,
    productionStatus: row.production_status as ProductionStatus | null,
    studio: row.studio,
    budgetTier: row.budget_tier as BudgetTier | null,
    boxOfficeMillions: row.box_office_millions,
    similarity: row.similarity,
  }));
}

// =============================================================================
// Corpus Management
// =============================================================================

/**
 * Add a script to the corpus (admin function)
 */
export async function addToCorpus(script: {
  title: string;
  logline: string;
  genre?: string[];
  tone?: string;
  productionStatus?: ProductionStatus;
  studio?: string;
  budgetTier?: BudgetTier;
  boxOfficeMillions?: number;
  isPublic?: boolean;
}): Promise<string> {
  const supabase = await createClient();

  // Generate embedding for the logline
  const embedding = await generateLoglineEmbedding(script.logline);

  const { data, error } = await supabase
    .from('script_corpus')
    .insert({
      title: script.title,
      logline: script.logline,
      genre: script.genre || [],
      tone: script.tone,
      production_status: script.productionStatus,
      studio: script.studio,
      budget_tier: script.budgetTier,
      box_office_millions: script.boxOfficeMillions,
      logline_embedding: toPgvectorFormat(embedding),
      is_public: script.isPublic ?? true,
      source: 'user_upload',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Comparable] Insert error:', error);
    throw new Error('Failed to add script to corpus');
  }

  return data.id;
}

/**
 * Get corpus statistics
 */
export async function getCorpusStats(): Promise<{
  totalScripts: number;
  producedCount: number;
  genreCounts: Record<string, number>;
}> {
  const supabase = await createClient();

  const { data: scripts, error } = await supabase
    .from('script_corpus')
    .select('production_status, genre')
    .eq('is_public', true);

  if (error) {
    console.error('[Comparable] Stats error:', error);
    throw new Error('Failed to get corpus stats');
  }

  const totalScripts = scripts?.length || 0;
  const producedCount =
    scripts?.filter((s) => s.production_status === 'produced').length || 0;

  const genreCounts: Record<string, number> = {};
  scripts?.forEach((s) => {
    (s.genre || []).forEach((g: string) => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
  });

  return { totalScripts, producedCount, genreCounts };
}

// =============================================================================
// Populate Embeddings
// =============================================================================

/**
 * Generate embeddings for scripts that don't have them
 * (Admin utility function)
 */
export async function populateMissingEmbeddings(): Promise<number> {
  const supabase = await createClient();

  // Get scripts without embeddings
  const { data: scripts, error } = await supabase
    .from('script_corpus')
    .select('id, logline')
    .is('logline_embedding', null)
    .not('logline', 'is', null);

  if (error || !scripts) {
    throw new Error('Failed to fetch scripts');
  }

  let updated = 0;
  for (const script of scripts) {
    if (!script.logline) continue;

    try {
      const embedding = await generateLoglineEmbedding(script.logline);

      await supabase
        .from('script_corpus')
        .update({ logline_embedding: toPgvectorFormat(embedding) })
        .eq('id', script.id);

      updated++;
    } catch (err) {
      console.error(`[Comparable] Failed to embed script ${script.id}:`, err);
    }
  }

  return updated;
}
