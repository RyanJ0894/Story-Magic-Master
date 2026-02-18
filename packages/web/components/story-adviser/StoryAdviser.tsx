'use client';

/**
 * StoryAdviser Component
 *
 * Main entry point for the suggestion system.
 * Handles fetching, generating, and managing suggestions.
 */

import { useState, useEffect, useCallback } from 'react';
import { log } from '@/lib/logger';
import { apiFetch } from '@/lib/api/fetch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  Lightbulb,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { SuggestionPanel } from './SuggestionPanel';
import { RewriteModal } from './RewriteModal';
import { Suggestion } from '@/lib/adviser/types';

// =============================================================================
// Props
// =============================================================================

interface StoryAdviserProps {
  projectId: string;
  scriptText: string;
  onNavigate?: (startLine: number, endLine: number) => void;
}

// =============================================================================
// Component
// =============================================================================

export function StoryAdviser({
  projectId,
  scriptText,
  onNavigate,
}: StoryAdviserProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    dismissed: number;
    critical: number;
    important: number;
    minor: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rewriteSuggestion, setRewriteSuggestion] = useState<Suggestion | null>(null);
  const [isRewriteModalOpen, setIsRewriteModalOpen] = useState(false);

  // Fetch existing suggestions
  const fetchSuggestions = useCallback(async () => {
    setIsFetching(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/projects/${projectId}/suggestions`);
      if (!response.ok) {
        if (response.status === 403) {
          // Feature not enabled
          setSuggestions([]);
          setStats(null);
          return;
        }
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setStats(data.stats || null);
    } catch (err) {
      log.error('Failed to fetch suggestions', err);
      setError(err instanceof Error ? err.message : 'Failed to load suggestions');
    } finally {
      setIsFetching(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Generate new suggestions
  const generateSuggestions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/projects/${projectId}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSuggestions: 15 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle suggestion actions
  const handleAccept = async (id: string) => {
    try {
      const response = await apiFetch(`/api/suggestions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      });

      if (!response.ok) throw new Error('Failed to accept suggestion');

      const data = await response.json();
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? data.suggestion : s))
      );
      // Refresh stats
      fetchSuggestions();
    } catch (err) {
      log.error('Failed to accept suggestion', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await apiFetch(`/api/suggestions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });

      if (!response.ok) throw new Error('Failed to reject suggestion');

      const data = await response.json();
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? data.suggestion : s))
      );
      fetchSuggestions();
    } catch (err) {
      log.error('Failed to reject suggestion', err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const response = await apiFetch(`/api/suggestions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      });

      if (!response.ok) throw new Error('Failed to dismiss suggestion');

      const data = await response.json();
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? data.suggestion : s))
      );
      fetchSuggestions();
    } catch (err) {
      log.error('Failed to dismiss suggestion', err);
    }
  };

  const handleRewrite = (id: string) => {
    const suggestion = suggestions.find((s) => s.id === id);
    if (suggestion) {
      setRewriteSuggestion(suggestion);
      setIsRewriteModalOpen(true);
    }
  };

  const handleSelectRewrite = async (rewriteId: string) => {
    try {
      const response = await apiFetch(`/api/suggestions/${rewriteSuggestion?.id}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewriteId }),
      });

      if (!response.ok) throw new Error('Failed to select rewrite');

      // Refresh suggestions to update state
      await fetchSuggestions();
    } catch (err) {
      log.error('Failed to select rewrite', err);
      throw err;
    }
  };

  // Loading skeleton
  if (isFetching) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </CardContent>
      </Card>
    );
  }

  // No suggestions yet - show generate button
  if (suggestions.length === 0 && !error) {
    return (
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
              Story-Adviser analyzes your script and provides specific, actionable
              suggestions across dialogue, structure, character, and craft.
            </p>
            <Button onClick={generateSuggestions} disabled={isLoading} size="lg">
              {isLoading ? (
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
              Analysis takes 30-60 seconds depending on script length
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Story-Adviser
              <Badge variant="secondary" className="ml-2">Beta</Badge>
            </CardTitle>
            <CardDescription>
              {stats?.total || 0} suggestions across {stats?.pending || 0} pending
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generateSuggestions}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Regenerate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-start gap-2 text-red-600 dark:text-red-400 mb-4 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <SuggestionPanel
          suggestions={suggestions}
          stats={stats || undefined}
          onAccept={handleAccept}
          onReject={handleReject}
          onDismiss={handleDismiss}
          onRewrite={handleRewrite}
          onNavigate={onNavigate}
          isLoading={isLoading}
        />
      </CardContent>

      {/* Rewrite Modal */}
      <RewriteModal
        suggestion={rewriteSuggestion}
        isOpen={isRewriteModalOpen}
        onClose={() => {
          setIsRewriteModalOpen(false);
          setRewriteSuggestion(null);
        }}
        onSelectRewrite={handleSelectRewrite}
      />
    </Card>
  );
}

export default StoryAdviser;
