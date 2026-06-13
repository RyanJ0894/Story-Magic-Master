import express, { Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables first — explicit path ensures correct .env is loaded
// regardless of process.cwd() (which varies when launched from the monorepo root).
// dotenv does not override vars already set by Doppler/the shell, so this is safe in prod.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Validate environment variables
import { validateEnv, printEnvSummary, getOutputDir } from './lib/env.js';
validateEnv();
printEnvSummary();

// Initialize Sentry (must be before other imports that might throw)
import { initSentry, Sentry, captureError } from './lib/sentry.js';
initSentry();

// Initialize structured logging
import { httpLogger, log } from './lib/logger.js';

// Initialize monitoring
import { startMonitoring, stopMonitoring } from './lib/monitoring.js';

// Audio storage cleanup
import { startCleanupSchedule, stopCleanupSchedule } from './lib/cleanup.js';
import { seedVoiceCatalogIfEmpty } from './lib/seed-voice-catalog.js';

// Middleware
import { authMiddleware, optionalAuthMiddleware, serviceAuthMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware, strictRateLimitMiddleware } from './middleware/rate-limit.js';

// Routes
import healthRouter from './routes/health.js';
import generateScenesRouter from './routes/generate-scenes.js';
import orchestrateRouter from './routes/orchestrate.js';
import analyzeRouter from './routes/analyze.js';
import previewRouter from './routes/preview.js';
import impactRouter from './routes/impact.js';
import stemsRouter from './routes/stems.js';
import stitchSegmentsRouter from './routes/stitch-segments.js';
import internalManifestRouter from './routes/internal-manifest.js';

const app = express();
const PORT = parseInt(process.env.PORT || '22002', 10);

// CORS - restrict to known origins
const allowedOrigins = [
  process.env.WEB_URL,
  'http://localhost:22000',
  'http://localhost:3000',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
}));

// Security headers (HSTS, X-Content-Type-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // Not needed for API
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
}));

// Limit request body size to prevent memory exhaustion
// Script text max is 500KB, director JSON should be under 1MB
app.use(express.json({ limit: '2mb' }));

// Structured request logging with Pino
app.use(httpLogger);

// Static audio preview - serves catalog files for frontend preview player
app.use('/audio-preview', express.static(path.join(__dirname, '../catalog')));

// Generated project audio - serves output from persistent disk (AUDIO_OUTPUT_DIR)
app.use('/audio', express.static(getOutputDir(), {
  maxAge: '1d',
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));

// Impact story audio - serves generated impact story audio files
app.use('/impact-audio', express.static(path.join(getOutputDir(), 'impact'), {
  maxAge: '7d',
  setHeaders: (res) => { res.set('Access-Control-Allow-Origin', '*'); },
}));

// Routes
// Health check - no auth required
app.use('/', healthRouter);

// H8: prod manifest endpoint, gated by the same service-to-service auth as
// other internal routes so the web's /api/admin/manifest can aggregate.
app.use('/', serviceAuthMiddleware, internalManifestRouter);

// Protected routes - require authentication and rate limiting
// Generation routes accept either service-to-service key (X-Service-Key) or Clerk JWT
app.use('/generate-scenes', serviceAuthMiddleware, strictRateLimitMiddleware);
app.use('/orchestrate', serviceAuthMiddleware, strictRateLimitMiddleware);
app.use('/stitch-segments', serviceAuthMiddleware, strictRateLimitMiddleware);
app.use('/analyze', serviceAuthMiddleware, rateLimitMiddleware);
app.use('/preview', serviceAuthMiddleware, strictRateLimitMiddleware);
app.use('/', generateScenesRouter);
app.use('/', orchestrateRouter);
app.use('/', stitchSegmentsRouter);
app.use('/', analyzeRouter);
app.use('/', previewRouter);

// Impact StoryBuilder — service-to-service auth (x-service-key header)
app.use('/impact', serviceAuthMiddleware, impactRouter);

// Stem export — service-to-service auth (x-service-key header)
app.use('/', serviceAuthMiddleware, stemsRouter);

// Download endpoint - requires auth + ownership check
app.get('/download/:project_id/:filename', authMiddleware, async (req: Request, res: Response) => {
  const { project_id, filename } = req.params;

  // Validate project_id is a UUID to prevent path traversal
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(project_id)) {
    res.status(400).json({ error: 'Invalid project ID format' });
    return;
  }

  // Decode and sanitize filename to prevent path traversal (single + double encoded)
  const decodedFilename = decodeURIComponent(filename);
  if (decodedFilename.includes('..') || decodedFilename.includes('/') || decodedFilename.includes('\\')) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }

  // Require authenticated user — ownership check is mandatory, not optional
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { prisma } = await import('./lib/prisma.js');
    const project = await prisma.project.findFirst({
      where: { id: project_id, userId },
      select: { id: true },
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
  } catch (err) {
    log.error('Download ownership check failed', err instanceof Error ? err : undefined);
    res.status(500).json({ error: 'Failed to verify project ownership' });
    return;
  }

  const baseOutputDir = path.resolve(getOutputDir());
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal, javascript.express.security.audit.express-path-join-resolve-traversal.express-path-join-resolve-traversal
  const filePath = path.resolve(baseOutputDir, project_id, decodedFilename);

  // Verify resolved path is within output directory (belt-and-suspenders)
  if (!filePath.startsWith(baseOutputDir + path.sep)) {
    res.status(400).json({ error: 'Invalid file path' });
    return;
  }

  log.info('Download request', { project_id, filename });

  // Use res.download callback to handle missing files — avoids existsSync TOCTTOU race
  res.download(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'File not found' });
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
  });
});

// Sentry error handler (must be after all routes but before custom error handler)
Sentry.setupExpressErrorHandler(app);

// Error handler with Sentry and structured logging
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  log.error('Server error', err, {
    path: req.path,
    method: req.method,
    query: req.query,
  });

  // Capture error in Sentry
  captureError(err, {
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body ? JSON.stringify(req.body).slice(0, 1000) : undefined,
  });

  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: 'Internal server error',
    message: isProduction ? 'An unexpected error occurred' : err.message,
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  log.info('Story Magic Consolidated Service started', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    endpoints: ['/health', '/generate-scenes', '/orchestrate', '/analyze'],
  });

  // Start Checkly heartbeat monitoring
  startMonitoring();

  // Start audio storage cleanup schedule (every 6 hours)
  startCleanupSchedule();

  // Seed voice catalog if the DB table is empty. Deferred 2 seconds so it
  // doesn't block port binding / health checks; idempotent so repeat boots
  // are cheap. See lib/seed-voice-catalog.ts for the why.
  setTimeout(() => {
    seedVoiceCatalogIfEmpty().catch((err) => {
      log.warn('[seed-voice-catalog] uncaught error during seed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, 2_000);
});

// Disable socket idle timeout so long-running generation requests (15+ pages, 10+ min)
// don't get dropped by the OS or Render's internal proxy before the response is sent.
server.setTimeout(0);
// Keep-alive connections stay open for 65s (just above Render's 60s idle cutoff)
// so the load balancer doesn't recycle sockets between chunked requests.
server.keepAliveTimeout = 65000;

// Graceful shutdown
const shutdown = () => {
  log.info('Shutting down gracefully...');
  stopMonitoring();
  stopCleanupSchedule();
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
