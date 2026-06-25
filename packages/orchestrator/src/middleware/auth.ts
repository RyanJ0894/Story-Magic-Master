import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/backend';
import { captureError, Sentry } from '../lib/sentry.js';
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

function getClerkSecretKey(): string | undefined {
  return process.env.CLERK_SECRET_KEY;
}

/**
 * Authentication middleware that verifies Clerk JWT tokens
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

  // Check if Clerk is configured
  const clerkSecretKey = getClerkSecretKey();
  if (!clerkSecretKey) {
    log.warn('CLERK_SECRET_KEY not configured - auth middleware will reject all requests');
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
    // Verify the JWT with Clerk
    const claims = await verifyToken(token, {
      secretKey: clerkSecretKey,
    });

    // Attach user to request
    req.user = {
      id: claims.sub,
      email: (claims as Record<string, unknown>).email as string | undefined,
    };

    // Tag Sentry so every event emitted during this request (and the project
    // tag set by the route handler, see lib/sentry.ts::setProjectScope) carries
    // user attribution. Sentry's Express integration scopes this per-request,
    // so it doesn't bleed across concurrent requests.
    Sentry.setUser({
      id: req.user.id,
      email: req.user.email,
    });

    // Log successful auth (minimal info)
    log.info('Auth: user verified', { userId: claims.sub.slice(0, 8) + '...' });

    next();
  } catch (error) {
    log.error('Auth error', error instanceof Error ? error : undefined, { path: req.path });
    captureError(error as Error, { path: req.path });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
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

  const clerkSecretKey = getClerkSecretKey();
  if (!authHeader || !authHeader.startsWith('Bearer ') || !clerkSecretKey) {
    return next();
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const claims = await verifyToken(token, {
      secretKey: clerkSecretKey,
    });
    req.user = {
      id: claims.sub,
      email: (claims as Record<string, unknown>).email as string | undefined,
    };
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
    req.user = { id: 'service:web', role: 'service' };
    return next();
  }

  // If service key doesn't match, try user auth
  authMiddleware(req, res, next);
}
