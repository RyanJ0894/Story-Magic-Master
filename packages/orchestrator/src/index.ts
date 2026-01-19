import express, { Request, Response, NextFunction, Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables first
dotenv.config();

// Initialize Sentry (must be before other imports that might throw)
import { initSentry, Sentry, captureError } from './lib/sentry.js';
initSentry();

// Initialize structured logging
import { httpLogger, log } from './lib/logger.js';

// Initialize monitoring
import { startMonitoring, stopMonitoring } from './lib/monitoring.js';

// Middleware
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware, strictRateLimitMiddleware } from './middleware/rate-limit.js';

// Routes
import healthRouter from './routes/health.js';
import generateScenesRouter from './routes/generate-scenes.js';
import orchestrateRouter from './routes/orchestrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '22002', 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Structured request logging with Pino
app.use(httpLogger);

// Routes
// Health check - no auth required
app.use('/', healthRouter);

// Protected routes - require authentication and rate limiting
app.use('/generate-scenes', authMiddleware, strictRateLimitMiddleware);
app.use('/orchestrate', authMiddleware, strictRateLimitMiddleware);
app.use('/', generateScenesRouter);
app.use('/', orchestrateRouter);

// Download endpoint - requires auth
app.get('/download/:project_id/:filename', authMiddleware, (req: Request, res: Response) => {
  const { project_id, filename } = req.params;
  const outputDir = path.join(process.cwd(), 'output', project_id);
  const filePath = path.join(outputDir, filename);

  // Sanitize filename to prevent path traversal
  if (filename.includes('..') || filename.includes('/')) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }

  log.info('Download request', { project_id, filename, exists: fs.existsSync(filePath) });

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
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

  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  log.info('Story Magic Consolidated Service started', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    endpoints: ['/health', '/generate-scenes', '/orchestrate'],
  });

  // Start Checkly heartbeat monitoring
  startMonitoring();
});

// Graceful shutdown
const shutdown = () => {
  log.info('Shutting down gracefully...');
  stopMonitoring();
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
