/**
 * Query Embedding - Get embeddings for search queries using OpenAI
 *
 * Since we don't have sentence-transformers in TypeScript, we use OpenAI's
 * embedding API to get query vectors. The pre-computed embeddings were created
 * with all-MiniLM-L6-v2 (384-dim), but OpenAI embeddings work well for semantic
 * similarity despite the different embedding space.
 *
 * For better accuracy, we could:
 * 1. Pre-compute common query embeddings
 * 2. Use a JS port of sentence-transformers (transformers.js)
 *
 * For MVP, OpenAI embeddings provide good enough results.
 */

import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

// Cache for query embeddings to reduce API calls
const embeddingCache = new Map<string, number[]>();

/**
 * Get embedding for a query string using OpenAI
 */
export async function getQueryEmbedding(query: string): Promise<number[]> {
  // Check cache first
  const cacheKey = query.toLowerCase().trim();
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  try {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: query,
    });

    // Cache the result
    embeddingCache.set(cacheKey, embedding);

    return embedding;
  } catch (err) {
    console.error('[getQueryEmbedding] Error getting embedding:', err);
    throw err;
  }
}

/**
 * Get embeddings for multiple queries in batch
 */
export async function getQueryEmbeddings(queries: string[]): Promise<Map<string, number[]>> {
  const results = new Map<string, number[]>();

  // Check cache and identify uncached queries
  const uncachedQueries: string[] = [];
  for (const query of queries) {
    const cacheKey = query.toLowerCase().trim();
    if (embeddingCache.has(cacheKey)) {
      results.set(query, embeddingCache.get(cacheKey)!);
    } else {
      uncachedQueries.push(query);
    }
  }

  // Fetch uncached embeddings in parallel
  if (uncachedQueries.length > 0) {
    const promises = uncachedQueries.map(async (query) => {
      const embedding = await getQueryEmbedding(query);
      results.set(query, embedding);
    });

    await Promise.all(promises);
  }

  return results;
}

/**
 * Clear the embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

/**
 * Get cache statistics
 */
export function getEmbeddingCacheStats(): { size: number; keys: string[] } {
  return {
    size: embeddingCache.size,
    keys: Array.from(embeddingCache.keys()),
  };
}
