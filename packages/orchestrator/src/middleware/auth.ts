import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { captureError } from '../lib/sentry.js';

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

// Initialize Supabase client for auth verification
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials not configured - auth middleware will reject all requests');
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

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

  // Check if auth is enabled
  if (process.env.AUTH_DISABLED === 'true') {
    console.warn('⚠️ Auth disabled via AUTH_DISABLED env var');
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
    console.log(`🔐 Auth: ${user.email?.slice(0, 3)}***@*** verified`);

    next();
  } catch (error) {
    console.error('❌ Auth error:', error);
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
    console.log('🔐 Service auth verified');
    return next();
  }

  // If service key doesn't match, try user auth
  authMiddleware(req, res, next);
}
