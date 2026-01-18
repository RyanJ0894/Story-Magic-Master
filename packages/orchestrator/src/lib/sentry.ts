import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN || 'https://b06f55eedd1ad8fdedc4cabc42c48c12@o4510606462550016.ingest.us.sentry.io/4510733770948608';

export function initSentry() {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Only enable in production or when explicitly enabled
    enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLED === 'true',

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

  console.log(`📊 Sentry initialized (enabled: ${Sentry.isInitialized()})`);
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

export { Sentry };
