'use client';

/**
 * SuggestionPanel Component
 *
 * Displays a filterable list of suggestions with statistics.
 */

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Filter,
} from 'lucide-react';
import { SuggestionCard } from './SuggestionCard';
import { BatchActionBar } from './BatchActionBar';
import {
  Suggestion,
  SUGGESTION_CATEGORIES,
  SuggestionCategory,
  SuggestionStatus,
  sortSuggestions,
} from '@/lib/adviser/types';

// =============================================================================
// Props
// =============================================================================

interface SuggestionPanelProps {
  suggestions: Suggestion[];
  stats?: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    dismissed: number;
    critical: number;
    important: number;
    minor: number;
  };
  onAccept?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  onDismiss?: (id: string) => Promise<void>;
  onRewrite?: (id: string) => void;
  onNavigate?: (startLine: number, endLine: number) => void;
  isLoading?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function SuggestionPanel({
  suggestions,
  stats,
  onAccept,
  onReject,
  onDismiss,
  onRewrite,
  onNavigate,
  isLoading = false,
}: SuggestionPanelProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | SuggestionStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | SuggestionCategory>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'important' | 'minor'>(
    'all'
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter suggestions
  const filteredSuggestions = useMemo(() => {
    let filtered = [...suggestions];

    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((s) => s.category === categoryFilter);
    }

    if (severityFilter !== 'all') {
      filtered = filtered.filter((s) => s.severity === severityFilter);
    }

    return sortSuggestions(filtered);
  }, [suggestions, statusFilter, categoryFilter, severityFilter]);

  // Batch selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredSuggestions.map((s) => s.id)));
  }, [filteredSuggestions]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBatchAccept = useCallback(async () => {
    if (!onAccept) return;
    await Promise.all(Array.from(selectedIds).map((id) => onAccept(id)));
    clearSelection();
  }, [selectedIds, onAccept, clearSelection]);

  const handleBatchReject = useCallback(async () => {
    if (!onReject) return;
    await Promise.all(Array.from(selectedIds).map((id) => onReject(id)));
    clearSelection();
  }, [selectedIds, onReject, clearSelection]);

  const handleBatchDismiss = useCallback(async () => {
    if (!onDismiss) return;
    await Promise.all(Array.from(selectedIds).map((id) => onDismiss(id)));
    clearSelection();
  }, [selectedIds, onDismiss, clearSelection]);

  // Group categories for filter dropdown
  const categoryGroups = {
    concept: ['premise', 'clarity', 'commercial'],
    structure: ['structure', 'pacing', 'stakes'],
    character: ['protagonist', 'supporting', 'castability'],
    craft: ['dialogue', 'visual', 'technical'],
  };

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.critical}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.accepted}</p>
                <p className="text-xs text-muted-foreground">Accepted</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <XCircle className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.rejected + stats.dismissed}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Status Filter */}
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-2 h-6">
              All
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs px-2 h-6">
              Pending
            </TabsTrigger>
            <TabsTrigger value="accepted" className="text-xs px-2 h-6">
              Accepted
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Severity Filter */}
        <div className="flex gap-1">
          <Button
            variant={severityFilter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSeverityFilter('all')}
          >
            All Severity
          </Button>
          <Button
            variant={severityFilter === 'critical' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSeverityFilter('critical')}
          >
            <AlertTriangle className="w-3 h-3 mr-1 text-red-500" />
            Critical
          </Button>
          <Button
            variant={severityFilter === 'important' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSeverityFilter('important')}
          >
            <AlertCircle className="w-3 h-3 mr-1 text-amber-500" />
            Important
          </Button>
          <Button
            variant={severityFilter === 'minor' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSeverityFilter('minor')}
          >
            <Info className="w-3 h-3 mr-1 text-blue-500" />
            Minor
          </Button>
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
          className="h-8 text-xs rounded-md border border-input bg-background px-2"
        >
          <option value="all">All Categories</option>
          <optgroup label="Concept">
            {categoryGroups.concept.map((cat) => (
              <option key={cat} value={cat}>
                {SUGGESTION_CATEGORIES[cat as SuggestionCategory].icon}{' '}
                {SUGGESTION_CATEGORIES[cat as SuggestionCategory].label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Structure">
            {categoryGroups.structure.map((cat) => (
              <option key={cat} value={cat}>
                {SUGGESTION_CATEGORIES[cat as SuggestionCategory].icon}{' '}
                {SUGGESTION_CATEGORIES[cat as SuggestionCategory].label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Character">
            {categoryGroups.character.map((cat) => (
              <option key={cat} value={cat}>
                {SUGGESTION_CATEGORIES[cat as SuggestionCategory].icon}{' '}
                {SUGGESTION_CATEGORIES[cat as SuggestionCategory].label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Craft">
            {categoryGroups.craft.map((cat) => (
              <option key={cat} value={cat}>
                {SUGGESTION_CATEGORIES[cat as SuggestionCategory].icon}{' '}
                {SUGGESTION_CATEGORIES[cat as SuggestionCategory].label}
              </option>
            ))}
          </optgroup>
        </select>

        {/* Active filters indicator */}
        {(statusFilter !== 'all' || categoryFilter !== 'all' || severityFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setStatusFilter('all');
              setCategoryFilter('all');
              setSeverityFilter('all');
            }}
          >
            <Filter className="w-3 h-3 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Results count + select-all */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Showing {filteredSuggestions.length} of {suggestions.length} suggestions</span>
        {filteredSuggestions.length > 0 && (
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox
              checked={
                filteredSuggestions.length > 0 &&
                filteredSuggestions.every((s) => selectedIds.has(s.id))
              }
              onCheckedChange={(checked) => (checked ? selectAll() : clearSelection())}
              aria-label="Select all visible suggestions"
              data-testid="select-all-checkbox"
            />
            <span className="text-xs">Select all</span>
          </label>
        )}
      </div>

      {/* Suggestions List */}
      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-3 pb-16">
          {filteredSuggestions.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-muted-foreground">
                {suggestions.length === 0
                  ? 'No suggestions yet. Generate suggestions to get started.'
                  : 'No suggestions match your filters.'}
              </div>
            </Card>
          ) : (
            filteredSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="flex items-start gap-2">
                <Checkbox
                  checked={selectedIds.has(suggestion.id)}
                  onCheckedChange={() => toggleSelect(suggestion.id)}
                  className="mt-4 shrink-0"
                  aria-label={`Select suggestion`}
                  data-testid={`select-${suggestion.id}`}
                />
                <div className="flex-1">
                  <SuggestionCard
                    suggestion={suggestion}
                    onAccept={onAccept}
                    onReject={onReject}
                    onDismiss={onDismiss}
                    onRewrite={onRewrite}
                    onNavigate={onNavigate}
                    isLoading={isLoading}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Batch action bar (appears when selections exist) */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        onAcceptAll={handleBatchAccept}
        onRejectAll={handleBatchReject}
        onDismissAll={handleBatchDismiss}
        onClearSelection={clearSelection}
        isLoading={isLoading}
      />
    </div>
  );
}

export default SuggestionPanel;
