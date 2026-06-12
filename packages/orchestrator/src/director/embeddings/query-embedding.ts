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
import {
  getOrFetchEmbedding,
  getEmbeddingCacheStats as getCacheStats,
} from '../../lib/embedding-cache.js';
import { isQuotaExhaustedError, EmbeddingQuotaExhaustedError } from '../../lib/retry.js';

/**
 * Get embedding for a query string using OpenAI.
 *
 * Cache lookup is delegated to `lib/embedding-cache.ts` which layers an
 * Upstash Redis L2 over the existing in-process L1. A cold worker that
 * receives a query already embedded by another worker now skips OpenAI
 * entirely. Tier 2 of cost-opt Phase 2 (#186).
 */
export async function getQueryEmbedding(query: string): Promise<number[]> {
  try {
    return await getOrFetchEmbedding(query, async () => {
      const { embedding } = await embed({
        model: openai.embedding(EMBEDDING_MODEL),
        value: query,
      });

      // Fail loudly if a future SDK upgrade silently changes dimensions —
      // a 1024d vector matched against a 1536d catalog returns garbage scores.
      assertEmbeddingDimension(embedding, `getQueryEmbedding("${query.slice(0, 40)}")`);

      return embedding;
    });
  } catch (err) {
    if (isQuotaExhaustedError(err)) {
      log.error(
        'OpenAI embedding quota exhausted — halting audio search',
        err instanceof Error ? err : undefined,
        { query: query.slice(0, 80), model: EMBEDDING_MODEL },
      );
      throw new EmbeddingQuotaExhaustedError(
        err instanceof Error ? err.message : String(err),
      );
    }
    log.error('Error getting query embedding', err instanceof Error ? err : undefined);
    throw err;
  }
}

/**
 * Get embeddings for multiple queries in batch. Each query is looked up
 * independently through `getQueryEmbedding`, which handles the cache layers
 * — uncached entries are fetched in parallel.
 */
export async function getQueryEmbeddings(queries: string[]): Promise<Map<string, number[]>> {
  const results = new Map<string, number[]>();
  await Promise.all(
    queries.map(async (query) => {
      const embedding = await getQueryEmbedding(query);
      results.set(query, embedding);
    }),
  );
  return results;
}

/**
 * Get cache statistics — used by health endpoints + tests. Delegates to the
 * shared cache module so L1 size + L2 availability are visible.
 */
export function getEmbeddingCacheStats(): { size: number; redisConfigured: boolean } {
  const s = getCacheStats();
  return { size: s.l1Size, redisConfigured: s.redisConfigured };
}
