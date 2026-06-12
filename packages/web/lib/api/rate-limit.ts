/**
 * Rate Limiting for Web API Routes
 *
 * Uses Render Redis (via ioredis + rate-limiter-flexible) in production
 * (distributed across web instances), falls back to in-memory sliding window
 * when `REDIS_URL` is unset (local dev, or before the Redis migration).
 *
 * Three tiers:
 *   strict  — 5 req/min  (password guessing, expensive LLM/TTS calls)
 *   normal  — 20 req/min (default for authenticated routes)
 *   loose   — 60 req/min (health, public reads)
 *
 * History: previously used Upstash REST (@upstash/redis + @upstash/ratelimit).
 * Migrated to Render Redis TCP after the Upstash account was deleted
 * (see PR opening this file).
 */

import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export type RateLimitTier = 'strict' | 'normal' | 'loose';

interface TierConfig {
  maxRequests: number;
  windowMs: number;
}

const TIER_CONFIGS: Record<RateLimitTier, TierConfig> = {
  strict: { maxRequests: 5, windowMs: 60_000 },
  normal: { maxRequests: 20, windowMs: 60_000 },
  loose: { maxRequests: 60, windowMs: 60_000 },
};

// =============================================================================
// In-Memory Fallback Rate Limiter (sliding window with token bucket)
// =============================================================================

export class InMemoryRateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private windowMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxRequests: number, windowMs: number) {
    this.maxTokens = maxRequests;
    this.refillRate = maxRequests / (windowMs / 1000);
    this.windowMs = windowMs;

