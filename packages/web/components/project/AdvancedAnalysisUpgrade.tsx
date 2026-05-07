'use client';

/**
 * AdvancedAnalysisUpgrade
 *
 * Shows a purchase card for the Advanced Analysis one-time upgrade ($9.99),
 * or a "purchased" badge when the upgrade is already active for this project.
 *
 * Security note: this component NEVER sends model names to the server.
 * Model selection happens entirely inside the orchestrator based on a DB lookup.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';

interface AdvancedAnalysisUpgradeProps {
  projectId: string;
  purchased: boolean;
}

export function AdvancedAnalysisUpgrade({ projectId, purchased: initialPurchased }: AdvancedAnalysisUpgradeProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (initialPurchased) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 w-fit">
        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
        <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
          Advanced Analysis — Claude Opus
        </span>
      </div>
    );
  }

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/advanced-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to start checkout');
      }

      const data = (await response.json()) as { url?: string; purchased?: boolean; alreadyOwned?: boolean };

      if (data.alreadyOwned) {
        // Already purchased — reload the page to reflect the state
        window.location.reload();
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error('No checkout URL returned');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <Card className="border-purple-200 dark:border-purple-800/60 bg-gradient-to-br from-purple-50/50 to-background dark:from-purple-950/20 dark:to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-purple-800 dark:text-purple-200">
          <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
          Advanced Analysis
          <Badge
            variant="outline"
            className="ml-auto text-xs font-semibold border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
          >
            $9.99 one-time
          </Badge>
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm leading-relaxed">
          Powered by Claude Opus — Anthropic&apos;s most capable model:
          <ul className="mt-2 space-y-1 list-none">
            <li className="flex items-start gap-2"><span className="text-purple-500 mt-0.5">✦</span>Richer character arcs — deeper motivation, subtext, and relationship dynamics</li>
            <li className="flex items-start gap-2"><span className="text-purple-500 mt-0.5">✦</span>Nuanced voice matching — accent, cadence, and tone mapped to character background</li>
            <li className="flex items-start gap-2"><span className="text-purple-500 mt-0.5">✦</span>Scene-level emotion — ambient and music cues tuned to dramatic beats, not just genre</li>
          </ul>
          <span className="block mt-2 text-xs">One-time upgrade for this project only.</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {error && (
          <p className="text-sm text-destructive mb-3" role="alert">
            {error}
          </p>
        )}
        <Button
          onClick={handleUpgrade}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-700 dark:hover:bg-purple-600"
          size="sm"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" aria-hidden="true" />
              Redirecting…
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 mr-2" aria-hidden="true" />
              Upgrade this project
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
