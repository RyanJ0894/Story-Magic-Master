'use client';

/**
 * AdviserWizard Component
 *
 * 4-step wizard for the Story-Adviser flow:
 *   Step 1 — Generate: Trigger AI suggestion analysis
 *   Step 2 — Review:   Browse and filter suggestions
 *   Step 3 — Respond:  Generate and review rewrites
 *   Step 4 — Apply:    Apply a selected rewrite back to the script
 *
 * This component orchestrates the full flow while reusing:
 *   SuggestionPanel, RewriteModal, SuggestionStats.
 */

import { useState, useEffect, useCallback } from 'react';
import { log } from '@/lib/logger';
import { apiFetch } from '@/lib/api/fetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  Lightbulb,
  Sparkles,
  AlertCircle,
  Check,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { SuggestionPanel } from './SuggestionPanel';
import { SuggestionStats } from './SuggestionStats';
import { RewriteModal } from './RewriteModal';
import { Suggestion } from '@/lib/adviser/types';

// =============================================================================
// Types
// =============================================================================

type WizardStep = 1 | 2 | 3 | 4;

interface StatsData {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  dismissed: number;
  critical: number;
  important: number;
  minor: number;
}

interface AdviserWizardProps {
  projectId: string;
  scriptText: string;
  onScriptUpdated?: (newText: string) => void;
}

// =============================================================================
// Step indicator
// =============================================================================

const STEPS: { num: WizardStep; label: string }[] = [
  { num: 1, label: 'Generate' },
  { num: 2, label: 'Review' },
  { num: 3, label: 'Respond' },
  { num: 4, label: 'Apply' },
];

