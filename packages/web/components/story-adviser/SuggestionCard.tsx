'use client';

/**
 * SuggestionCard Component
 *
 * Displays a single suggestion with its details, severity, and actions.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Minus,
  Wand2,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  MapPin,
} from 'lucide-react';
import {
  Suggestion,
  SUGGESTION_CATEGORIES,
  SEVERITY_LEVELS,
  SuggestionCategory,
  SeverityLevel,
} from '@/lib/adviser/types';

// =============================================================================
// Props
// =============================================================================

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onDismiss?: (id: string) => Promise<void>;
  onRewrite?: (id: string) => void;
  onNavigate?: (startLine: number, endLine: number) => void;
  isLoading?: boolean;
}

// =============================================================================
// Severity Icons
// =============================================================================

const severityIcons: Record<SeverityLevel, typeof AlertTriangle> = {
  critical: AlertTriangle,
  important: AlertCircle,
  minor: Info,
};

// =============================================================================
// Component
// =============================================================================

export function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
  onDismiss,
  onRewrite,
  onNavigate,
  isLoading = false,
}: SuggestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const categoryConfig = SUGGESTION_CATEGORIES[suggestion.category];
  const severityConfig = SEVERITY_LEVELS[suggestion.severity];
  const SeverityIcon = severityIcons[suggestion.severity];

  const handleAction = async (
    action: 'accept' | 'reject' | 'dismiss',
    handler?: (id: string) => Promise<void>
  ) => {
    if (!handler) return;
    setActionLoading(action);
    try {
      await handler(suggestion.id);
    } finally {
      setActionLoading(null);
    }
  };

  // Color maps for categories and severity
  const categoryColorMap: Record<SuggestionCategory, string> = {
    premise: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    clarity: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    commercial: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    structure: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    pacing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    stakes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    protagonist: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    supporting: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    castability: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    dialogue: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    visual: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    technical: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  };

  const severityColorMap: Record<SeverityLevel, string> = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    important: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    minor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };

  const isPending = suggestion.status === 'pending';

  return (
    <Card
      className={`transition-all ${
        !isPending ? 'opacity-60' : ''
      } ${suggestion.severity === 'critical' ? 'border-red-200 dark:border-red-800' : ''}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={categoryColorMap[suggestion.category]}>
                <span className="mr-1">{categoryConfig.icon}</span>
                {categoryConfig.label}
              </Badge>
              <Badge variant="outline" className={severityColorMap[suggestion.severity]}>
                <SeverityIcon className="w-3 h-3 mr-1" />
                {severityConfig.label}
              </Badge>
              {!isPending && (
                <Badge
                  variant={
                    suggestion.status === 'accepted'
                      ? 'default'
                      : suggestion.status === 'rejected'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {suggestion.status === 'accepted' && <Check className="w-3 h-3 mr-1" />}
                  {suggestion.status === 'rejected' && <X className="w-3 h-3 mr-1" />}
                  {suggestion.status === 'dismissed' && <Minus className="w-3 h-3 mr-1" />}
                  {suggestion.status.charAt(0).toUpperCase() + suggestion.status.slice(1)}
                </Badge>
              )}
            </div>
            <CardTitle className="text-base leading-tight">{suggestion.title}</CardTitle>
            <CardDescription className="mt-1">
              <button
                onClick={() => onNavigate?.(suggestion.location.startLine, suggestion.location.endLine)}
                className="inline-flex items-center gap-1 text-xs hover:underline"
              >
                <MapPin className="w-3 h-3" />
                Lines {suggestion.location.startLine}-{suggestion.location.endLine}
              </button>
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {/* Excerpt */}
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-1">Original text:</p>
            <pre className="text-sm bg-muted/50 p-3 rounded-md whitespace-pre-wrap font-mono overflow-x-auto max-h-32">
              {suggestion.location.excerpt}
            </pre>
          </div>

          {/* Explanation */}
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-1">Why this matters:</p>
            <p className="text-sm text-foreground">{suggestion.explanation}</p>
          </div>

          {/* Suggestion */}
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-1">Suggestion:</p>
            <p className="text-sm text-foreground font-medium">{suggestion.suggestion}</p>
          </div>

          {/* Confidence */}
          <div className="text-xs text-muted-foreground mb-4">
            Confidence: {Math.round(suggestion.confidence * 100)}%
          </div>

          {/* Actions */}
          {isPending && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="default"
                onClick={() => handleAction('accept', onAccept)}
                disabled={isLoading || actionLoading !== null}
              >
                {actionLoading === 'accept' ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Check className="w-3 h-3 mr-1" />
                )}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRewrite?.(suggestion.id)}
                disabled={isLoading || actionLoading !== null}
              >
                <Wand2 className="w-3 h-3 mr-1" />
                Get Rewrites
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleAction('dismiss', onDismiss)}
                disabled={isLoading || actionLoading !== null}
              >
                {actionLoading === 'dismiss' ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Minus className="w-3 h-3 mr-1" />
                )}
                Skip
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:text-red-700"
                onClick={() => handleAction('reject', onReject)}
                disabled={isLoading || actionLoading !== null}
              >
                {actionLoading === 'reject' ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <X className="w-3 h-3 mr-1" />
                )}
                Disagree
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default SuggestionCard;
