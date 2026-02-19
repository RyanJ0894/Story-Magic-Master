/**
 * Standalone Queue Worker Entry Point
 *
 * Runs the job queue worker as an independent Node.js process,
 * separate from the Next.js web server.
 *
 * Usage:
 *   pnpm worker                          # via package.json script
 *   npx tsx worker.ts                    # direct invocation
 *   node dist/worker.js                  # compiled JS
 *
 * Environment:
 *   DATABASE_URL          - Required. PostgreSQL connection string.
 *   QUEUE_CONCURRENCY     - Optional. Max concurrent jobs (default: 3).
 *   WORKER_POLL_INTERVAL  - Optional. Poll interval in ms (default: 5000).
 *   WORKER_LOCK_DURATION  - Optional. Lock duration in seconds (default: 600).
 */

import { startWorker, stopWorker, getWorkerStatus } from './lib/queue/worker';
import { log } from './lib/logger';

// ---------------------------------------------------------------------------
// Validate required environment
// ---------------------------------------------------------------------------

if (!process.env.DATABASE_URL) {
  console.error('[Worker] DATABASE_URL is required. Exiting.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Configuration from environment
// ---------------------------------------------------------------------------

const pollIntervalMs = parseInt(process.env.WORKER_POLL_INTERVAL || '5000', 10);
const lockDurationSeconds = parseInt(process.env.WORKER_LOCK_DURATION || '600', 10);

// ---------------------------------------------------------------------------
// Start worker
// ---------------------------------------------------------------------------

log.info('[Worker] Starting standalone queue worker', {
  pollIntervalMs,
  lockDurationSeconds,
  pid: process.pid,
});

startWorker({ pollIntervalMs, lockDurationSeconds });

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  log.info(`[Worker] Received ${signal}, shutting down gracefully...`);

  const status = getWorkerStatus();
  if (status.currentJobId) {
    log.info('[Worker] Waiting for current job to release lock...', {
      jobId: status.currentJobId,
    });
  }

  try {
    await stopWorker();
    log.info('[Worker] Shutdown complete', {
      jobsProcessed: status.jobsProcessed,
      uptime: status.startedAt
        ? `${Math.round((Date.now() - status.startedAt.getTime()) / 1000)}s`
        : 'unknown',
    });
  } catch (error) {
    log.error('[Worker] Error during shutdown', error);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Keep the process alive
process.on('uncaughtException', (error) => {
  log.error('[Worker] Uncaught exception', error);
  // Don't exit — let the worker continue processing other jobs
});

process.on('unhandledRejection', (reason) => {
  log.error('[Worker] Unhandled rejection', reason instanceof Error ? reason : { reason });
});
