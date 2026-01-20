import { Request, Response, NextFunction } from 'express';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { captureError } from '../lib/sentry.js';

// =============================================================================
// In-Memory Fallback Rate Limiter (used when Redis is unavailable)
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
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
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
}

// In-memory fallback limiters
const fallbackLimiter = new InMemoryRateLimiter(10, 60 * 1000); // 10 per minute
const fallbackStrictLimiter = new InMemoryRateLimiter(3, 60 * 1000); // 3 per minute

// =============================================================================
// Redis Rate Limiter Initialization
// =============================================================================
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let ratelimit: Ratelimit | null = null;

if (redisUrl && redisToken) {
  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  // Create rate limiter with sliding window
  // 10 requests per minute for expensive operations (generate, orchestrate)
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'story-magic',
  });

  console.log('🚦 Rate limiting initialized with Upstash Redis');
} else {
  console.warn('⚠️ Upstash credentials not configured - using in-memory rate limiting');
}

/**
 * Rate limiting middleware using Upstash Redis
 *
 * Limits requests per user (by user ID or IP address)
 * Returns 429 Too Many Requests when limit exceeded
 */
export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip if rate limiting is not configured
  if (!ratelimit) {
    return next();
  }

  // Skip rate limiting for health checks
  if (req.path === '/health' || req.path === '/') {
    return next();
  }

  // Skip if explicitly disabled
  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return next();
  }

  // Determine identifier (user ID if authenticated, IP otherwise)
  const identifier = req.user?.id || req.ip || 'anonymous';

  try {
    const { success, limit, reset, remaining } = await ratelimit.limit(identifier);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      console.warn(`🚫 Rate limit exceeded for ${identifier}`);

      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
        retryAfter,
      });
      return;
    }

    next();
  } catch (error) {
    // Log error and use in-memory fallback
    console.error('❌ Redis rate limit failed, using in-memory fallback:', error);
    captureError(error as Error, { identifier, path: req.path });

    // Use in-memory fallback instead of failing open
    const fallbackResult = fallbackLimiter.limit(identifier);

    res.setHeader('X-RateLimit-Limit', 10);
    res.setHeader('X-RateLimit-Remaining', fallbackResult.remaining);
    res.setHeader('X-RateLimit-Reset', fallbackResult.reset);
    res.setHeader('X-RateLimit-Fallback', 'true');

    if (!fallbackResult.success) {
      const retryAfter = Math.ceil((fallbackResult.reset - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      console.warn(`🚫 In-memory rate limit exceeded for ${identifier}`);

      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
        retryAfter,
      });
      return;
    }

    next();
  }
}

/**
 * Stricter rate limit for expensive operations (audio generation)
 * 3 requests per minute
 */
let strictRatelimit: Ratelimit | null = null;

if (redisUrl && redisToken) {
  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  strictRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 m'),
    analytics: true,
    prefix: 'story-magic-strict',
  });
}

export async function strictRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!strictRatelimit) {
    return next();
  }

  if (process.env.RATE_LIMIT_DISABLED === 'true') {
    return next();
  }

  const identifier = req.user?.id || req.ip || 'anonymous';

  try {
    const { success, limit, reset, remaining } = await strictRatelimit.limit(identifier);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      console.warn(`🚫 Strict rate limit exceeded for ${identifier}`);

      res.status(429).json({
        error: 'Too Many Requests',
        message: `Audio generation rate limit exceeded. Please retry after ${retryAfter} seconds.`,
        retryAfter,
      });
      return;
    }

    next();
  } catch (error) {
    console.error('❌ Redis strict rate limit failed, using in-memory fallback:', error);
    captureError(error as Error, { identifier, path: req.path });

    // Use strict in-memory fallback instead of failing open
    const fallbackResult = fallbackStrictLimiter.limit(identifier);

    res.setHeader('X-RateLimit-Limit', 3);
    res.setHeader('X-RateLimit-Remaining', fallbackResult.remaining);
    res.setHeader('X-RateLimit-Reset', fallbackResult.reset);
    res.setHeader('X-RateLimit-Fallback', 'true');

    if (!fallbackResult.success) {
      const retryAfter = Math.ceil((fallbackResult.reset - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      console.warn(`🚫 In-memory strict rate limit exceeded for ${identifier}`);

      res.status(429).json({
        error: 'Too Many Requests',
        message: `Audio generation rate limit exceeded. Please retry after ${retryAfter} seconds.`,
        retryAfter,
      });
      return;
    }

    next();
  }
}
