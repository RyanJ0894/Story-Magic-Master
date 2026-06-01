const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // eval-source-map (Next.js default) routes eval() through the browser's
  // Trusted Types API via webpack's __webpack_require__.ts helper. Some
  // Chromium builds enforce Trusted Types independently of CSP, causing
  // "Invalid or unexpected token" SyntaxErrors at the eval() call site.
  // cheap-module-source-map avoids eval() entirely while still giving
  // accurate dev-mode source maps.
  ...(process.env.NODE_ENV === 'development' && { devtool: 'cheap-module-source-map' }),
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
