'use client';

/**
 * ScriptEditorSection Component
 *
 * Full-featured script editor with revision saving,
 * Story-Adviser integration, and auto-save.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Edit3,
  Save,
  Undo,
  RotateCcw,
  FlaskConical,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { ScriptEditor } from './ScriptEditor';
import { FeatureGate } from '@/lib/features';
import { Suggestion } from '@/lib/adviser/types';

// =============================================================================
// Props
// =============================================================================

interface ScriptEditorSectionProps {
  projectId: string;
  initialScriptText: string;
  suggestions?: Suggestion[];
  onSuggestionClick?: (suggestionId: string) => void;
  onScriptChange?: (newText: string) => void;
}

// =============================================================================
// Component
// =============================================================================

export function ScriptEditorSection({
  projectId,
  initialScriptText,
  suggestions = [],
  onSuggestionClick,
  onScriptChange,
}: ScriptEditorSectionProps) {
  const [scriptText, setScriptText] = useState(initialScriptText);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [revisionLabel, setRevisionLabel] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const originalText = useRef(initialScriptText);

  // Track changes
  const handleChange = useCallback(
    (newValue: string) => {
      setScriptText(newValue);
      setHasChanges(newValue !== originalText.current);
      onScriptChange?.(newValue);
    },
    [onScriptChange]
  );

  // Revert changes
  const handleRevert = useCallback(() => {
    setScriptText(originalText.current);
    setHasChanges(false);
  }, []);

  // Save as new revision
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptText,
          label: revisionLabel || undefined,
          autoScore: true, // Auto-generate a new score
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save revision');
      }

      // Success
      originalText.current = scriptText;
      setHasChanges(false);
      setShowSaveDialog(false);
      setRevisionLabel('');
      setLastSaved(new Date());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save indicator
  const formatLastSaved = () => {
    if (!lastSaved) return null;
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);

    if (diff < 60) return 'Saved just now';
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
    return `Saved at ${lastSaved.toLocaleTimeString()}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-violet-500" />
              Script Editor
              <Badge variant="secondary" className="ml-2">Beta</Badge>
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              Edit your script directly with syntax highlighting
              {lastSaved && (
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {formatLastSaved()}
                </span>
              )}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button variant="ghost" size="sm" onClick={handleRevert}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Revert
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setShowSaveDialog(true)}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Save Revision
            </Button>
          </div>
        </div>

        {hasChanges && (
          <div className="mt-2 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-4 h-4" />
            You have unsaved changes
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="h-[600px]">
          <ScriptEditor
            value={scriptText}
            onChange={handleChange}
            suggestions={suggestions}
            onSuggestionClick={onSuggestionClick}
          />
        </div>
      </CardContent>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as New Revision</DialogTitle>
            <DialogDescription>
              This will create a new version of your script. Add an optional label
              to help you identify this revision later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Revision Label (optional)
              </label>
              <Input
                placeholder="e.g., After feedback from John"
                value={revisionLabel}
                onChange={(e) => setRevisionLabel(e.target.value)}
              />
            </div>

            {saveError && (
              <div className="flex items-start gap-2 text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{saveError}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Revision
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// =============================================================================
// Feature-Gated Wrapper
// =============================================================================

interface ScriptEditorSectionWrapperProps extends ScriptEditorSectionProps {}

/**
 * Fallback shown when feature is disabled
 */
function ScriptEditorPreview() {
  return (
    <Card className="border-dashed border-2 opacity-60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit3 className="w-5 h-5 text-muted-foreground" />
          Script Editor
          <Badge variant="outline" className="ml-2">
            <FlaskConical className="w-3 h-3 mr-1" />
            Coming Soon
          </Badge>
        </CardTitle>
        <CardDescription>
          Edit your script directly in the browser with professional tools.
          This feature is currently in development.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Script Editor will provide:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Screenplay syntax highlighting</li>
            <li>Suggestion highlighting from Story-Adviser</li>
            <li>One-click rewrite application</li>
            <li>Auto-save with revision tracking</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function ScriptEditorWrapper(props: ScriptEditorSectionWrapperProps) {
  return (
    <FeatureGate feature="SCRIPT_EDITOR" fallback={<ScriptEditorPreview />}>
      <ScriptEditorSection {...props} />
    </FeatureGate>
  );
}

export default ScriptEditorSection;
