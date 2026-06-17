'use client';

import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';

const DISMISS_KEY = 'pwa-install-dismissed';
// UX-I-05 — dismiss TTL. The prior "set to '1' forever" meant a single
// not-now click suppressed the install prompt across the entire user
// lifetime, including on returning power-users for whom installing later
// would have been valuable. 30 days matches the typical browser-native
// re-prompt cadence.
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function isDismissActive(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  // Legacy values (the literal '1' we used to store) parse to NaN — treat
  // those as already-expired so existing dismissals re-prompt after deploy.
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_TTL_MS;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if the user dismissed within the TTL window.
    if (isDismissActive()) return;

    // A-010 (2026-06-15): only preventDefault on the FIRST firing of
    // beforeinstallprompt. The browser refires this event on most page
    // navigations / focus events; calling preventDefault every time without
    // a subsequent prompt() call floods devtools with
    // "Banner not shown: beforeinstallpromptevent.preventDefault() called"
    // warnings (Ryan's 2026-06-15 console capture had ~20 of these). Once
    // we've captured the event the first time, ignore re-firings.
    let captured = false;

    const handler = (e: Event) => {
      if (captured) return; // ignore re-fires; no preventDefault → no warning
      captured = true;
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    // Store a timestamp so isDismissActive() can age it out after TTL.
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="banner"
      aria-label="Install Story Magic app"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 rounded-xl border border-border bg-card shadow-lg p-4 flex items-start gap-3"
      data-testid="pwa-install-prompt"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">Add Story Magic to your home screen</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Listen and review offline, anytime.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstall}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          data-testid="pwa-install-button"
        >
          <Download className="h-3 w-3" />
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss install prompt"
          data-testid="pwa-dismiss-button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
