/**
 * Comparable Scripts Service
 *
 * Finds similar scripts in the corpus using embedding similarity search.
 */

import { log } from '@/lib/logger';
import { prisma } from '@/lib/db';
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

  // Get the project's logline from the latest score
  const scoreData = await prisma.storyScore.findFirst({
    where: { projectId },
    select: { loglineClarityReasoning: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!scoreData) {
    throw new Error('No score found for project. Generate a StoryScore first.');
  }

  const loglineReasoning = scoreData.loglineClarityReasoning || '';

  // If we don't have a logline from the score, try to get the project name/description
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { name: true, description: true },
  });

  const queryLogline =
    project?.description || project?.name || loglineReasoning || '';

  if (!queryLogline.trim()) {
    return { comparables: [], queryLogline: '' };
  }

  // Generate embedding for the query
  const queryEmbedding = await generateLoglineEmbedding(queryLogline);

  // Search using the database function
  const data = await prisma.$queryRaw<Array<{
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
  }>>`
    SELECT * FROM search_similar_scripts(
      ${toPgvectorFormat(queryEmbedding)}::vector,
      ${minSimilarity}::float,
      ${limit}::integer,
      ${filterStatus || null},
      ${filterGenre || null}
    )
  `;

  const comparables: ComparableScript[] = (data || []).map((row) => ({
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

  // Generate embedding for the query
  const queryEmbedding = await generateLoglineEmbedding(logline);

  // Search using the database function
  const data = await prisma.$queryRaw<Array<{
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
  }>>`
    SELECT * FROM search_similar_scripts(
      ${toPgvectorFormat(queryEmbedding)}::vector,
      ${minSimilarity}::float,
      ${limit}::integer,
      ${filterStatus || null},
      ${filterGenre || null}
    )
  `;

  return (data || []).map((row) => ({
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
  // Generate embedding for the logline
  const embedding = await generateLoglineEmbedding(script.logline);

  try {
    // Use raw query because logline_embedding is an unsupported vector type
    const result = await prisma.$queryRaw<[{ id: string }]>`
      INSERT INTO script_corpus (
        title, logline, genre, tone, production_status, studio,
        budget_tier, box_office_millions, logline_embedding, is_public, source
      ) VALUES (
        ${script.title},
        ${script.logline},
        ${script.genre || []}::text[],
        ${script.tone || null},
        ${script.productionStatus || null},
        ${script.studio || null},
        ${script.budgetTier || null},
        ${script.boxOfficeMillions || null},
        ${toPgvectorFormat(embedding)}::vector,
        ${script.isPublic ?? true},
        'user_upload'
      )
      RETURNING id
    `;

    return result[0].id;
  } catch (error) {
    log.error('[Comparable] Insert error', error);
    throw new Error('Failed to add script to corpus');
  }
}

/**
 * Get corpus statistics
 */
export async function getCorpusStats(): Promise<{
  totalScripts: number;
  producedCount: number;
  genreCounts: Record<string, number>;
}> {
  const scripts = await prisma.scriptCorpus.findMany({
    where: { isPublic: true },
    select: { productionStatus: true, genre: true },
  });

  const totalScripts = scripts.length;
  const producedCount =
    scripts.filter((s) => s.productionStatus === 'produced').length;

  const genreCounts: Record<string, number> = {};
  scripts.forEach((s) => {
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
  // Use raw query because logline_embedding is an unsupported vector type in Prisma
  const scripts = await prisma.$queryRaw<Array<{ id: string; logline: string }>>`
    SELECT id, logline FROM script_corpus
    WHERE logline_embedding IS NULL AND logline IS NOT NULL
  `;

  if (!scripts || scripts.length === 0) {
    return 0;
  }

  let updated = 0;
  for (const script of scripts) {
    if (!script.logline) continue;

    try {
      const embedding = await generateLoglineEmbedding(script.logline);

      await prisma.$executeRaw`
        UPDATE script_corpus
        SET logline_embedding = ${toPgvectorFormat(embedding)}::vector
        WHERE id = ${script.id}::uuid
      `;

      updated++;
    } catch (error) {
      log.error(`[Comparable] Failed to embed script ${script.id}`, error);
    }
  }

  return updated;
}
