'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe relative-time display.
 *
 * Fixes STORY-MAGIC-1F: a server component rendering `Date.now() - X` in
 * the activity log produced a string ("5m ago") on the server that
 * disagreed with the client's value seconds later when hydration ran.
 * React 19 then tried to repair the mismatch and read `parentNode` on
 * a node it had already reconciled away → uncaught TypeError.
 *
 * Approach:
 *   - On the server (and the very first client render), display the
 *     absolute timestamp's title attribute but render a stable, locale-
 *     agnostic placeholder text. `suppressHydrationWarning` short-circuits
 *     React's mismatch check on this specific node.
 *   - After mount, swap in the actual relative-time string and keep it
 *     fresh with a once-a-minute interval — the legacy implementation
 *     never updated as the page sat open, so '5m ago' stayed '5m ago'
 *     forever.
 *
 * Use the same way the inline helper was used:
 *
 *   <TimeAgo iso={log.createdAt.toISOString()} />
 *
 * If a Date is in scope, call `.toISOString()` at the call site (server
 * components frequently have Prisma Dates; client components rarely do).
 */
export interface TimeAgoProps {
  iso: string;
  /** Optional class for the rendered <time> tag. */
  className?: string;
}

function formatRelative(ms: number): string {
  if (ms < 0) ms = 0;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function TimeAgo({ iso, className }: TimeAgoProps) {
  const [now, setNow] = useState<number | null>(null);

  // First mount: snap a real `now` and start the per-minute refresher.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const epoch = Date.parse(iso);
  // Server render + first client render: deliberately render NOTHING
  // (or a space) for the human-readable text. suppressHydrationWarning
  // tells React this asymmetry is intentional so it does not try to
  // patch the DOM. The exact ISO is on `dateTime` so the underlying
  // <time> element still works for assistive tech and search engines.
  const display = now === null ? '' : formatRelative(now - epoch);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning title={iso}>
      {display}
    </time>
  );
}
