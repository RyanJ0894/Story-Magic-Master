'use client';

/**
 * ComparableCard Component
 *
 * Displays a single comparable script from the corpus.
 */

import { cn } from '@/lib/utils';
import {
  ComparableScript,
  getMatchLabel,
  getStatusBadge,
  formatBudgetTier,
  formatBoxOffice,
} from '@/lib/comparable/types';
import { Film, DollarSign, Building2 } from 'lucide-react';

// =============================================================================
// Props
// =============================================================================

interface ComparableCardProps {
  script: ComparableScript;
  rank: number;
}

// =============================================================================
// Component
// =============================================================================

export function ComparableCard({ script, rank }: ComparableCardProps) {
  const matchLabel = getMatchLabel(script.similarity);
  const statusBadge = getStatusBadge(script.productionStatus);
  const relevancePercent = Math.round(script.similarity * 100);

  const matchColorClass = {
    'Strong Match': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'Good Match': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'Related': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'Weak Match': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  }[matchLabel];

  const statusColorClass = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  }[statusBadge.color];

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
            {rank}
          </div>
          <div>
            <h4 className="font-semibold text-foreground">{script.title}</h4>
            {script.studio && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {script.studio}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', matchColorClass)}>
            {relevancePercent}% Match
          </span>
          <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColorClass)}>
            {statusBadge.label}
          </span>
        </div>
      </div>

      {/* Logline */}
      {script.logline && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {script.logline}
        </p>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap gap-2 text-xs">
        {/* Genre Tags */}
        {script.genre.slice(0, 3).map((g) => (
          <span
            key={g}
            className="px-2 py-0.5 rounded bg-muted text-muted-foreground"
          >
            {g}
          </span>
        ))}

        {/* Tone */}
        {script.tone && (
          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
            {script.tone}
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
        {script.budgetTier && (
          <span className="flex items-center gap-1">
            <Film className="w-3 h-3" />
            {formatBudgetTier(script.budgetTier)}
          </span>
        )}
        {script.boxOfficeMillions !== null && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {formatBoxOffice(script.boxOfficeMillions)} Box Office
          </span>
        )}
      </div>
    </div>
  );
}

export default ComparableCard;
