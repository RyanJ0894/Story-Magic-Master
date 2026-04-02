import * as Sentry from '@sentry/nextjs';
import { log } from '@/lib/logger';

export const onRequestError = Sentry.captureRequestError;

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');

    // Validate environment variables at startup
    const { validateEnv } = await import('./lib/env-validation');
    const { valid, errors, warnings } = validateEnv();

    if (!valid) {
      for (const error of errors) {
        log.error(`[Env Validation] MISSING REQUIRED: ${error}`);
      }
    }

    for (const warning of warnings) {
      log.warn(`[Env Validation] Optional: ${warning}`);
    }

    if (valid) {
      log.info('[Env Validation] All required environment variables are set');
    }

    // Start the queue worker for background job processing.
    // The worker polls for 'queued' jobs and processes them with retry + lock support.
    // Only runs in persistent Node.js processes (Render.com), not in edge or build contexts.
    //
    // When WORKER_MODE=standalone, the worker runs as a separate process (see worker.ts),
    // so we skip starting it inside Next.js to avoid duplicate job processing.
    if (process.env.DATABASE_URL && process.env.WORKER_MODE !== 'standalone') {
      const { startWorker } = await import('./lib/queue/worker');
      startWorker({ pollIntervalMs: 5000, lockDurationSeconds: 600 });
      log.info('[Instrumentation] Queue worker started (embedded mode)');
    } else if (process.env.WORKER_MODE === 'standalone') {
      log.info('[Instrumentation] Queue worker skipped (standalone mode)');
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
