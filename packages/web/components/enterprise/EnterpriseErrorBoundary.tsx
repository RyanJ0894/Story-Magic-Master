'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches React 19.2.0-canary navigation reconciliation errors that appear as
 * "Rendered more/fewer hooks than during the previous render" during App Router
 * transitions between server-component pages and client-component pages.
 *
 * These are not application bugs — they are a known React 19 canary quirk where
 * the reconciler miscounts hooks during certain navigation sequences. The boundary
 * contains the crash and offers a one-click reload rather than a blank screen.
 *
 * Applied to: gated enterprise pages (dashboard, team) that transition to/from
 * the non-gated /enterprise/contact server page.
 *
 * Tracked: STORY-MAGIC-11, STORY-MAGIC-18 (Sentry) — GitHub issue #154
 */
export class EnterpriseErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 text-center px-4">
          <p className="text-muted-foreground text-sm">
            Something went wrong loading this page.
          </p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
