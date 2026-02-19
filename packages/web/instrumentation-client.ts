import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Don't send errors in development by default
  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLED === 'true',

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

  // Add user context
  beforeSend(event) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV !== 'production' && process.env.SENTRY_ENABLED !== 'true') {
      return null;
    }
    return event;
  },
});
