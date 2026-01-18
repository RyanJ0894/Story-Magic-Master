import { Request, Response, NextFunction } from 'express';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { captureError } from '../lib/sentry.js';

// Initialize Redis client if credentials are available
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
  console.warn('⚠️ Upstash credentials not configured - rate limiting disabled');
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
    // Log error but don't block request
    console.error('❌ Rate limit check failed:', error);
    captureError(error as Error, { identifier, path: req.path });

    // Fail open - allow request if rate limiting fails
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
    console.error('❌ Strict rate limit check failed:', error);
    captureError(error as Error, { identifier, path: req.path });
    next();
  }
}
