import * as Sentry from '@sentry/node';
import { log } from './logger.js';

const SENTRY_DSN = process.env.SENTRY_DSN;

export function initSentry() {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',

    // 10% of transactions by default; override with SENTRY_TRACES_SAMPLE_RATE.
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0.1,

    // Enabled whenever a DSN is configured, unless explicitly disabled.
    // Deliberately does NOT depend on NODE_ENV: Render doesn't set it, and
    // forcing NODE_ENV=production drops devDependencies at build time.
    enabled: !!SENTRY_DSN && process.env.SENTRY_ENABLED !== 'false',

    // Integrations
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],

    // Add extra context
    beforeSend(event) {
      // Filter out expected errors
      if (event.exception?.values?.[0]?.type === 'NotFoundError') {
        return null;
      }
      return event;
    },
  });

  log.info(`Sentry initialized (enabled: ${Sentry.isInitialized()})`);
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

export function setUserContext(userId: string, email?: string) {
  Sentry.setUser({ id: userId, email });
}

export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Tag the current Sentry scope with the project (and optionally job) the
 * request is operating on. Called by each route handler after it parses the
 * request body so subsequent errors are filterable in Sentry by project_id
 * + job_id.
 *
 * Sentry's Express integration scopes tags per-request, so concurrent
 * requests don't see each other's project_id.
 */
export function setProjectScope(projectId: string, jobId?: string): void {
  Sentry.setTag('project_id', projectId);
  if (jobId) Sentry.setTag('job_id', jobId);
}

export { Sentry };
