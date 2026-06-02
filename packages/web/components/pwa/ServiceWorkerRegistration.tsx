'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Skip registration in Playwright / automated test contexts (prevents
    // hydration errors in Sentry STORY-MAGIC-6 from test-triggered SW blocks).
    if ('serviceWorker' in navigator && !navigator.webdriver) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.error('SW registration failed:', err));
    }
  }, []);

  return null;
}
