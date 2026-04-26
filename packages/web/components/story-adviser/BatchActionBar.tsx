'use client';

/**
 * BatchActionBar Component
 *
 * Floating action bar shown when 1+ suggestion checkboxes are selected.
 * Supports bulk accept / reject / dismiss.
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, EyeOff, X } from 'lucide-react';

// =============================================================================
// Props
// =============================================================================

interface BatchActionBarProps {
  selectedCount: number;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onDismissAll: () => void;
  onClearSelection: () => void;
  isLoading?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function BatchActionBar({
  selectedCount,
  onAcceptAll,
  onRejectAll,
  onDismissAll,
  onClearSelection,
  isLoading = false,
}: BatchActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border bg-background shadow-lg px-4 py-2"
      data-testid="batch-action-bar"
    >
      <Badge variant="secondary" className="mr-1">
        {selectedCount} selected
      </Badge>

      <Button
        size="sm"
        variant="ghost"
        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
        onClick={onAcceptAll}
        disabled={isLoading}
        data-testid="batch-accept"
      >
        <CheckCircle className="w-4 h-4 mr-1" />
        Accept
      </Button>

      <Button
        size="sm"
        variant="ghost"
        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
        onClick={onRejectAll}
        disabled={isLoading}
        data-testid="batch-reject"
      >
        <XCircle className="w-4 h-4 mr-1" />
        Reject
      </Button>

      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-foreground"
        onClick={onDismissAll}
        disabled={isLoading}
        data-testid="batch-dismiss"
      >
        <EyeOff className="w-4 h-4 mr-1" />
        Dismiss
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground h-7 w-7 p-0"
        onClick={onClearSelection}
        title="Clear selection"
        data-testid="batch-clear"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default BatchActionBar;
