'use client';

/**
 * DiffView Component
 *
 * Displays line-by-line differences between two revisions.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  X,
  GitCompare,
  Plus,
  Minus,
  Edit3,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertCircle,
  Columns,
  AlignJustify,
} from 'lucide-react';
import {
  DiffLine,
  RevisionComparison,
  ScoreComparison,
  generateDiff,
  calculateChanges,
} from '@/lib/revisions/types';

// =============================================================================
// Props
// =============================================================================

interface DiffViewProps {
  projectId: string;
  fromRevisionId: string;
  toRevisionId: string;
  onClose?: () => void;
}

type ViewMode = 'unified' | 'split';

// =============================================================================
// Component
// =============================================================================

export function DiffView({
  projectId,
  fromRevisionId,
  toRevisionId,
  onClose,
}: DiffViewProps) {
  const [comparison, setComparison] = useState<RevisionComparison | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('unified');

  const fetchComparison = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/revisions/compare?from=${fromRevisionId}&to=${toRevisionId}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch comparison');
      }

      const data = await response.json();
      setComparison(data.comparison);
    } catch (err) {
      console.error('Failed to fetch comparison:', err);
      setError(err instanceof Error ? err.message : 'Failed to load comparison');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, fromRevisionId, toRevisionId]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-slate-500" />
              Compare Revisions
            </CardTitle>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
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

  if (!comparison) return null;

  const { fromRevision, toRevision, changes, diff, scoreComparison } = comparison;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-violet-500" />
              Compare Revisions
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Badge variant="outline">v{fromRevision.versionNumber}</Badge>
              <ArrowRight className="w-4 h-4" />
              <Badge variant="outline">v{toRevision.versionNumber}</Badge>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="unified" className="h-6 px-2">
                  <AlignJustify className="w-3 h-3 mr-1" />
                  Unified
                </TabsTrigger>
                <TabsTrigger value="split" className="h-6 px-2">
                  <Columns className="w-3 h-3 mr-1" />
                  Split
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Stats summary */}
        <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <Plus className="w-4 h-4" />
            {changes.linesAdded} added
          </span>
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <Minus className="w-4 h-4" />
            {changes.linesRemoved} removed
          </span>
          {changes.linesModified > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Edit3 className="w-4 h-4" />
              {changes.linesModified} modified
            </span>
          )}
          {scoreComparison && (
            <span
              className={`flex items-center gap-1 ${
                scoreComparison.change > 0
                  ? 'text-green-600 dark:text-green-400'
                  : scoreComparison.change < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-500'
              }`}
            >
              {scoreComparison.change > 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : scoreComparison.change < 0 ? (
                <TrendingDown className="w-4 h-4" />
              ) : null}
              Score: {scoreComparison.fromScore} → {scoreComparison.toScore}
              {scoreComparison.change !== 0 && (
                <span className="ml-1">
                  ({scoreComparison.change > 0 ? '+' : ''}
                  {scoreComparison.change})
                </span>
              )}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[500px] border rounded-lg">
          {viewMode === 'unified' ? (
            <UnifiedDiffView diff={diff} />
          ) : (
            <SplitDiffView diff={diff} />
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Unified Diff View
// =============================================================================

interface DiffViewChildProps {
  diff: DiffLine[];
}

function UnifiedDiffView({ diff }: DiffViewChildProps) {
  return (
    <div className="font-mono text-sm">
      {diff.map((line, index) => (
        <div
          key={index}
          className={`flex ${getLineBackground(line.type)}`}
        >
          {/* Line numbers */}
          <div className="flex-shrink-0 w-20 flex text-xs text-slate-400 border-r border-slate-200 dark:border-slate-700">
            <span className="w-10 px-1 text-right">
              {line.lineNumber.from || ''}
            </span>
            <span className="w-10 px-1 text-right">
              {line.lineNumber.to || ''}
            </span>
          </div>

          {/* Line content */}
          <div className="flex-1 px-2 py-0.5 whitespace-pre-wrap break-all">
            <span className={`inline-block w-4 ${getLineColor(line.type)}`}>
              {getLinePrefix(line.type)}
            </span>
            {line.type === 'modified' && line.oldContent ? (
              <span>
                <span className="bg-red-200 dark:bg-red-900/40 line-through mr-2">
                  {line.oldContent}
                </span>
                <span className="bg-green-200 dark:bg-green-900/40">
                  {line.content}
                </span>
              </span>
            ) : (
              <span>{line.content}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Split Diff View
// =============================================================================

function SplitDiffView({ diff }: DiffViewChildProps) {
  // Organize diff into left (old) and right (new) columns
  const leftLines: Array<{ line: DiffLine | null; index: number }> = [];
  const rightLines: Array<{ line: DiffLine | null; index: number }> = [];

  diff.forEach((line, index) => {
    switch (line.type) {
      case 'unchanged':
        leftLines.push({ line, index });
        rightLines.push({ line, index });
        break;
      case 'removed':
        leftLines.push({ line, index });
        rightLines.push({ line: null, index });
        break;
      case 'added':
        leftLines.push({ line: null, index });
        rightLines.push({ line, index });
        break;
      case 'modified':
        leftLines.push({
          line: {
            type: 'removed',
            content: line.oldContent || '',
            lineNumber: { from: line.lineNumber.from },
          },
          index,
        });
        rightLines.push({
          line: {
            type: 'added',
            content: line.content,
            lineNumber: { to: line.lineNumber.to },
          },
          index,
        });
        break;
    }
  });

  return (
    <div className="flex font-mono text-sm">
      {/* Left side (old) */}
      <div className="flex-1 border-r border-slate-300 dark:border-slate-600">
        <div className="sticky top-0 bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-semibold border-b border-slate-200 dark:border-slate-700">
          Original
        </div>
        {leftLines.map(({ line, index }) => (
          <SplitDiffLine key={`left-${index}`} line={line} side="left" />
        ))}
      </div>

      {/* Right side (new) */}
      <div className="flex-1">
        <div className="sticky top-0 bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-semibold border-b border-slate-200 dark:border-slate-700">
          Modified
        </div>
        {rightLines.map(({ line, index }) => (
          <SplitDiffLine key={`right-${index}`} line={line} side="right" />
        ))}
      </div>
    </div>
  );
}

interface SplitDiffLineProps {
  line: DiffLine | null;
  side: 'left' | 'right';
}

function SplitDiffLine({ line, side }: SplitDiffLineProps) {
  if (!line) {
    return (
      <div className="flex bg-slate-50 dark:bg-slate-800/50 min-h-[24px]">
        <div className="w-10 px-1 text-right text-xs text-slate-300 dark:text-slate-600 border-r border-slate-200 dark:border-slate-700" />
        <div className="flex-1 px-2 py-0.5" />
      </div>
    );
  }

  const lineNumber = side === 'left' ? line.lineNumber.from : line.lineNumber.to;

  return (
    <div className={`flex ${getLineBackground(line.type)}`}>
      <div className="w-10 px-1 text-right text-xs text-slate-400 border-r border-slate-200 dark:border-slate-700">
        {lineNumber}
      </div>
      <div className="flex-1 px-2 py-0.5 whitespace-pre-wrap break-all">
        {line.content}
      </div>
    </div>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function getLinePrefix(type: DiffLine['type']): string {
  switch (type) {
    case 'added':
      return '+';
    case 'removed':
      return '-';
    case 'modified':
      return '~';
    default:
      return ' ';
  }
}

function getLineColor(type: DiffLine['type']): string {
  switch (type) {
    case 'added':
      return 'text-green-600 dark:text-green-400';
    case 'removed':
      return 'text-red-600 dark:text-red-400';
    case 'modified':
      return 'text-amber-600 dark:text-amber-400';
    default:
      return 'text-slate-400';
  }
}

function getLineBackground(type: DiffLine['type']): string {
  switch (type) {
    case 'added':
      return 'bg-green-50 dark:bg-green-950/30';
    case 'removed':
      return 'bg-red-50 dark:bg-red-950/30';
    case 'modified':
      return 'bg-amber-50 dark:bg-amber-950/30';
    default:
      return '';
  }
}

export default DiffView;
