import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% of transactions by default; override with NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE.
  tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
    ? Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE)
    : 0.1,

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Environment
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',

  // Enabled whenever a DSN is configured, unless explicitly disabled.
  // Does NOT depend on NODE_ENV (Render leaves it unset).
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NEXT_PUBLIC_SENTRY_ENABLED !== 'false',

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
      // Block screenplay content areas from session replays entirely
      block: [
        '[data-testid="script-textarea"]',
        '[data-testid="script-editor"]',
        '[data-testid="player-content"]',
        '.script-content',
        '.screenplay-text',
      ],
    }),
  ],

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Network errors
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // User-caused errors
    'ResizeObserver loop limit exceeded',
  ],
});
