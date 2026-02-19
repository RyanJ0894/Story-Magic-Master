'use client';

/**
 * RewriteModal Component
 *
 * Modal for generating and selecting rewrites for a suggestion.
 * Shows the original text, suggestion, and generated rewrite options.
 */

import { useState, useEffect } from 'react';
import { log } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  Wand2,
  Check,
  Copy,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/fetch';
import { Suggestion, Rewrite, SUGGESTION_CATEGORIES } from '@/lib/adviser/types';

// =============================================================================
// Props
// =============================================================================

interface RewriteModalProps {
  projectId: string;
  suggestion: Suggestion | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectRewrite?: (rewriteId: string) => Promise<void>;
}

// =============================================================================
// Style Options
// =============================================================================

type RewriteStyle = 'conservative' | 'moderate' | 'bold';

const styleOptions: { value: RewriteStyle; label: string; description: string }[] = [
  {
    value: 'conservative',
    label: 'Conservative',
    description: 'Minimal changes, preserves original voice closely',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'Balanced approach with thoughtful improvements',
  },
  {
    value: 'bold',
    label: 'Bold',
    description: 'More creative interpretation, significant changes',
  },
];

// =============================================================================
// Component
// =============================================================================

export function RewriteModal({
  projectId,
  suggestion,
  isOpen,
  onClose,
  onSelectRewrite,
}: RewriteModalProps) {
  const [rewrites, setRewrites] = useState<Rewrite[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRewrite, setSelectedRewrite] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<RewriteStyle>('moderate');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch existing rewrites when suggestion changes
  useEffect(() => {
    if (suggestion && isOpen) {
      fetchRewrites();
    }
  }, [suggestion?.id, isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedRewrite(null);
      setError(null);
      setCopiedId(null);
    }
  }, [isOpen]);

  const fetchRewrites = async () => {
    if (!suggestion) return;

    try {
      const response = await apiFetch(`/api/projects/${projectId}/suggestions/${suggestion.id}/rewrite`);
      if (response.ok) {
        const data = await response.json();
        setRewrites(data.rewrites || []);
        if (data.rewrites?.length > 0) {
          // Pre-select the first selected rewrite or the first one
          const selected = data.rewrites.find((r: Rewrite) => r.isSelected);
          setSelectedRewrite(selected?.id || data.rewrites[0].id);
        }
      }
    } catch (err) {
      log.error('Failed to fetch rewrites', err);
    }
  };

  const generateRewrites = async () => {
    if (!suggestion) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/projects/${projectId}/suggestions/${suggestion.id}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: 3,
          style: selectedStyle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate rewrites');
      }

      const data = await response.json();
      setRewrites(data.rewrites || []);
      if (data.rewrites?.length > 0) {
        setSelectedRewrite(data.rewrites[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate rewrites');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectRewrite = async () => {
    if (!selectedRewrite || !onSelectRewrite) return;

    setIsSelecting(true);
    try {
      await onSelectRewrite(selectedRewrite);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select rewrite');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      log.error('Failed to copy', err);
    }
  };

  if (!suggestion) return null;

  const categoryConfig = SUGGESTION_CATEGORIES[suggestion.category];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-violet-500" />
            Generate Rewrites
          </DialogTitle>
          <DialogDescription>
            AI-generated alternatives for your script section
          </DialogDescription>
        </DialogHeader>

        {/* Suggestion Context */}
        <div className="space-y-4 border-b pb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <span className="mr-1">{categoryConfig.icon}</span>
              {categoryConfig.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Lines {suggestion.location.startLine}-{suggestion.location.endLine}
            </span>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Original text:</p>
            <pre className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
              {suggestion.location.excerpt}
            </pre>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Suggestion:</p>
            <p className="text-sm text-muted-foreground">{suggestion.suggestion}</p>
          </div>
        </div>

        {/* Rewrites Section */}
        <div className="space-y-4">
          {rewrites.length === 0 && !isGenerating ? (
            /* Generate Options */
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose a style for the generated rewrites:
              </p>

              <RadioGroup
                value={selectedStyle}
                onValueChange={(v) => setSelectedStyle(v as RewriteStyle)}
                className="grid grid-cols-3 gap-3"
              >
                {styleOptions.map((option) => (
                  <div key={option.value}>
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={option.value}
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-violet-500 cursor-pointer"
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground text-center mt-1">
                        {option.description}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <Button
                onClick={generateRewrites}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Rewrites...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate 3 Rewrites
                  </>
                )}
              </Button>
            </div>
          ) : isGenerating ? (
            /* Loading State */
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            /* Rewrite Options */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Select a rewrite:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generateRewrites}
                  disabled={isGenerating}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Regenerate
                </Button>
              </div>

              <RadioGroup
                value={selectedRewrite || ''}
                onValueChange={setSelectedRewrite}
                className="space-y-2"
              >
                {rewrites.map((rewrite, index) => (
                  <div
                    key={rewrite.id}
                    className={`relative rounded-lg border-2 p-3 transition-colors ${
                      selectedRewrite === rewrite.id
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/10'
                        : 'border-muted hover:border-violet-300'
                    }`}
                  >
                    <RadioGroupItem
                      value={rewrite.id}
                      id={rewrite.id}
                      className="sr-only"
                    />
                    <Label
                      htmlFor={rewrite.id}
                      className="cursor-pointer block"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          Option {index + 1}
                          {rewrite.style && ` - ${rewrite.style}`}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={(e) => {
                            e.preventDefault();
                            handleCopyText(rewrite.id, rewrite.rewrittenText);
                          }}
                        >
                          {copiedId === rewrite.id ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                      <pre className="text-sm whitespace-pre-wrap font-mono bg-background p-2 rounded">
                        {rewrite.rewrittenText}
                      </pre>
                      {rewrite.explanation && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          {rewrite.explanation}
                        </p>
                      )}
                    </Label>

                    {selectedRewrite === rewrite.id && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {rewrites.length > 0 && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSelectRewrite}
              disabled={!selectedRewrite || isSelecting}
            >
              {isSelecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Use This Rewrite
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RewriteModal;
