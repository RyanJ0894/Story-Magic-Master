/**
 * Query Embedding — get embeddings for audio-catalog search queries.
 *
 * Uses the same OpenAI model + dimensions as the stored catalog vectors so
 * cosine similarity makes sense. See `lib/embedding-config.ts` for the
 * canonical constants; **never** call `openai.embedding('...')` directly
 * with a different model — it WILL silently break similarity scoring or
 * trip the dimension guard in `embedding-store.ts`.
 *
 * Historical note: the prototype catalogs were 384-dim MiniLM-L6-v2 from the
 * Python codebase. The query path quietly produced 1536-dim OpenAI vectors,
 * so every search threw `Vector length mismatch: 1536 vs 384`. Fixed by
 * re-embedding the catalogs with text-embedding-3-small and unifying through
 * `EMBEDDING_MODEL` / `EMBEDDING_DIMENSIONS`.
 */

import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { log } from '../../lib/logger.js';
import { EMBEDDING_MODEL, assertEmbeddingDimension } from '../../lib/embedding-config.js';

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
      model: openai.embedding(EMBEDDING_MODEL),
      value: query,
    });

    // Fail loudly if a future SDK upgrade silently changes dimensions —
    // a 1024d vector matched against a 1536d catalog returns garbage scores.
    assertEmbeddingDimension(embedding, `getQueryEmbedding("${query.slice(0, 40)}")`);

    embeddingCache.set(cacheKey, embedding);

    return embedding;
  } catch (err) {
    log.error('Error getting query embedding', err instanceof Error ? err : undefined);
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
