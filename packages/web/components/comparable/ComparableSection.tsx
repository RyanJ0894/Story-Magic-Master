'use client';

/**
 * ComparableSection Component
 *
 * Displays similar scripts from the corpus for comparison.
 * Gated by COMPARABLE_SCRIPTS feature flag.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api/fetch';
import { FeatureGate } from '@/lib/features';
import { ComparableScript } from '@/lib/comparable/types';
import { ComparableCard } from './ComparableCard';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Film,
  Loader2,
  AlertCircle,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Props
// =============================================================================

interface ComparableSectionProps {
  projectId: string;
  hasScore: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function ComparableSection({ projectId, hasScore }: ComparableSectionProps) {
  const [comparables, setComparables] = useState<ComparableScript[]>([]);
  const [queryLogline, setQueryLogline] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [genreFilter, setGenreFilter] = useState<string>('all');

  // Available genres (extracted from comparables)
  const availableGenres = Array.from(
    new Set(comparables.flatMap((c) => c.genre))
  ).sort();

  const fetchComparables = async () => {
    if (!hasScore) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (genreFilter !== 'all') params.set('genre', genreFilter);

      const response = await apiFetch(
        `/api/projects/${projectId}/comparables?${params.toString()}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch comparables');
      }

      const data = await response.json();
      setComparables(data.comparables);
      setQueryLogline(data.queryLogline);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparables');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount if we have a score
  useEffect(() => {
    if (hasScore && isExpanded) {
      fetchComparables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasScore, isExpanded, statusFilter, genreFilter]);

  return (
    <FeatureGate feature="COMPARABLE_SCRIPTS">
      <div className="border rounded-lg bg-card">
        {/* Header - Always Visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Comparable Scripts</h3>
            {comparables.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {comparables.length} found
              </span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {/* Content - Expandable */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t">
            {/* No Score State */}
            {!hasScore && (
              <div className="py-8 text-center text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Generate a StoryScore first to find comparable scripts.</p>
              </div>
            )}

            {/* Loading State */}
            {hasScore && isLoading && (
              <div className="py-8 text-center text-muted-foreground">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                <p>Searching corpus for similar scripts...</p>
              </div>
            )}

            {/* Error State */}
            {hasScore && error && (
              <div className="py-6 text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchComparables}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            )}

            {/* Results */}
            {hasScore && !isLoading && !error && (
              <>
                {/* Query Info */}
                {queryLogline && (
                  <div className="my-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">
                      Searching based on:
                    </p>
                    <p className="text-sm italic line-clamp-2">{queryLogline}</p>
                  </div>
                )}

                {/* Filters */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(showFilters && 'bg-muted')}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchComparables}
                    disabled={isLoading}
                  >
                    <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                  </Button>
                </div>

                {showFilters && (
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Status
                      </label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="produced">Produced</SelectItem>
                          <SelectItem value="sold">Sold</SelectItem>
                          <SelectItem value="optioned">Optioned</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Genre
                      </label>
                      <Select value={genreFilter} onValueChange={setGenreFilter}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Genres</SelectItem>
                          {availableGenres.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Comparables List */}
                {comparables.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground">
                    <p>No comparable scripts found in the corpus.</p>
                    <p className="text-xs mt-1">
                      Try adjusting filters or the corpus may need more data.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comparables.map((script, index) => (
                      <ComparableCard
                        key={script.id}
                        script={script}
                        rank={index + 1}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </FeatureGate>
  );
}

export default ComparableSection;