function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <nav className="flex items-center gap-1" aria-label="Wizard steps">
      {STEPS.map((step, i) => {
        const done = step.num < current;
        const active = step.num === current;
        return (
          <div key={step.num} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                  : done
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'text-muted-foreground'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              {done ? (
                <Check className="w-3 h-3" />
              ) : (
                <span>{step.num}</span>
              )}
              {step.label}
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// =============================================================================
// Component
// =============================================================================

export function AdviserWizard({
  projectId,
  scriptText,
  onScriptUpdated,
}: AdviserWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rewrite modal state
  const [rewriteSuggestion, setRewriteSuggestion] = useState<Suggestion | null>(null);
  const [isRewriteModalOpen, setIsRewriteModalOpen] = useState(false);

  // Apply step state
  const [selectedRewriteText, setSelectedRewriteText] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  // ── Fetch suggestions on mount ──────────────────────────────────────────────

  const fetchSuggestions = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/suggestions`);
      if (!res.ok) {
        if (res.status === 403) {
          setSuggestions([]);
          setStats(null);
          return;
        }
        throw new Error('Failed to fetch suggestions');
      }
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setStats(data.stats || null);
      // Auto-advance to review step if suggestions exist
      if (data.suggestions?.length > 0) setStep(2);
    } catch (err) {
      log.error('AdviserWizard: fetch suggestions', err);
      setError(err instanceof Error ? err.message : 'Failed to load suggestions');
    } finally {
      setIsFetching(false);
    }
  }, [projectId]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  // ── Step 1: Generate ────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSuggestions: 15 }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate suggestions');
      }
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setStats(data.stats || null);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Step 2: Review actions ──────────────────────────────────────────────────

  const patchSuggestion = async (id: string, status: string) => {
    const res = await apiFetch(`/api/projects/${projectId}/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(`Failed to ${status} suggestion`);
    const data = await res.json();
    setSuggestions((prev) => prev.map((s) => (s.id === id ? data.suggestion : s)));
    // Refresh stats
    const statsRes = await apiFetch(`/api/projects/${projectId}/suggestions`);
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      setStats(statsData.stats || null);
    }
  };

  const handleAccept = useCallback((id: string) => patchSuggestion(id, 'accepted'), [projectId]);
  const handleReject = useCallback((id: string) => patchSuggestion(id, 'rejected'), [projectId]);
  const handleDismiss = useCallback((id: string) => patchSuggestion(id, 'dismissed'), [projectId]);

  const handleRewrite = useCallback((id: string) => {
    const s = suggestions.find((s) => s.id === id);
    if (s) {
      setRewriteSuggestion(s);
      setIsRewriteModalOpen(true);
      setStep(3);
    }
  }, [suggestions]);

  const handleSelectRewrite = useCallback(async (rewriteId: string) => {
    if (!rewriteSuggestion) return;
    const res = await apiFetch(
      `/api/projects/${projectId}/suggestions/${rewriteSuggestion.id}/rewrite`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewriteId }),
      }
    );
    if (!res.ok) throw new Error('Failed to select rewrite');

    // Fetch the rewrite text so we can offer "apply to script"
    const rewriteRes = await apiFetch(
      `/api/projects/${projectId}/suggestions/${rewriteSuggestion.id}/rewrite`
    );
    if (rewriteRes.ok) {
      const data = await rewriteRes.json();
      const selected = data.rewrites?.find((r: { id: string; rewrittenText: string }) => r.id === rewriteId);
      if (selected) {
        setSelectedRewriteText(selected.rewrittenText);
        setStep(4);
      }
    }
    await fetchSuggestions();
  }, [rewriteSuggestion, projectId, fetchSuggestions]);

  // ── Step 4: Apply rewrite to script ────────────────────────────────────────

  const handleApplyRewrite = async () => {
    if (!selectedRewriteText || !rewriteSuggestion) return;

    setIsApplying(true);
    setApplyError(null);

    try {
      // Replace the excerpt in scriptText with the selected rewrite
      const excerpt = rewriteSuggestion.location.excerpt || '';
      const newScriptText = excerpt
        ? scriptText.replace(excerpt, selectedRewriteText)
        : scriptText;

      const res = await apiFetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_text: newScriptText }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to apply rewrite');
      }

      setApplied(true);
      onScriptUpdated?.(newScriptText);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to apply rewrite');
    } finally {
      setIsApplying(false);
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (isFetching) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-40" />
        </CardContent>
      </Card>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4" data-testid="adviser-wizard">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        <StepIndicator current={step} />
        {suggestions.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setStep(1); setApplied(false); setSelectedRewriteText(null); }}>
            <RotateCcw className="w-3 h-3 mr-1" />
            Restart
          </Button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* ── Step 1: Generate ── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Story-Adviser
              <Badge variant="secondary" className="ml-2">Beta</Badge>
            </CardTitle>
            <CardDescription>
              AI-powered suggestions to improve your screenplay
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center text-center py-8">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
                <Lightbulb className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Get Personalized Feedback</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-sm">
                Analyze your script and receive specific, actionable suggestions
                across dialogue, structure, character, and craft.
              </p>
              <Button onClick={handleGenerate} disabled={isGenerating} size="lg">
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing Script...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Suggestions
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Analysis takes 30–60 seconds depending on script length
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Review ── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  Review Suggestions
                  <Badge variant="secondary" className="ml-2">Beta</Badge>
                </CardTitle>
                <CardDescription>
                  {stats?.total ?? 0} suggestions — {stats?.pending ?? 0} pending review
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Regenerate
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats && <SuggestionStats stats={stats} />}
            <SuggestionPanel
              suggestions={suggestions}
              stats={stats || undefined}
              onAccept={handleAccept}
              onReject={handleReject}
              onDismiss={handleDismiss}
              onRewrite={handleRewrite}
              isLoading={isGenerating}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Respond — RewriteModal is shown as part of the flow ── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Generate Rewrites
            </CardTitle>
            <CardDescription>
              Choose a rewrite option for the selected suggestion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Review and select a rewrite in the modal, then proceed to apply it to your script.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => setStep(2)}>
              Back to suggestions
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Apply ── */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {applied ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Lightbulb className="w-5 h-5 text-amber-500" />
              )}
              {applied ? 'Rewrite Applied' : 'Apply Rewrite to Script'}
            </CardTitle>
            <CardDescription>
              {applied
                ? 'Your script has been updated with the selected rewrite.'
                : 'Replace the original excerpt in your script with the selected rewrite.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!applied && selectedRewriteText && rewriteSuggestion && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Original</p>
                    <pre className="text-sm whitespace-pre-wrap font-mono bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-3 rounded max-h-40 overflow-y-auto">
                      {rewriteSuggestion.location.excerpt}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Rewrite</p>
                    <pre className="text-sm whitespace-pre-wrap font-mono bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 p-3 rounded max-h-40 overflow-y-auto">
                      {selectedRewriteText}
                    </pre>
                  </div>
                </div>

                {applyError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {applyError}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    Back
                  </Button>
                  <Button onClick={handleApplyRewrite} disabled={isApplying}>
                    {isApplying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Apply to Script
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {applied && (
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <p className="font-medium mb-1">Script updated successfully</p>
                <p className="text-sm text-muted-foreground mb-4">
                  The rewrite has been applied. You can continue reviewing other suggestions.
                </p>
                <Button variant="outline" onClick={() => { setStep(2); setApplied(false); setSelectedRewriteText(null); }}>
                  Continue reviewing
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rewrite modal (triggered from step 2/3) */}
      <RewriteModal
        projectId={projectId}
        suggestion={rewriteSuggestion}
        isOpen={isRewriteModalOpen}
        onClose={() => {
          setIsRewriteModalOpen(false);
          if (step === 3) setStep(2);
        }}
        onSelectRewrite={handleSelectRewrite}
      />
    </div>
  );
}

export default AdviserWizard;
