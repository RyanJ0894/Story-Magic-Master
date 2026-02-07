const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  // Required for Sentry instrumentation
  experimental: {
    instrumentationHook: true,
    // Limit server actions payload size
    serverActionsBodySizeLimit: '4mb',
  },
  // API route body size limit (default is 1mb, we allow 10mb for script uploads)
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '50mb', // For audio file responses
  },
  // Security headers (CSP is handled in middleware.ts to avoid duplicate headers)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  org: 'servicevision',
  project: 'story-magic-web',

  // Suppress source map upload logs
  silent: !process.env.CI,

  // Upload source maps for better stack traces
  widenClientFileUpload: true,

  // Hide source maps from clients
  hideSourceMaps: true,

  // Disable tunneling (use direct Sentry connection)
  tunnelRoute: undefined,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,

  // Enable automatic instrumentation
  automaticVercelMonitors: true,
});
