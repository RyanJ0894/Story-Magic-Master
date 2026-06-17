'use client';

import { useEffect, useRef, useState } from 'react';
import { log } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

/**
 * #322 (2026-06-17): when the dashboard render throws, auto-refresh ONCE
 * before showing the human-facing error. Ryan's pattern was: blank page
 * with "Something went wrong" → manual refresh → works. That manual
 * refresh papered over a transient Clerk session-cookie hydration race.
 * Now the error boundary does the refresh automatically.
 *
 * Guard against an infinite refresh loop with sessionStorage. If the
 * second attempt also fails, fall through to the regular error UI so
 * the user isn't trapped in a reload cycle on a persistent issue.
 */
const REFRESH_KEY = 'dashboard-error-refreshed';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [autoRefreshing, setAutoRefreshing] = useState(true);
  const triedRef = useRef(false);

  useEffect(() => {
    log.error('Dashboard error', error);
    if (triedRef.current) return;
    triedRef.current = true;

    // Only auto-refresh on the FIRST error in this session. The flag is
    // session-scoped so closing the tab + reopening allows a fresh retry.
    const alreadyRefreshed = sessionStorage.getItem(REFRESH_KEY);
    if (alreadyRefreshed) {
      setAutoRefreshing(false);
      return;
    }

    sessionStorage.setItem(REFRESH_KEY, '1');
    // Short delay so the log call ships before the navigation, and the
    // user sees the loading state for ~300ms instead of an abrupt flash
    // that would look like nothing happened.
    const t = setTimeout(() => {
      reset();
    }, 300);
    return () => clearTimeout(t);
  }, [error, reset]);

  if (autoRefreshing) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <p className="text-muted-foreground">
          We couldn&apos;t load your dashboard. This might be a temporary issue.
        </p>
        <Button
          onClick={() => {
            // Clear the refresh guard so the user can try the auto-refresh
            // path again if they're hitting a different error now.
            sessionStorage.removeItem(REFRESH_KEY);
            reset();
          }}
          variant="default"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
