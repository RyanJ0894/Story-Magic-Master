'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe absolute date/time display.
 *
 * Companion to <TimeAgo>: same hazard, different shape. A server
 * component calling `new Date(iso).toLocaleDateString()` produces
 * different output for users in different timezones / locales than
 * the client's first render, which triggers a React 19 hydration
 * mismatch — same parentNode-null failure mode that STORY-MAGIC-1F
 * surfaced on the enterprise dashboard.
 *
 * Approach:
 *   - Server render + first client render: emit a stable empty string
 *     (suppressHydrationWarning short-circuits React's match check on
 *     this specific node).
 *   - After mount: format the date with the browser's locale and
 *     timezone — which is what the user actually wants to see anyway.
 *   - The absolute ISO is always on `dateTime` + `title` so assistive
 *     tech and search engines can read it pre-hydration.
 *
 * Usage:
 *   <DateTime iso={log.createdAt.toISOString()} mode="date" />
 *   <DateTime iso={log.createdAt.toISOString()} mode="time" />
 *   <DateTime iso={log.createdAt.toISOString()} mode="datetime" />
 *
 * If a more exotic format is needed (e.g. custom options), pass them
 * via the `options` prop — they're forwarded to Intl.DateTimeFormat.
 */

type Mode = 'date' | 'time' | 'datetime';

export interface DateTimeProps {
  iso: string;
  mode?: Mode;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
}

function format(iso: string, mode: Mode, options?: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // Use the user's locale (undefined → browser default) and timezone —
  // this code only runs in the browser, so it's correct.
  if (options) return new Intl.DateTimeFormat(undefined, options).format(d);
  if (mode === 'date') return d.toLocaleDateString();
  if (mode === 'time') return d.toLocaleTimeString();
  return d.toLocaleString();
}

export function DateTime({ iso, mode = 'datetime', options, className }: DateTimeProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const display = mounted ? format(iso, mode, options) : '';

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning title={iso}>
      {display}
    </time>
  );
}
