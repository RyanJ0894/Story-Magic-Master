/**
 * Rate Limiting Middleware for Orchestrator
 *
 * Two tiers:
 *   normal — 10 req/min (default for authenticated routes)
 *   strict — 3 req/min  (expensive operations: /generate-scenes, /orchestrate)
 *
 * Uses Render Redis (via ioredis + rate-limiter-flexible) when REDIS_URL is set,
 * falls back to in-memory sliding-window otherwise.
 *
 * Two layers of resilience:
 *   1. Init-time circuit-breaker (`redisInitFailed`) — if the import/client
 *      construction throws once, we never retry for the process lifetime.
 *   2. Runtime circuit-breaker (`circuit`) — if Redis becomes unreachable
 *      after init succeeds, count consecutive failures. After
 *      CIRCUIT_OPEN_THRESHOLD failures we open the circuit for
 *      CIRCUIT_OPEN_DURATION_MS ms (skip Redis, go straight to in-memory,
 *      no log noise). After the cool-down we try Redis again.
 *
 * History: previously used Upstash REST (@upstash/redis + @upstash/ratelimit).
 * Migrated to Render Redis after the Upstash account was deleted.
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../lib/logger.js';

// =============================================================================
// In-Memory Fallback Rate Limiter
// =============================================================================
class InMemoryRateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxTokens = maxRequests;
    this.refillRate = maxRequests / (windowMs / 1000);
    this.windowMs = windowMs;

    // Cleanup old entries every 5 minutes
    const t = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (t.unref) t.unref();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > this.windowMs * 2) {
        this.buckets.delete(key);
      }
    }
  }

  limit(identifier: string): { success: boolean; remaining: number; reset: number } {
    const now = Date.now();
    let bucket = this.buckets.get(identifier);

    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(identifier, bucket);
    }

    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsed * this.refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        success: true,
        remaining: Math.floor(bucket.tokens),
        reset: now + this.windowMs,
      };
    }

    return {
      success: false,
      remaining: 0,
      reset: now + Math.ceil((1 - bucket.tokens) / this.refillRate) * 1000,
    };
  }
}

// In-memory fallback limiters
const fallbackLimiter = new InMemoryRateLimiter(10, 60 * 1000); // 10 per minute
const fallbackStrictLimiter = new InMemoryRateLimiter(3, 60 * 1000); // 3 per minute

// =============================================================================
// Runtime Circuit Breaker
// =============================================================================
// If Redis is healthy at init but goes away later, the per-request try/catch
// would otherwise log + retry on every single request. The circuit breaker
// counts consecutive failures and, on hitting the threshold, opens the circuit
// for a cool-down period — during which we skip Redis entirely and go straight
// to in-memory. One log line at the open, one at the close. No flood.

const CIRCUIT_OPEN_THRESHOLD = 3;          // after 3 consecutive failures...
const CIRCUIT_OPEN_DURATION_MS = 60_000;   // ...skip Redis for 60s.

class CircuitBreaker {
  private consecutiveFailures = 0;
  private openUntil = 0;

  /** True when the circuit is open — caller should bypass Redis. */
  isOpen(): boolean {
    if (this.openUntil === 0) return false;
    if (Date.now() < this.openUntil) return true;
    // Cool-down expired — close the circuit and let the next call probe Redis.
    log.info('Rate-limit circuit closing — probing Redis again');
    this.openUntil = 0;
    this.consecutiveFailures = 0;
    return false;
  }

  /** Record a successful Redis op. */
  recordSuccess(): void {
    if (this.consecutiveFailures > 0) {
      this.consecutiveFailures = 0;
    }
  }

  /** Record a failed Redis op. May open the circuit. */
  recordFailure(err: unknown): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= CIRCUIT_OPEN_THRESHOLD && this.openUntil === 0) {
      this.openUntil = Date.now() + CIRCUIT_OPEN_DURATION_MS;
      log.warn(
        `Rate-limit circuit opened after ${CIRCUIT_OPEN_THRESHOLD} consecutive Redis failures — ` +
        `using in-memory only for ${CIRCUIT_OPEN_DURATION_MS / 1000}s`,
        { lastError: err instanceof Error ? err.message : String(err) },
      );
    }
  }
}

