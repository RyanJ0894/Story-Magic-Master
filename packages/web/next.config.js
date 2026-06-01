const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bake the build timestamp into the client bundle so each deploy is
  // identifiable in the footer and in the browser console.
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  experimental: {
    // Allow file uploads up to 10MB via /api/projects/upload
    serverActions: { bodySizeLimit: '10mb' },
  },
  // pdf-parse uses Node.js fs internals and must not be bundled by webpack —
  // when bundled it tries to open its test fixture file at runtime and crashes.
  serverExternalPackages: ['pdf-parse'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  // Exclude the shared Prisma-generated directory from webpack's file watcher.
  // Both Next.js and the orchestrator's tsx watch import @story-magic/shared,
  // and the Prisma library engine binary loading can fire inotify events on
  // packages/shared/src/generated/ that Next.js misreads as file modifications,
  // causing spurious HMR recompilation and server action ID churn.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : []),
          '**/packages/shared/src/generated/**',
        ],
      };
    }
    return config;
  },
  // Reduce build memory usage on constrained environments
  productionBrowserSourceMaps: false,
  // ESLint runs in CI — skip during next build (avoids devDep missing in production)
  eslint: { ignoreDuringBuilds: true },
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

  // Standard client bundle upload (not widened — saves build memory)
  widenClientFileUpload: false,

  // Hide source maps from clients and skip upload to save build memory
  hideSourceMaps: true,
  disableSourceMapUpload: true,

  // Disable tunneling (use direct Sentry connection)
  tunnelRoute: undefined,

  // Tree-shake Sentry logger statements
  webpack: {
    removeDebugLogging: true,
  },
});
