'use client';

import { SignIn, useClerk } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

/**
 * Wraps <SignIn> with a timeout-based fallback.
 *
 * Clerk's production instance is bound to app.storymagicapp.net.
 * When accessed from any other domain (e.g. story-magic-web.onrender.com),
 * the <SignIn> component silently fails because the domain isn't registered
 * as a satellite domain in the Clerk dashboard. This wrapper detects that
 * state and shows a clear error after 10 seconds.
 *
 * Fix in Clerk dashboard: Settings → Domains → Add satellite domain, OR
 * switch Render env vars to the test-key instance which allows any domain.
 */
export default function ClerkSignIn({ fallbackRedirectUrl }: { fallbackRedirectUrl: string }) {
  const { loaded } = useClerk();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loaded) setTimedOut(true);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [loaded]);

  if (timedOut) {
    return (
      <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-xl text-center space-y-4">
        <p className="text-muted-foreground text-sm">
          Authentication could not load on this URL.
        </p>
        <p className="text-sm">
          Please sign in at the official app address:
        </p>
        <a
          href={`https://app.storymagicapp.net/login`}
          className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Go to app.storymagicapp.net
        </a>
      </div>
    );
  }

  return (
    <SignIn
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'shadow-xl',
        },
      }}
      fallbackRedirectUrl={fallbackRedirectUrl}
    />
  );
}