    // Cleanup old entries every 5 minutes
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    // Allow timer to be garbage collected
    if (this.cleanupTimer?.unref) this.cleanupTimer.unref();
  }

  private cleanup(): void {
    const now = Date.now();
    const keys = Array.from(this.buckets.keys());
    for (const key of keys) {
      const bucket = this.buckets.get(key);
      if (bucket && now - bucket.lastRefill > this.windowMs * 2) {
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

    // Refill tokens based on time elapsed
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

  /** Visible for testing */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.buckets.clear();
  }
}

// =============================================================================
// Limiter Instances (per-tier)
// =============================================================================

const memoryLimiters: Record<RateLimitTier, InMemoryRateLimiter> = {
  strict: new InMemoryRateLimiter(TIER_CONFIGS.strict.maxRequests, TIER_CONFIGS.strict.windowMs),
  normal: new InMemoryRateLimiter(TIER_CONFIGS.normal.maxRequests, TIER_CONFIGS.normal.windowMs),
  loose: new InMemoryRateLimiter(TIER_CONFIGS.loose.maxRequests, TIER_CONFIGS.loose.windowMs),
};

// =============================================================================
// Runtime circuit breaker — guard against Redis becoming unreachable AFTER init.
// =============================================================================
// Init-time failures are caught by `redisInitFailed`. Runtime failures are
// handled here: count consecutive Redis errors and, after a threshold, open
// the circuit for a cool-down. While open we bypass Redis entirely (one warn
// when opening, one info when closing). After the cool-down we probe once.

const CIRCUIT_OPEN_THRESHOLD = 3;
const CIRCUIT_OPEN_DURATION_MS = 60_000;

class CircuitBreaker {
  private consecutiveFailures = 0;
  private openUntil = 0;

  isOpen(): boolean {
    if (this.openUntil === 0) return false;
    if (Date.now() < this.openUntil) return true;
    log.info('Rate-limit circuit closing — probing Redis again');
    this.openUntil = 0;
    this.consecutiveFailures = 0;
    return false;
  }

  recordSuccess(): void {
    if (this.consecutiveFailures > 0) this.consecutiveFailures = 0;
  }

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

// Render Redis (ioredis) limiters — lazy-initialized.
// rate-limiter-flexible.RateLimiterRedis is a fixed-window counter, which is
// functionally equivalent to Upstash's sliding-window for our 1-minute windows.
interface RedisLimiterCtx {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  limiter: any;
}
let redisLimiters: Record<RateLimitTier, RedisLimiterCtx> | null = null;
let redisInitFailed = false;

async function getRedisLimiter(tier: RateLimitTier): Promise<RedisLimiterCtx['limiter'] | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  if (redisInitFailed) return null;

  if (!redisLimiters) {
    try {
      // Dynamic imports keep these out of the bundle when REDIS_URL is unset
      // (e.g. local dev). The Render build still tree-shakes them per route.
      const { default: IORedis } = await import('ioredis');
      const { RateLimiterRedis } = await import('rate-limiter-flexible');

      // ioredis options:
      //  - tls/rediss handled automatically when the URL scheme is rediss://
      //  - lazyConnect avoids hanging the process if Redis is briefly unreachable;
      //    the limiter falls back via `insuranceLimiter` (we use in-memory below)
      //  - maxRetriesPerRequest cap so one bad request can't hang for minutes
      const redis = new IORedis(redisUrl, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 5_000,
      });

      redis.on('error', (err) => {
        log.warn('Redis client error (rate-limit)', { msg: err.message });
      });

      const makeLimiter = (cfg: TierConfig, prefix: string) =>
        new RateLimiterRedis({
          storeClient: redis,
          keyPrefix: prefix,
          points: cfg.maxRequests,
          duration: Math.round(cfg.windowMs / 1000),
          // If Redis becomes unreachable mid-request, fall back to in-memory
          // immediately rather than waiting for the timeout. The catch block
          // in rateLimit() handles the actual fallback.
          inMemoryBlockOnConsumed: cfg.maxRequests,
          inMemoryBlockDuration: Math.round(cfg.windowMs / 1000),
        });

      redisLimiters = {
        strict: { limiter: makeLimiter(TIER_CONFIGS.strict, 'sm-web-strict') },
        normal: { limiter: makeLimiter(TIER_CONFIGS.normal, 'sm-web-normal') },
        loose: { limiter: makeLimiter(TIER_CONFIGS.loose, 'sm-web-loose') },
      };

      log.info('Rate limiter: Render Redis active', { url: redisUrl.replace(/:[^@]+@/, ':***@') });
    } catch (err) {
      // Module missing OR Redis init error → never retry this process lifetime
      redisInitFailed = true;
      log.warn('Rate limiter: Redis init failed; using in-memory only', {
        msg: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  return redisLimiters?.[tier]?.limiter ?? null;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Check rate limit for the given identifier and tier.
 *
 * @returns `null` if the request is allowed, or a 429 NextResponse if blocked.
 */
export async function rateLimit(
  identifier: string,
  tier: RateLimitTier = 'normal',
): Promise<NextResponse | null> {
  // Disabled via env
  if (process.env.RATE_LIMIT_DISABLED === 'true') return null;

  // Skip Redis entirely while the circuit is open (runtime failure cool-down).
  if (!circuit.isOpen()) {
    try {
      const redis = await getRedisLimiter(tier);
      if (redis) {
        try {
          const result = await redis.consume(identifier);
          circuit.recordSuccess();
          // RateLimiterRes on success — request allowed
          const remaining = result.remainingPoints ?? 0;
          if (remaining < 0) {
            // Defensive: rate-limiter-flexible normally throws on block,
            // but a negative remaining means we ran out.
            throw result;
          }
          return null;
        } catch (rejected) {
          // rate-limiter-flexible throws a RateLimiterRes when blocked.
          // That's a legitimate 429, NOT a Redis failure.
          if (rejected && typeof rejected === 'object' && 'msBeforeNext' in rejected) {
            circuit.recordSuccess(); // The limiter served us a real answer.
            const msBeforeNext = (rejected as { msBeforeNext: number }).msBeforeNext;
            const retryAfter = Math.ceil(msBeforeNext / 1000);
            log.warn('Rate limit exceeded (redis)', { identifier, tier, retryAfter });
            return NextResponse.json(
              { error: 'Too many requests', code: 'RATE_LIMITED', retryAfter },
              { status: 429, headers: { 'Retry-After': String(retryAfter) } },
            );
          }
          // Genuine Redis failure — trip the circuit so we stop trying.
          circuit.recordFailure(rejected);
          throw rejected;
        }
      }
    } catch (error) {
      // Already counted in circuit.recordFailure above. Only log once per call
      // until the circuit opens (then the open warn takes over).
      if (!circuit.isOpen()) {
        log.warn('Redis rate limit transient error, using in-memory for this request', {
          msg: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // In-memory fallback
  const result = memoryLimiters[tier].limit(identifier);
  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    log.warn('Rate limit exceeded (in-memory)', { identifier, tier, retryAfter });
    return NextResponse.json(
      { error: 'Too many requests', code: 'RATE_LIMITED', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  return null;
}

/**
 * Extract a client identifier from a request (IP or user ID fallback).
 */
export function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}