const circuit = new CircuitBreaker();

// =============================================================================
// Redis (Render Key Value) — ioredis + rate-limiter-flexible
// =============================================================================
interface RedisLimiters {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normal: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  strict: any;
}

let redisLimiters: RedisLimiters | null = null;
let redisInitFailed = false;
let redisInitPromise: Promise<RedisLimiters | null> | null = null;

async function getRedisLimiters(): Promise<RedisLimiters | null> {
  if (!process.env.REDIS_URL) return null;
  if (redisInitFailed) return null;
  if (redisLimiters) return redisLimiters;

  // Dedupe concurrent init attempts on the first burst of requests
  if (redisInitPromise) return redisInitPromise;

  redisInitPromise = (async () => {
    try {
      // ioredis ships as a CommonJS module; the named import shape is the
      // most portable across tsconfig settings.
      const ioredisMod = await import('ioredis');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const IORedis: any = (ioredisMod as { default?: unknown }).default ?? ioredisMod;
      const { RateLimiterRedis } = await import('rate-limiter-flexible');

      const redis = new IORedis(process.env.REDIS_URL as string, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 5_000,
        // Don't try to reconnect forever — let the circuit breaker handle long outages.
        // ioredis returns the delay in ms or null to stop retrying.
        retryStrategy: (times: number) => (times > 10 ? null : Math.min(times * 200, 2_000)),
      });

      redis.on('error', (_err: Error) => {
        // ioredis emits "error" on connect failures + reconnect attempts.
        // Don't log here — the circuit breaker logs once when it opens.
        // (Without this handler ioredis would crash the process on unhandled error.)
      });

      redisLimiters = {
        normal: new RateLimiterRedis({
          storeClient: redis,
          keyPrefix: 'story-magic',
          points: 10,
          duration: 60,
          inMemoryBlockOnConsumed: 10,
          inMemoryBlockDuration: 60,
        }),
        strict: new RateLimiterRedis({
          storeClient: redis,
          keyPrefix: 'story-magic-strict',
          points: 3,
          duration: 60,
          inMemoryBlockOnConsumed: 3,
          inMemoryBlockDuration: 60,
        }),
      };

      log.info('Rate limiting initialized with Render Redis (ioredis)');
      return redisLimiters;
    } catch (err) {
      redisInitFailed = true;
      log.warn('Rate limiter Redis init failed — using in-memory only', {
        msg: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  })();

  return redisInitPromise;
}

// =============================================================================
// Helpers — apply a rate-limit decision via rate-limiter-flexible or fallback.
// =============================================================================

type Tier = 'normal' | 'strict';

const TIER_LIMITS: Record<Tier, number> = { normal: 10, strict: 3 };

interface LimitDecision {
  success: boolean;
  retryAfter: number;
  remaining: number;
  reset: number;
  via: 'redis' | 'in-memory';
}

async function evaluateLimit(
  identifier: string,
  tier: Tier,
): Promise<LimitDecision> {
  const fallback = tier === 'strict' ? fallbackStrictLimiter : fallbackLimiter;

  const useRedis = !circuit.isOpen();
  if (useRedis) {
    const limiters = await getRedisLimiters();
    const limiter = limiters?.[tier];
    if (limiter) {
      try {
        const result = await limiter.consume(identifier);
        circuit.recordSuccess();
        return {
          success: true,
          retryAfter: 0,
          remaining: result.remainingPoints ?? 0,
          reset: Date.now() + (result.msBeforeNext ?? 60_000),
          via: 'redis',
        };
      } catch (rejected) {
        // rate-limiter-flexible throws a RateLimiterRes on block — that's a
        // legitimate 429, NOT a Redis failure. Distinguish by shape.
        if (rejected && typeof rejected === 'object' && 'msBeforeNext' in rejected) {
          const r = rejected as { msBeforeNext: number; remainingPoints?: number };
          circuit.recordSuccess(); // The limiter served us a real answer.
          return {
            success: false,
            retryAfter: Math.ceil(r.msBeforeNext / 1000),
            remaining: 0,
            reset: Date.now() + r.msBeforeNext,
            via: 'redis',
          };
        }
        // Genuine Redis failure (network, timeout, NXDOMAIN). Trip the circuit.
        circuit.recordFailure(rejected);
      }
    }
  }

  // Either Redis is unavailable, init failed, circuit is open, or the Redis
  // call threw a non-RateLimiterRes error. Fall back to in-memory.
  const result = fallback.limit(identifier);
  return {
    success: result.success,
    retryAfter: result.success ? 0 : Math.ceil((result.reset - Date.now()) / 1000),
    remaining: result.remaining,
    reset: result.reset,
    via: 'in-memory',
  };
}

function applyHeaders(res: Response, tier: Tier, decision: LimitDecision): void {
  res.setHeader('X-RateLimit-Limit', TIER_LIMITS[tier]);
  res.setHeader('X-RateLimit-Remaining', decision.remaining);
  res.setHeader('X-RateLimit-Reset', decision.reset);
  if (decision.via === 'in-memory') res.setHeader('X-RateLimit-Fallback', 'true');
  if (!decision.success) res.setHeader('Retry-After', decision.retryAfter);
}

// =============================================================================
// Public middleware
// =============================================================================

/**
 * Default rate limit (10 req/min). Skips health checks.
 */
export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.path === '/health' || req.path === '/') return next();
  if (process.env.RATE_LIMIT_DISABLED === 'true') return next();

  const identifier = req.user?.id || req.ip || 'anonymous';
  const decision = await evaluateLimit(identifier, 'normal');
  applyHeaders(res, 'normal', decision);

  if (!decision.success) {
    log.warn('Rate limit exceeded', { identifier, via: decision.via });
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Please retry after ${decision.retryAfter} seconds.`,
      retryAfter: decision.retryAfter,
    });
    return;
  }

  next();
}

/**
 * Strict rate limit (3 req/min) for expensive operations (audio generation).
 *
 * 2026-06-25: Internal service-to-service traffic (web → orchestrator,
 * authenticated via SERVICE_SECRET_KEY) bypasses the strict limit. Reason:
 * `serviceAuthMiddleware` validates the shared secret but does not set
 * `req.user`, so internal calls were falling through to `req.ip` — which on
 * Render is the web service's single egress IP. Every user on the platform
 * effectively shared one 3/min bucket on /orchestrate. Ryan's 50-scene job
 * (job 3a9db72b) hit this at chunks 6–7. The whole point of the strict
 * limit is to stop external abuse; trusted internal callers should be
 * capacity-managed by the queue + DB pool, not by a 3/min anti-DDOS cap.
 */
export async function strictRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (process.env.RATE_LIMIT_DISABLED === 'true') return next();

  // Trusted internal traffic — the shared secret is server-only and never
  // reaches a browser. Compare against the expected secret if configured;
  // if SERVICE_SECRET_KEY is unset, the bypass is inert.
  const expected = process.env.SERVICE_SECRET_KEY;
  if (expected && req.headers['x-service-key'] === expected) {
    return next();
  }

  const identifier = req.user?.id || req.ip || 'anonymous';
  const decision = await evaluateLimit(identifier, 'strict');
  applyHeaders(res, 'strict', decision);

  if (!decision.success) {
    log.warn('Strict rate limit exceeded', { identifier, via: decision.via });
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Audio generation rate limit exceeded. Please retry after ${decision.retryAfter} seconds.`,
      retryAfter: decision.retryAfter,
    });
    return;
  }

  next();
}
