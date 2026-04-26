'use client';

/**
 * AdvancedAnalysisSuccessBanner
 *
 * Shown on the project page when `?advanced=success` is in the URL
 * (i.e., the user just completed the Stripe checkout for Advanced Analysis).
 *
 * Renders a dismissable success toast / banner and removes the query param
 * from the URL without a full page reload.
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, X } from 'lucide-react';

export function AdvancedAnalysisSuccessBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get('advanced') === 'success') {
      setVisible(true);
      // Strip the query param without a navigation push
      const url = new URL(window.location.href);
      url.searchParams.delete('advanced');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm text-green-800 dark:text-green-200"
    >
      <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
      <span className="flex-1 font-medium">
        Advanced Analysis activated! Your next generation will use Claude Opus for Passes 1 and 3.
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setVisible(false)}
        className="ml-auto p-0.5 rounded hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
