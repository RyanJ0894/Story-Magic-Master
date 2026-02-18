/**
 * Rate Limiting for Web API Routes
 *
 * Uses Upstash Redis in production (distributed), falls back to in-memory
 * sliding window when Redis env vars are missing (local dev).
 *
 * Three tiers:
 *   strict  — 5 req/min  (password guessing, expensive LLM/TTS calls)
 *   normal  — 20 req/min (default for authenticated routes)
 *   loose   — 60 req/min (health, public reads)
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

// Upstash Redis limiters (lazy-initialized)
let upstashLimiters: Record<RateLimitTier, unknown> | null = null;

async function getUpstashLimiter(tier: RateLimitTier) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) return null;

  if (!upstashLimiters) {
    try {
      const { Ratelimit } = await import('@upstash/ratelimit');
      const { Redis } = await import('@upstash/redis');

      const redis = new Redis({ url: redisUrl, token: redisToken });

      upstashLimiters = {
        strict: new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(TIER_CONFIGS.strict.maxRequests, '1 m'),
          prefix: 'sm-web-strict',
        }),
        normal: new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(TIER_CONFIGS.normal.maxRequests, '1 m'),
          prefix: 'sm-web-normal',
        }),
        loose: new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(TIER_CONFIGS.loose.maxRequests, '1 m'),
          prefix: 'sm-web-loose',
        }),
      };
    } catch {
      // Upstash packages not available — stay with in-memory
      return null;
    }
  }

  return upstashLimiters?.[tier] ?? null;
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

  try {
    // Try Upstash first
    const upstash = await getUpstashLimiter(tier);
    if (upstash) {
      const result = await (upstash as { limit(id: string): Promise<{ success: boolean; reset: number }> }).limit(identifier);
      if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
        log.warn('Rate limit exceeded (redis)', { identifier, tier, retryAfter });
        return NextResponse.json(
          { error: 'Too many requests', code: 'RATE_LIMITED', retryAfter },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        );
      }
      return null;
    }
  } catch (error) {
    log.error('Redis rate limit error, falling back to in-memory', error);
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
