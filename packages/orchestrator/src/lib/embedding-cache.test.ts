/**
 * Tests for the two-tier embedding cache (L1 in-memory + L2 Redis).
 *
 * Pins the contract that:
 *   - L1 hit short-circuits before Redis is touched.
 *   - L1 miss + L2 hit populates L1 and skips the fetcher.
 *   - L1 + L2 miss invokes the fetcher and writes back to BOTH tiers.
 *   - Redis read/write errors NEVER fail the request — fetcher still runs.
 *   - Disabling via EMBEDDING_CACHE_DISABLED skips L2 entirely.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted Redis mock so vi.mock factory can reference it ────────────────
const { mockGet, mockSet, MockRedis } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockSet = vi.fn();
  // Plain class so `new Redis(...)` works under v8 — vi.fn() does not honor
  // the [[Construct]] slot reliably across Node versions, hence the explicit
  // class instead of a function-style mock.
  const ctorSpy = vi.fn();
  class MockRedis {
    get = mockGet;
    set = mockSet;
    constructor(...args: unknown[]) {
      ctorSpy(...args);
    }
    // Expose the spy on the class for assertions like `MockRedis.mock.calls`.
    static mock = ctorSpy.mock;
  }
  return { mockGet, mockSet, MockRedis };
});

vi.mock('@upstash/redis', () => ({ Redis: MockRedis }));

vi.mock('./logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Stable embedding config so the test cache keys don't depend on production constants.
vi.mock('./embedding-config.js', () => ({
  EMBEDDING_MODEL: 'mock-model',
  EMBEDDING_DIMENSIONS: 4,
  assertEmbeddingDimension: vi.fn(),
}));

import {
  getOrFetchEmbedding,
  getEmbeddingCacheStats,
  __resetEmbeddingCacheForTests,
  __clearL1ForTests,
} from './embedding-cache.js';

const SAMPLE_VEC = [0.1, 0.2, 0.3, 0.4];

describe('getOrFetchEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __clearL1ForTests();
    __resetEmbeddingCacheForTests();
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
    delete process.env.EMBEDDING_CACHE_DISABLED;
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.EMBEDDING_CACHE_DISABLED;
  });

  it('full miss: invokes fetcher and writes back to both L1 and L2', async () => {
    mockGet.mockResolvedValueOnce(null);
    const fetcher = vi.fn().mockResolvedValue(SAMPLE_VEC);

    const result = await getOrFetchEmbedding('rainy night', fetcher);

    expect(result).toEqual(SAMPLE_VEC);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledTimes(1);
    // L2 write is fire-and-forget — give the void promise a microtask to land.
    await new Promise((r) => setImmediate(r));
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet.mock.calls[0][1]).toEqual(SAMPLE_VEC);
    expect(mockSet.mock.calls[0][2]).toMatchObject({ ex: expect.any(Number) });
  });

  it('L1 hit: returns cached value without touching Redis or fetcher', async () => {
    const fetcher = vi.fn().mockResolvedValue(SAMPLE_VEC);

    // Populate L1 via a first call (full miss).
    mockGet.mockResolvedValueOnce(null);
    await getOrFetchEmbedding('cached query', fetcher);
    vi.clearAllMocks();

    // Second call should be a pure L1 hit.
    const second = await getOrFetchEmbedding('cached query', fetcher);
    expect(second).toEqual(SAMPLE_VEC);
    expect(fetcher).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('L2 hit (L1 cold): populates L1 from Redis and skips fetcher', async () => {
    mockGet.mockResolvedValueOnce(SAMPLE_VEC);
    const fetcher = vi.fn().mockResolvedValue([9, 9, 9, 9]);

    const result = await getOrFetchEmbedding('redis-only', fetcher);

    expect(result).toEqual(SAMPLE_VEC);
    expect(fetcher).not.toHaveBeenCalled();

    // Subsequent call should now hit L1 (no Redis call).
    mockGet.mockClear();
    await getOrFetchEmbedding('redis-only', fetcher);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('Redis read failure: still calls fetcher and returns the fresh value', async () => {
    mockGet.mockRejectedValueOnce(new Error('Redis is down'));
    const fetcher = vi.fn().mockResolvedValue(SAMPLE_VEC);

    const result = await getOrFetchEmbedding('redis-broken', fetcher);

    expect(result).toEqual(SAMPLE_VEC);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('Redis write failure does NOT propagate to caller', async () => {
    mockGet.mockResolvedValueOnce(null);
    mockSet.mockRejectedValueOnce(new Error('Redis write rejected'));
    const fetcher = vi.fn().mockResolvedValue(SAMPLE_VEC);

    // Even though the write rejects, the caller sees the value cleanly.
    await expect(getOrFetchEmbedding('write-fails', fetcher)).resolves.toEqual(SAMPLE_VEC);
  });

  it('EMBEDDING_CACHE_DISABLED=true: skips Redis entirely (L1 only)', async () => {
    process.env.EMBEDDING_CACHE_DISABLED = 'true';
    __resetEmbeddingCacheForTests();

    const fetcher = vi.fn().mockResolvedValue(SAMPLE_VEC);
    await getOrFetchEmbedding('disabled', fetcher);

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('Missing Redis credentials: skips L2 gracefully', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __resetEmbeddingCacheForTests();

    const fetcher = vi.fn().mockResolvedValue(SAMPLE_VEC);
    await getOrFetchEmbedding('no-creds', fetcher);

    // Constructor spy should not have fired — getRedis() returned null without
    // instantiating the client.
    expect(MockRedis.mock.calls.length).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('cache key is namespaced by model + dimension to prevent cross-model bleed', async () => {
    mockGet.mockResolvedValueOnce(null);
    const fetcher = vi.fn().mockResolvedValue(SAMPLE_VEC);

    await getOrFetchEmbedding('Some Query', fetcher);

    const key = mockGet.mock.calls[0][0];
    expect(key).toMatch(/^embed:mock-model:4:/);
    // Case + whitespace are normalized.
    expect(key.endsWith(':some query')).toBe(true);
  });
});

describe('getEmbeddingCacheStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __clearL1ForTests();
    __resetEmbeddingCacheForTests();
  });

  it('reports L1 size and Redis configuration', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';
    __resetEmbeddingCacheForTests();
    mockGet.mockResolvedValueOnce(null);
    await getOrFetchEmbedding('stat-test', vi.fn().mockResolvedValue(SAMPLE_VEC));

    const stats = getEmbeddingCacheStats();
    expect(stats.l1Size).toBeGreaterThan(0);
    expect(stats.redisConfigured).toBe(true);
  });

  it('reports redisConfigured=false when creds absent', () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __resetEmbeddingCacheForTests();

    expect(getEmbeddingCacheStats().redisConfigured).toBe(false);
  });
});
