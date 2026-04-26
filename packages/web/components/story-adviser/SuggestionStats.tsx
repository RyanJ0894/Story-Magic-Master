'use client';

/**
 * SuggestionStats Component
 *
 * Dashboard panel showing aggregate suggestion metrics.
 * Designed to be used at the top of the adviser wizard or inline.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Lightbulb,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface SuggestionStatsData {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  dismissed: number;
  critical: number;
  important: number;
  minor: number;
}

interface SuggestionStatsProps {
  stats: SuggestionStatsData;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function SuggestionStats({ stats, className = '' }: SuggestionStatsProps) {
  const resolved = stats.accepted + stats.rejected + stats.dismissed;
  const completionPct = stats.total > 0 ? Math.round((resolved / stats.total) * 100) : 0;

  return (
    <div className={`space-y-4 ${className}`} data-testid="suggestion-stats">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-muted-foreground">Review progress</span>
          <span className="text-sm font-semibold">{completionPct}%</span>
        </div>
        <Progress value={completionPct} className="h-2" />
        <p className="text-xs text-muted-foreground mt-1">
          {resolved} of {stats.total} suggestions reviewed
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.pending}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.critical}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Critical</p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.accepted}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Accepted</p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <XCircle className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{stats.rejected + stats.dismissed}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Skipped</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Severity breakdown */}
      {stats.total > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>Severity breakdown</span>
            </div>
            <span>{stats.total} total</span>
          </div>
          <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
            {stats.critical > 0 && (
              <div
                className="bg-red-500"
                style={{ width: `${(stats.critical / stats.total) * 100}%` }}
                title={`Critical: ${stats.critical}`}
              />
            )}
            {stats.important > 0 && (
              <div
                className="bg-amber-500"
                style={{ width: `${(stats.important / stats.total) * 100}%` }}
                title={`Important: ${stats.important}`}
              />
            )}
            {stats.minor > 0 && (
              <div
                className="bg-blue-400"
                style={{ width: `${(stats.minor / stats.total) * 100}%` }}
                title={`Minor: ${stats.minor}`}
              />
            )}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
              {stats.critical} critical
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              {stats.important} important
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              {stats.minor} minor
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuggestionStats;
