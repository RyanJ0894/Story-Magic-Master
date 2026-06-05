'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

/**
 * Error boundary for all routes under /enterprise/*.
 *
 * Catches React 19.2.0-canary hooks reconciliation errors that appear when
 * navigating between client-component pages and the server-component
 * /enterprise/contact page. The error is non-deterministic and not caused
 * by application logic — this boundary prevents blank screens.
 *
 * Tracked: STORY-MAGIC-11, STORY-MAGIC-18 (Sentry) — GitHub issue #154
 */
export default function EnterpriseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-muted-foreground text-sm">
        Something went wrong loading this page.
      </p>
      <Button variant="outline" size="sm" onClick={reset}>
        Reload
      </Button>
    </div>
  );
}
