const { withSentryConfig } = require('@sentry/nextjs');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // eval-source-map (Next.js default) routes eval() through the browser's
  // Trusted Types API via webpack's __webpack_require__.ts helper. Some
  // Chromium builds enforce Trusted Types independently of CSP, causing
  // "Invalid or unexpected token" SyntaxErrors at the eval() call site.
  // cheap-module-source-map avoids eval() entirely while still giving
  // accurate dev-mode source maps.
  ...(isDev && { devtool: 'cheap-module-source-map' }),
  // Bake the build timestamp into the client bundle so each deploy is
  // identifiable in the footer and in the browser console.
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  // Treat workspace packages as source so webpack tracks their dependency
  // graph precisely, avoiding cascade HMR invalidations in dev.
  transpilePackages: ['@story-magic/shared'],
  experimental: {
    // Allow file uploads up to 10MB via /api/projects/upload
    serverActions: { bodySizeLimit: '10mb' },
    // Pre-bundle heavy icon/UI packages into fewer chunks so HMR only
    // invalidates the modules that actually changed.
    optimizePackageImports: [
      '@radix-ui/react-tabs',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      'lucide-react',
    ],
    // 2026-06-25: Next 15+ webpack memory-optimization knob. Reduces peak
    // build memory at the cost of slightly slower compilation. Official
    // Next.js docs label this "low-risk" (still experimental flag only
    // because it's recent). Adding to clear the 2 GB ceiling on Render
    // Standard before considering a plan upgrade.
    // https://nextjs.org/docs/app/guides/memory-usage
    webpackMemoryOptimizations: true,
    // 2026-06-25 (PR #420): run webpack compilation in a separate Node.js
    // worker so peak memory is bounded by the worker's heap, not the main
    // process's. Next 14.1+ enables this automatically when there's NO
    // custom webpack config; we have one (config.ignoreWarnings + dev
    // watchOptions) so we have to opt in explicitly. The custom config is
    // minimal — small ignoreWarnings array + dev-only watchOptions — and
    // doesn't depend on any inter-pass shared state, so worker isolation
    // should be safe. If Sentry's webpack plugin clashes the build will
    // fail with a clear error and we can flip this back to false.
    // Community reports ~15-30% peak memory reduction.
    webpackBuildWorker: true,
    // Also disable server-side source maps. Sentry already disables CLIENT
    // source map upload via hideSourceMaps + disableSourceMapUpload (see
    // sentryConfig below), but the SSR pass can still emit them by default.
    // Skipping them shaves another chunk of memory during the server build.
    serverSourceMaps: false,
  },
  // Skip browser source maps in production builds. Same rationale as
  // serverSourceMaps above — Sentry's already configured not to upload them,
  // and we save peak build memory by not generating them at all.
  productionBrowserSourceMaps: false,
  // pdf-parse uses Node.js fs internals and must not be bundled by webpack —
  // when bundled it tries to open its test fixture file at runtime and crashes.
  //
  // rate-limiter-flexible uses dynamic require() to load optional backend
  // drivers (Drizzle, MongoDB, Memcached, etc.) it'll never actually
  // instantiate. Webpack can't statically follow the dynamic require, so it
  // emits "Critical dependency: the request of a dependency is an expression"
  // warnings — benign at runtime, but they obscure real build issues. Letting
  // Node resolve at runtime silences the warning and slightly shrinks the
  // serverless bundle.
  //
  // ioredis has similar dynamic-require patterns for its cluster/sentinel
  // resolvers; the same logic applies.
  serverExternalPackages: ['pdf-parse', 'rate-limiter-flexible', 'ioredis'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'eleven-public-cdn.elevenlabs.io',
      },
    ],
  },
  // Exclude the shared Prisma-generated directory from webpack's file watcher.
  // Both Next.js and the orchestrator's tsx watch import @story-magic/shared,
  // and the Prisma library engine binary loading can fire inotify events on
  // packages/shared/src/generated/ that Next.js misreads as file modifications,
  // causing spurious HMR recompilation and server action ID churn.
  webpack: (config, { dev }) => {
    // require-in-the-middle (pulled in by @opentelemetry/instrumentation via @sentry/node)
    // uses dynamic require() that webpack cannot statically analyze. The warning is a
    // false positive — the package works correctly at runtime. Suppress it here because
    // instrumentation.ts has a top-level @sentry/nextjs import that pulls the whole
    // chain into the bundle before serverExternalPackages can intercept it.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /require-in-the-middle/ },
    ];

    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : []),
          // Absolute-path glob so watchpack reliably excludes the Prisma engine
          // binary — relative globs can silently fail to match absolute inotify paths.
          `${path.resolve(__dirname, '../shared/src/generated')}/**`,
        ],
      };
    }
    return config;
  },
  // Reduce build memory usage on constrained environments
  productionBrowserSourceMaps: false,
  // ESLint runs in CI — skip during next build (avoids devDep missing in production)
  eslint: { ignoreDuringBuilds: true },
  // 2026-06-25: skip typecheck during `next build` to shave memory pressure
  // on Render's 2 GB Standard plan (OOM at ~1.85 GB on commits 1899ea8,
  // 5c7564f, bbd3995, d73098e). Typecheck runs separately in CI via
  // `pnpm --filter @story-magic/web typecheck`, so we're not skipping the
  // safety net — just deduping it out of the build path. Typical savings:
  // ~150-300 MB during the SSR compile pass.
  typescript: { ignoreBuildErrors: true },
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

const sentryConfig = {
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
};

// Sentry's webpack plugin patches __webpack_require__ with interceptors that
// assume factory references are stable. During HMR in dev, factories are
// briefly undefined while modules reload, triggering:
//   TypeError: Cannot read properties of undefined (reading 'call')
// Skipping the plugin in dev avoids this entirely — Sentry still initialises
// at runtime via sentry.client.config.ts; only source-map upload is skipped,
// which is not needed locally anyway.
module.exports = isDev ? nextConfig : withSentryConfig(nextConfig, sentryConfig);
