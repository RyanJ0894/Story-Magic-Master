/**
 * Embedding cache — L1 (in-memory) + L2 (Upstash Redis).
 *
 * Background:
 * - `getQueryEmbedding` was previously an in-process Map only. That covers
 *   repeats within a single Render worker but is wiped on restart, and each
 *   horizontally-scaled worker pays its own cold cache.
 * - The audio search path embeds the same handful of phrases across runs
 *   ("rainy night", "tense orchestral cinematic"). A 7-day Redis layer
 *   eliminates the OpenAI bill for those duplicates entirely.
 *
 * Design:
 * - L1: process-local Map. Cheapest hit.
 * - L2: Upstash Redis. Shared across workers + survives restart.
 * - L3: the actual OpenAI embed call (via the `fetcher` argument).
 *
 * Failure mode:
 * - If Redis is unconfigured or throws, we DO NOT fail the request — we just
 *   skip L2 and continue with L1 + fetcher. The whole feature is opt-in via
 *   `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (already used for
 *   rate-limiting, so production already has it).
 *
 * Disable entirely via `EMBEDDING_CACHE_DISABLED=true` (e.g. while
 * regenerating catalogs and you want every query to hit OpenAI fresh).
 *
 * Tracking: Tier 2 of #186.
 */

import { Redis } from '@upstash/redis';
import { log } from './logger.js';
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from './embedding-config.js';

/**
 * 7-day TTL by default. Catalogs change infrequently and an embedding for
 * "tense orchestral" is stable across model snapshots within
 * text-embedding-3-small — there is no quality benefit to short TTLs.
 */
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Redis key prefix includes the model + dimension so a future model migration
 * cannot accidentally serve stale 1536d vectors that were embedded by a
 * different model snapshot.
 */
function cacheKey(query: string): string {
  const normalized = query.toLowerCase().trim();
  return `embed:${EMBEDDING_MODEL}:${EMBEDDING_DIMENSIONS}:${normalized}`;
}

let cachedRedis: Redis | null | undefined;

/**
 * Lazy singleton — only constructs the client when Redis credentials are
 * present AND the cache hasn't been disabled. Returns `null` to signal
 * "L2 unavailable; skip".
 */
function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;

  if (process.env.EMBEDDING_CACHE_DISABLED === 'true') {
    cachedRedis = null;
    return null;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    cachedRedis = null;
    return null;
  }

  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

/**
 * Test-only: reset the cached Redis singleton so tests can re-evaluate env
 * vars between cases. Not exported in production paths.
 */
export function __resetEmbeddingCacheForTests(): void {
  cachedRedis = undefined;
}

/**
 * L1 — process-local cache. Backed by a plain Map; entries live until the
 * process restarts. Exported as a constant so the existing query-embedding
 * module can swap to this without removing its old Map.
 */
const l1 = new Map<string, number[]>();

async function readL2(key: string): Promise<number[] | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const val = await r.get<number[]>(key);
    return Array.isArray(val) ? val : null;
  } catch (err) {
    log.warn('[embedding-cache] Redis read failed; falling back to fetcher', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function writeL2(key: string, vec: number[]): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, vec, { ex: DEFAULT_TTL_SECONDS });
  } catch (err) {
    // A failed write is not a request-level failure — we still have the
    // vector in hand from L1.
    log.warn('[embedding-cache] Redis write failed; L1 still populated', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Get a cached embedding for `query`, falling back through L1 → L2 → fetcher.
 *
 * The fetcher is only invoked on a full miss. On a fetcher invocation the
 * returned vector is written back to both L1 and L2.
 */
export async function getOrFetchEmbedding(
  query: string,
  fetcher: () => Promise<number[]>,
): Promise<number[]> {
  const key = cacheKey(query);

  const l1Hit = l1.get(key);
  if (l1Hit) return l1Hit;

  const l2Hit = await readL2(key);
  if (l2Hit) {
    l1.set(key, l2Hit);
    return l2Hit;
  }

  const fresh = await fetcher();
  l1.set(key, fresh);
  // Fire-and-forget L2 write — don't make request latency wait for Redis.
  void writeL2(key, fresh);
  return fresh;
}

/**
 * Diagnostic helper — used by `/health` and tests. Does not include the
 * vectors themselves to keep the response small.
 */
export function getEmbeddingCacheStats(): { l1Size: number; redisConfigured: boolean } {
  return {
    l1Size: l1.size,
    redisConfigured: getRedis() !== null,
  };
}

/** Test-only: clear L1. */
export function __clearL1ForTests(): void {
  l1.clear();
}
