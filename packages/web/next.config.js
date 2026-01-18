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
