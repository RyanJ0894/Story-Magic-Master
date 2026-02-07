import { Request, Response, NextFunction } from 'express';
import { supabaseClient as supabase } from '../lib/supabase.js';
import { captureError } from '../lib/sentry.js';
import { log } from '../lib/logger.js';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
      };
    }
  }
}

if (!supabase) {
  log.warn('Supabase credentials not configured - auth middleware will reject all requests');
}

/**
 * Authentication middleware that verifies Supabase JWT tokens
 *
 * Usage:
 *   app.use('/api/protected', authMiddleware);
 *
 * Expects Authorization header: "Bearer <jwt_token>"
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip auth for health checks
  if (req.path === '/health' || req.path === '/') {
    return next();
  }

  // Check if auth is disabled (development only)
  if (process.env.AUTH_DISABLED === 'true') {
    if (process.env.NODE_ENV === 'production') {
      log.error('AUTH_DISABLED=true is not allowed in production. Rejecting request.');
      res.status(503).json({
        error: 'Service misconfigured',
        message: 'Authentication cannot be disabled in production',
      });
      return;
    }
    log.warn('Auth disabled via AUTH_DISABLED env var (development only)');
    return next();
  }

  // Check if Supabase is configured
  if (!supabase) {
    res.status(503).json({
      error: 'Service unavailable',
      message: 'Authentication service not configured',
    });
    return;
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
    });
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Verify the JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: error?.message || 'Invalid or expired token',
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    // Log successful auth (minimal info)
    log.info('Auth: user verified', { emailPrefix: user.email?.slice(0, 3) });

    next();
  } catch (error) {
    log.error('Auth error', error instanceof Error ? error : undefined, { path: req.path });
    captureError(error as Error, { path: req.path });

    res.status(500).json({
      error: 'Authentication failed',
      message: 'Error verifying token',
    });
  }
}

/**
 * Optional auth middleware - allows requests through but attaches user if present
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ') || !supabase) {
    return next();
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    }
  } catch {
    // Ignore errors for optional auth
  }

  next();
}

/**
 * Service-to-service auth using a shared secret
 * Used for internal calls from web app to orchestrator
 */
export function serviceAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const serviceKey = req.headers['x-service-key'];
  const expectedKey = process.env.SERVICE_SECRET_KEY;

  // If no service key configured, fall back to user auth
  if (!expectedKey) {
    authMiddleware(req, res, next);
    return;
  }

  if (serviceKey === expectedKey) {
    log.info('Service auth verified');
    return next();
  }

  // If service key doesn't match, try user auth
  authMiddleware(req, res, next);
}
