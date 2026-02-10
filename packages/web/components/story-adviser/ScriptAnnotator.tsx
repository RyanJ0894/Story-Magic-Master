'use client';

/**
 * ScriptAnnotator Component
 *
 * Displays script text with line numbers and highlighted regions
 * that correspond to suggestions. Clicking a highlight navigates
 * to the associated suggestion.
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  Suggestion,
  SeverityLevel,
  SUGGESTION_CATEGORIES,
} from '@/lib/adviser/types';

// =============================================================================
// Props
// =============================================================================

interface ScriptAnnotatorProps {
  scriptText: string;
  suggestions: Suggestion[];
  onNavigateToSuggestion?: (suggestionId: string) => void;
  highlightedLines?: { startLine: number; endLine: number } | null;
  className?: string;
}

// =============================================================================
// Types
// =============================================================================

interface LineAnnotation {
  lineNumber: number;
  suggestions: Suggestion[];
  isHighlighted: boolean;
}

// =============================================================================
// Severity Colors
// =============================================================================

const severityColors: Record<SeverityLevel, string> = {
  critical: 'bg-red-100 dark:bg-red-900/30 border-l-red-500',
  important: 'bg-amber-100 dark:bg-amber-900/30 border-l-amber-500',
  minor: 'bg-blue-100 dark:bg-blue-900/30 border-l-blue-500',
};

const severityHoverColors: Record<SeverityLevel, string> = {
  critical: 'hover:bg-red-200 dark:hover:bg-red-900/50',
  important: 'hover:bg-amber-200 dark:hover:bg-amber-900/50',
  minor: 'hover:bg-blue-200 dark:hover:bg-blue-900/50',
};

// =============================================================================
// Component
// =============================================================================

export function ScriptAnnotator({
  scriptText,
  suggestions,
  onNavigateToSuggestion,
  highlightedLines,
  className = '',
}: ScriptAnnotatorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Split script into lines
  const lines = useMemo(() => scriptText.split('\n'), [scriptText]);

  // Build annotations map (lineNumber -> suggestions affecting that line)
  const annotations = useMemo(() => {
    const map = new Map<number, Suggestion[]>();

    // Only include pending suggestions for annotations
    const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

    for (const suggestion of pendingSuggestions) {
      const { startLine, endLine } = suggestion.location;
      for (let line = startLine; line <= endLine; line++) {
        const existing = map.get(line) || [];
        existing.push(suggestion);
        map.set(line, existing);
      }
    }

    return map;
  }, [suggestions]);

  // Check if a line is part of the active highlight
  const isLineHighlighted = useCallback(
    (lineNumber: number): boolean => {
      if (!highlightedLines) return false;
      return (
        lineNumber >= highlightedLines.startLine &&
        lineNumber <= highlightedLines.endLine
      );
    },
    [highlightedLines]
  );

  // Get the highest severity for a line (for coloring)
  const getLineSeverity = (lineSuggestions: Suggestion[]): SeverityLevel => {
    if (lineSuggestions.some((s) => s.severity === 'critical')) return 'critical';
    if (lineSuggestions.some((s) => s.severity === 'important')) return 'important';
    return 'minor';
  };

  // Scroll to highlighted lines when they change
  useEffect(() => {
    if (highlightedLines && highlightRef.current) {
      highlightRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlightedLines]);

  // Handle line click
  const handleLineClick = (lineNumber: number) => {
    const lineSuggestions = annotations.get(lineNumber);
    if (lineSuggestions && lineSuggestions.length > 0 && onNavigateToSuggestion) {
      // Navigate to the first suggestion for this line
      onNavigateToSuggestion(lineSuggestions[0].id);
    }
  };

  return (
    <TooltipProvider>
      <ScrollArea className={`h-[500px] ${className}`} ref={scrollRef}>
        <div className="font-mono text-sm">
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            const lineSuggestions = annotations.get(lineNumber) || [];
            const hasSuggestions = lineSuggestions.length > 0;
            const isHighlighted = isLineHighlighted(lineNumber);
            const severity = hasSuggestions ? getLineSeverity(lineSuggestions) : null;

            // Determine ref for scroll targeting
            const lineRef =
              isHighlighted && lineNumber === highlightedLines?.startLine
                ? highlightRef
                : undefined;

            return (
              <div
                key={lineNumber}
                ref={lineRef}
                className={`
                  flex transition-colors
                  ${
                    hasSuggestions
                      ? `${severityColors[severity!]} border-l-4 cursor-pointer ${severityHoverColors[severity!]}`
                      : 'border-l-4 border-l-transparent'
                  }
                  ${
                    isHighlighted
                      ? 'bg-violet-100 dark:bg-violet-900/30 ring-2 ring-violet-500 ring-inset'
                      : ''
                  }
                `}
                onClick={() => hasSuggestions && handleLineClick(lineNumber)}
              >
                {/* Line number */}
                <span className="w-12 flex-shrink-0 text-right pr-4 text-muted-foreground select-none">
                  {lineNumber}
                </span>

                {/* Line content */}
                <span className="flex-1 whitespace-pre-wrap break-all pr-4 py-0.5">
                  {line || '\u00A0'}
                </span>

                {/* Suggestion indicators */}
                {hasSuggestions && (
                  <div className="flex-shrink-0 flex items-center gap-1 pr-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={`text-xs cursor-pointer ${
                            severity === 'critical'
                              ? 'border-red-500 text-red-700 dark:text-red-300'
                              : severity === 'important'
                              ? 'border-amber-500 text-amber-700 dark:text-amber-300'
                              : 'border-blue-500 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {lineSuggestions.length}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <div className="space-y-2">
                          {lineSuggestions.map((suggestion) => (
                            <div key={suggestion.id} className="text-xs">
                              <div className="flex items-center gap-1 mb-0.5">
                                <span>
                                  {SUGGESTION_CATEGORIES[suggestion.category].icon}
                                </span>
                                <span className="font-medium">{suggestion.title}</span>
                              </div>
                              <p className="text-muted-foreground line-clamp-2">
                                {suggestion.suggestion}
                              </p>
                            </div>
                          ))}
                          <p className="text-xs text-muted-foreground italic">
                            Click to view details
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </TooltipProvider>
  );
}

export default ScriptAnnotator;
