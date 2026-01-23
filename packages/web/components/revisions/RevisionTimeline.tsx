'use client';

/**
 * RevisionTimeline Component
 *
 * Displays the history of script revisions with score trajectory.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  History,
  GitBranch,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  FileText,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { RevisionTimeline as RevisionTimelineType, RevisionTimelineEntry } from '@/lib/revisions/types';

// =============================================================================
// Props
// =============================================================================

interface RevisionTimelineProps {
  projectId: string;
  onSelectRevision?: (revisionId: string) => void;
  onCompare?: (fromId: string, toId: string) => void;
}

// =============================================================================
// Component
// =============================================================================

export function RevisionTimeline({
  projectId,
  onSelectRevision,
  onCompare,
}: RevisionTimelineProps) {
  const [timeline, setTimeline] = useState<RevisionTimelineType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/revisions?timeline=true`);
      if (!response.ok) {
        if (response.status === 403) {
          setTimeline(null);
          return;
        }
        throw new Error('Failed to fetch timeline');
      }

      const data = await response.json();
      setTimeline(data.timeline);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
      setError(err instanceof Error ? err.message : 'Failed to load revisions');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const handleCompareClick = (revisionId: string) => {
    if (!selectedForCompare) {
      setSelectedForCompare(revisionId);
    } else if (selectedForCompare === revisionId) {
      setSelectedForCompare(null);
    } else {
      onCompare?.(selectedForCompare, revisionId);
      setSelectedForCompare(null);
    }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            Revision History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No revisions yet
  if (!timeline || timeline.revisions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            Revision History
          </CardTitle>
          <CardDescription>Track changes to your script over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <GitBranch className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No Revisions Yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Revisions are created automatically when you edit your script.
              Each revision tracks changes and score improvements.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = () => {
    if (!timeline.scoreTrajectory) return null;
    switch (timeline.scoreTrajectory.trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-violet-500" />
              Revision History
              <Badge variant="secondary" className="ml-2">
                {timeline.totalRevisions} version{timeline.totalRevisions !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              {timeline.scoreTrajectory && (
                <>
                  {getTrendIcon()}
                  <span>
                    {timeline.scoreTrajectory.trend === 'improving'
                      ? 'Score improving'
                      : timeline.scoreTrajectory.trend === 'declining'
                      ? 'Score declining'
                      : 'Score stable'}
                    {timeline.scoreTrajectory.averageImprovement !== undefined && (
                      <span className="text-muted-foreground">
                        {' '}
                        ({timeline.scoreTrajectory.averageImprovement > 0 ? '+' : ''}
                        {timeline.scoreTrajectory.averageImprovement.toFixed(1)} avg per revision)
                      </span>
                    )}
                  </span>
                </>
              )}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchTimeline}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Compare mode indicator */}
        {selectedForCompare && (
          <div className="mt-3 p-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg text-sm">
            <span className="text-violet-700 dark:text-violet-300">
              Select another revision to compare
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-6 text-xs"
              onClick={() => setSelectedForCompare(null)}
            >
              Cancel
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {timeline.revisions.map((revision, index) => (
              <RevisionEntry
                key={revision.id}
                revision={revision}
                isLatest={index === 0}
                isSelected={selectedForCompare === revision.id}
                onSelect={() => onSelectRevision?.(revision.id)}
                onCompare={() => handleCompareClick(revision.id)}
                showCompare={!!onCompare}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// RevisionEntry Sub-component
// =============================================================================

interface RevisionEntryProps {
  revision: RevisionTimelineEntry;
  isLatest: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onCompare: () => void;
  showCompare: boolean;
}

function RevisionEntry({
  revision,
  isLatest,
  isSelected,
  onSelect,
  onCompare,
  showCompare,
}: RevisionEntryProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`
        relative pl-6 pb-3 border-l-2 last:border-l-transparent
        ${isSelected ? 'border-l-violet-500' : 'border-l-slate-200 dark:border-l-slate-700'}
      `}
    >
      {/* Timeline dot */}
      <div
        className={`
          absolute left-[-5px] top-0 w-2 h-2 rounded-full
          ${isLatest ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-600'}
          ${isSelected ? 'ring-2 ring-violet-500 ring-offset-2' : ''}
        `}
      />

      <div
        className={`
          p-3 rounded-lg border transition-colors cursor-pointer
          ${isSelected
            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }
        `}
        onClick={onSelect}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">
                v{revision.versionNumber}
              </span>
              {isLatest && (
                <Badge variant="default" className="text-xs">
                  Latest
                </Badge>
              )}
              {revision.label && (
                <span className="text-sm text-muted-foreground truncate">
                  {revision.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {revision.pageCount} page{revision.pageCount !== 1 ? 's' : ''}
              </span>
              <span>{formatDate(revision.createdAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Score badge */}
            {revision.overallScore !== undefined && (
              <Badge
                variant="outline"
                className={
                  revision.overallScore >= 80
                    ? 'border-green-500 text-green-700 dark:text-green-400'
                    : revision.overallScore >= 60
                    ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                    : 'border-red-500 text-red-700 dark:text-red-400'
                }
              >
                {revision.overallScore}
              </Badge>
            )}

            {/* Compare button */}
            {showCompare && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onCompare();
                }}
              >
                <ArrowRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Changes summary */}
        {revision.changesSummary && (
          <div className="flex items-center gap-2 mt-2 text-xs">
            {revision.changesSummary.linesAdded > 0 && (
              <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                <Plus className="w-3 h-3" />
                {revision.changesSummary.linesAdded}
              </span>
            )}
            {revision.changesSummary.linesRemoved > 0 && (
              <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
                <Minus className="w-3 h-3" />
                {revision.changesSummary.linesRemoved}
              </span>
            )}
            {revision.changesSummary.scoreChange !== undefined && revision.changesSummary.scoreChange !== 0 && (
              <span
                className={
                  revision.changesSummary.scoreChange > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }
              >
                Score {revision.changesSummary.scoreChange > 0 ? '+' : ''}
                {revision.changesSummary.scoreChange.toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RevisionTimeline;
