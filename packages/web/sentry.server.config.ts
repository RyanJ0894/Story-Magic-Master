import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // 10% of transactions by default; override with SENTRY_TRACES_SAMPLE_RATE.
  tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
    ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
    : 0.1,

  // Environment
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',

  // Enabled whenever a DSN is configured, unless explicitly disabled.
  // Does NOT depend on NODE_ENV (Render leaves it unset).
  enabled: !!process.env.SENTRY_DSN && process.env.SENTRY_ENABLED !== 'false',

  // Filter out noisy errors
  ignoreErrors: [
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],
});
