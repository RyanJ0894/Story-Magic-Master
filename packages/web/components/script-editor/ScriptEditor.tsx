'use client';

/**
 * ScriptEditor Component
 *
 * CodeMirror-based script editor with screenplay syntax support
 * and integration with Story-Adviser suggestions.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorState, StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  highlightActiveLine,
  Decoration,
  DecorationSet,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, StreamLanguage } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { tags } from '@lezer/highlight';
import { Suggestion } from '@/lib/adviser/types';

// =============================================================================
// Screenplay Language Support
// =============================================================================

/**
 * Simple screenplay syntax highlighting
 */
const screenplayLanguage = StreamLanguage.define({
  token(stream) {
    // Scene headings (INT./EXT.)
    if (stream.sol() && stream.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i)) {
      stream.skipToEnd();
      return 'heading';
    }

    // Character names (ALL CAPS at start of line, not a scene heading)
    if (stream.sol()) {
      const match = stream.match(/^[A-Z][A-Z0-9\s]+(?=\s*$|\s*\()/);
      if (match) {
        return 'keyword';
      }
    }

    // Parentheticals
    if (stream.match(/^\([^)]*\)/)) {
      return 'comment';
    }

    // Transitions (FADE IN:, CUT TO:, etc.)
    if (stream.sol() && stream.match(/^[A-Z\s]+:$/)) {
      return 'operator';
    }

    // Action text in CAPS (sound effects, etc.)
    if (stream.match(/\b[A-Z]{2,}\b/)) {
      return 'strong';
    }

    stream.next();
    return null;
  },
});

/**
 * Screenplay theme
 */
const screenplayTheme = HighlightStyle.define([
  { tag: tags.heading, color: '#4f46e5', fontWeight: 'bold' },
  { tag: tags.keyword, color: '#0891b2', fontWeight: 'bold' },
  { tag: tags.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.operator, color: '#dc2626', fontWeight: 'bold' },
  { tag: tags.strong, color: '#ea580c' },
]);

// =============================================================================
// Suggestion Highlighting
// =============================================================================

interface HighlightRange {
  from: number;
  to: number;
  severity: 'critical' | 'important' | 'minor';
  suggestionId: string;
}

// Effect to update highlights
const setHighlightsEffect = StateEffect.define<HighlightRange[]>();

// Decoration marks for different severity levels
const criticalMark = Decoration.mark({ class: 'cm-suggestion-critical' });
const importantMark = Decoration.mark({ class: 'cm-suggestion-important' });
const minorMark = Decoration.mark({ class: 'cm-suggestion-minor' });

// State field to track highlights
const highlightsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(highlights, tr) {
    highlights = highlights.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(setHighlightsEffect)) {
        const builder = new RangeSetBuilder<Decoration>();
        const ranges = effect.value.sort((a, b) => a.from - b.from);

        for (const range of ranges) {
          const mark =
            range.severity === 'critical'
              ? criticalMark
              : range.severity === 'important'
              ? importantMark
              : minorMark;
          builder.add(range.from, range.to, mark);
        }

        highlights = builder.finish();
      }
    }

    return highlights;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// =============================================================================
// Editor Theme
// =============================================================================

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    fontFamily: 'Courier New, Courier, monospace',
  },
  '.cm-content': {
    padding: '16px',
    caretColor: '#4f46e5',
  },
  '.cm-cursor': {
    borderLeftColor: '#4f46e5',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(79, 70, 229, 0.05)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    borderRight: '1px solid #e2e8f0',
    color: '#94a3b8',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
  },
  // Suggestion highlight styles
  '.cm-suggestion-critical': {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderBottom: '2px wavy #ef4444',
  },
  '.cm-suggestion-important': {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderBottom: '2px wavy #f59e0b',
  },
  '.cm-suggestion-minor': {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderBottom: '2px dashed #3b82f6',
  },
});

// =============================================================================
// Props
// =============================================================================

interface ScriptEditorProps {
  value: string;
  onChange?: (value: string) => void;
  suggestions?: Suggestion[];
  onSuggestionClick?: (suggestionId: string) => void;
  readOnly?: boolean;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ScriptEditor({
  value,
  onChange,
  suggestions = [],
  onSuggestionClick,
  readOnly = false,
  className = '',
}: ScriptEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Convert line-based suggestions to character positions
  const getHighlightRanges = useCallback(
    (doc: string): HighlightRange[] => {
      if (!suggestions || suggestions.length === 0) return [];

      const lines = doc.split('\n');
      const ranges: HighlightRange[] = [];

      // Only highlight pending suggestions
      const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

      for (const suggestion of pendingSuggestions) {
        const { startLine, endLine } = suggestion.location;

        // Calculate character positions
        let fromPos = 0;
        for (let i = 0; i < startLine - 1 && i < lines.length; i++) {
          fromPos += lines[i].length + 1; // +1 for newline
        }

        let toPos = fromPos;
        for (let i = startLine - 1; i < endLine && i < lines.length; i++) {
          toPos += lines[i].length + 1;
        }
        toPos = Math.max(toPos - 1, fromPos); // Remove trailing newline

        if (fromPos < doc.length) {
          ranges.push({
            from: fromPos,
            to: Math.min(toPos, doc.length),
            severity: suggestion.severity,
            suggestionId: suggestion.id,
          });
        }
      }

      return ranges;
    },
    [suggestions]
  );

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) {
        onChange(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        screenplayLanguage,
        syntaxHighlighting(screenplayTheme),
        editorTheme,
        highlightsField,
        updateListener,
        EditorState.readOnly.of(readOnly),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    setIsInitialized(true);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update value from props
  useEffect(() => {
    if (!viewRef.current || !isInitialized) return;

    const currentValue = viewRef.current.state.doc.toString();
    if (currentValue !== value) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
    }
  }, [value, isInitialized]);

  // Update highlights when suggestions change
  useEffect(() => {
    if (!viewRef.current || !isInitialized) return;

    const doc = viewRef.current.state.doc.toString();
    const ranges = getHighlightRanges(doc);

    viewRef.current.dispatch({
      effects: setHighlightsEffect.of(ranges),
    });
  }, [suggestions, isInitialized, getHighlightRanges]);

  // Handle click on editor to detect suggestion clicks
  useEffect(() => {
    if (!containerRef.current || !onSuggestionClick) return;

    const handleClick = (event: MouseEvent) => {
      if (!viewRef.current) return;

      const view = viewRef.current;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return;

      const doc = view.state.doc.toString();
      const ranges = getHighlightRanges(doc);

      // Find if click is within a suggestion range
      for (const range of ranges) {
        if (pos >= range.from && pos <= range.to) {
          onSuggestionClick(range.suggestionId);
          break;
        }
      }
    };

    containerRef.current.addEventListener('click', handleClick);
    return () => {
      containerRef.current?.removeEventListener('click', handleClick);
    };
  }, [onSuggestionClick, getHighlightRanges, isInitialized]);

  return (
    <div
      ref={containerRef}
      className={`h-full border border-border rounded-lg overflow-hidden ${className}`}
    />
  );
}

export default ScriptEditor;
