'use client';

import { useEffect } from 'react';

const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? 'dev';

/**
 * Renders a small build-time stamp in the footer and logs it to the console
 * on mount. Lets anyone verify a fresh deployment loaded by checking either
 * the UI or DevTools — useful after service-worker cache invalidation.
 *
 * suppressHydrationWarning is set because in dev mode the server and client
 * bundles evaluate next.config.js at different times, producing different
 * BUILD_TIME values. Both always render a span (same structure), so React
 * accepts the value mismatch silently. In production both bundles build
 * together and the timestamps always match.
 */
export function BuildStamp() {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(`[Story Magic] Build: ${BUILD_TIME}`);
  }, []);

  // Format "2026-05-27T15:10:30.000Z" → "2026-05-27 15:10 UTC"
  const label =
    BUILD_TIME === 'dev'
      ? 'dev build'
      : BUILD_TIME.replace('T', ' ').slice(0, 16) + ' UTC';

  return (
    // eslint-disable-next-line react/no-danger-with-children
    <span
      className="text-[10px] text-muted-foreground/40 select-none"
      title={BUILD_TIME}
      suppressHydrationWarning
    >
      {label}
    </span>
  );
}
