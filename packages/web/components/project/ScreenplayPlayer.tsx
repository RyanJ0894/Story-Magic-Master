'use client';

/**
 * ScreenplayPlayer — renders screenplay text synced to audio with inline annotation.
 *
 * Features: screenplay format rendering, hover-to-annotate, note indicators,
 * per-scene reaction buttons (Like / Dislike / Undecided).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ThumbsUp, ThumbsDown, HelpCircle, Plus, X, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoteComment {
  id: string;
  text: string | null;
  reactionType: string | null;
  sceneIndex: number | null;
  audioTimestampMs: number | null;
  userId: string;
  user: { name: string };
  createdAt: string;
}

export interface ScreenplayPlayerProps {
  projectId: string;
  scriptText: string;
  currentUserId: string;
  /** Audio current time in ms — used to highlight the active line */
  currentTimeMs?: number;
  /** Called when user seeks by clicking a note's timestamp */
  onSeekTo?: (ms: number) => void;
  /** Called after a note or reaction is created */
  onCommentAdded?: (comment: NoteComment) => void;
}

// ---------------------------------------------------------------------------
// Screenplay parser
// ---------------------------------------------------------------------------

type BlockType = 'scene-heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition';

interface Block {
  type: BlockType;
  text: string;
  sceneIndex: number; // which INT./EXT. heading this block belongs to (0-based)
}

function parseScreenplay(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let sceneIndex = -1;
  let prevWasCharacter = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) { prevWasCharacter = false; continue; }

    // Scene heading
    if (/^(INT\.|EXT\.|INT\/EXT\.|INT \/EXT\.|I\/E\.)/i.test(trimmed)) {
      sceneIndex++;
      blocks.push({ type: 'scene-heading', text: trimmed, sceneIndex });
      prevWasCharacter = false;
      continue;
    }

    // Transition (TO:, FADE, CUT TO, etc.)
    if (/^(FADE|CUT TO:|SMASH CUT|DISSOLVE|WIPE)/i.test(trimmed) || /TO:$/.test(trimmed)) {
      blocks.push({ type: 'transition', text: trimmed, sceneIndex: Math.max(0, sceneIndex) });
      prevWasCharacter = false;
      continue;
    }

    // Parenthetical
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      blocks.push({ type: 'parenthetical', text: trimmed, sceneIndex: Math.max(0, sceneIndex) });
      prevWasCharacter = false;
      continue;
    }

    // Character name: ALL CAPS, short, not a scene heading
    if (
      trimmed === trimmed.toUpperCase() &&
      trimmed.length < 50 &&
      !/[.!?]$/.test(trimmed) &&
      !trimmed.includes('  ')
    ) {
      blocks.push({ type: 'character', text: trimmed, sceneIndex: Math.max(0, sceneIndex) });
      prevWasCharacter = true;
      continue;
    }

    // Dialogue follows a character name
    if (prevWasCharacter || (blocks.length > 0 && blocks[blocks.length - 1]?.type === 'parenthetical' && blocks.findLast(b => b.type === 'character') != null)) {
      blocks.push({ type: 'dialogue', text: trimmed, sceneIndex: Math.max(0, sceneIndex) });
      prevWasCharacter = false;
      continue;
    }

    blocks.push({ type: 'action', text: trimmed, sceneIndex: Math.max(0, sceneIndex) });
    prevWasCharacter = false;
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Reaction button
// ---------------------------------------------------------------------------

function ReactionButton({
  icon,
  label,
  active,
  testId,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      data-active={active ? 'true' : undefined}
      title={label}
      className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-colors',
        active
          ? testId === 'reaction-like'
            ? 'bg-green-100 border-green-400 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-400'
            : testId === 'reaction-dislike'
              ? 'bg-red-100 border-red-400 text-red-700 dark:bg-red-900/30 dark:border-red-600 dark:text-red-400'
              : 'bg-gray-100 border-gray-400 text-gray-700 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-300'
          : 'bg-transparent border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Note popover
// ---------------------------------------------------------------------------

function NotePopover({
  onSave,
  onCancel,
}: {
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  return (
    <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border border-border bg-background shadow-lg p-3 space-y-2">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note…"
        data-note-input
        rows={3}
        className="w-full rounded border border-border bg-muted/50 px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-2.5 py-1 text-xs rounded border border-border hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { if (text.trim()) onSave(text.trim()); }}
          disabled={!text.trim()}
          className="px-2.5 py-1 text-xs font-semibold rounded bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ScreenplayPlayer({
  projectId,
  scriptText,
  currentUserId,
  currentTimeMs,
  onSeekTo,
  onCommentAdded,
}: ScreenplayPlayerProps) {
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [hoverBlockIndex, setHoverBlockIndex] = useState<number | null>(null);
  const [openNoteBlockIndex, setOpenNoteBlockIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const blocks = parseScreenplay(scriptText);

  // Load comments on mount
  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`);
      if (res.ok) {
        const json = await res.json() as { comments: NoteComment[] };
        setComments(json.comments);
      }
    } catch { /* silent — UI still works without comments */ }
  }, [projectId]);

  useEffect(() => { void loadComments(); }, [loadComments]);

  // Build lookup maps from sceneIndex
  const notesByScene = new Map<number, NoteComment[]>();
  const reactionByScene = new Map<number, string>(); // current user's reaction
  for (const c of comments) {
    if (c.sceneIndex == null) continue;
    if (c.text) {
      const arr = notesByScene.get(c.sceneIndex) ?? [];
      arr.push(c);
      notesByScene.set(c.sceneIndex, arr);
    }
    if (c.reactionType && c.userId === currentUserId) {
      reactionByScene.set(c.sceneIndex, c.reactionType);
    }
  }

  async function saveNote(blockIndex: number, sceneIndex: number, text: string) {
    if (submitting) return;
    setSubmitting(true);
    setOpenNoteBlockIndex(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sceneIndex, audioTimestampMs: currentTimeMs ?? null }),
      });
      if (res.ok) {
        const json = await res.json() as { comment: NoteComment };
        setComments((prev) => [...prev, json.comment]);
        onCommentAdded?.(json.comment);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function saveReaction(sceneIndex: number, reactionType: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType, sceneIndex }),
      });
      if (res.ok) {
        const json = await res.json() as { comment: NoteComment };
        // Remove old reaction for this scene from current user, add new
        setComments((prev) => [
          ...prev.filter(
            (c) => !(c.sceneIndex === sceneIndex && c.reactionType && c.userId === currentUserId)
          ),
          json.comment,
        ]);
        onCommentAdded?.(json.comment);
      }
    } catch { /* non-fatal */ }
  }

  return (
    <div
      data-testid="screenplay-player"
      data-component="screenplay-player"
      role="region"
      aria-label="Screenplay"
      className="font-mono text-sm leading-relaxed space-y-0.5 px-2"
    >
      {blocks.map((block, i) => {
        const sceneNotes = notesByScene.get(block.sceneIndex) ?? [];
        const hasNote = sceneNotes.length > 0;
        const currentReaction = reactionByScene.get(block.sceneIndex) ?? null;
        const isHovered = hoverBlockIndex === i;
        const isActive =
          currentTimeMs != null &&
          sceneNotes.some(
            (c) => c.audioTimestampMs != null && Math.abs(c.audioTimestampMs - currentTimeMs) < 5000
          );

        return (
          <div
            key={i}
            className={cn('relative group', {
              'pl-3 border-l-2': hasNote,
              'border-amber-400 dark:border-amber-500': hasNote && !currentReaction,
              'border-green-500': currentReaction === 'like',
              'border-red-500': currentReaction === 'dislike',
              'border-gray-400': currentReaction === 'undecided',
            })}
            onMouseEnter={() => setHoverBlockIndex(i)}
            onMouseLeave={() => setHoverBlockIndex(null)}
          >
            {/* Screenplay block */}
            <p
              data-active={isActive ? 'true' : undefined}
              className={cn(
                'whitespace-pre-wrap transition-colors',
                {
                  'text-center uppercase font-bold mt-4 mb-1 text-foreground':
                    block.type === 'scene-heading',
                  'my-2 text-foreground': block.type === 'action',
                  'text-center uppercase mt-3 mb-0 font-semibold text-foreground':
                    block.type === 'character',
                  'mx-16 text-foreground': block.type === 'dialogue',
                  'mx-12 italic text-muted-foreground': block.type === 'parenthetical',
                  'text-right uppercase text-muted-foreground my-1': block.type === 'transition',
                  'bg-violet-100 dark:bg-violet-900/20 rounded': isActive,
                }
              )}
            >
              {block.text}
            </p>

            {/* Note indicator */}
            {hasNote && (
              <span
                data-testid="note-indicator"
                data-has-note="true"
                title={`${sceneNotes.length} note${sceneNotes.length > 1 ? 's' : ''}`}
                className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-400 dark:bg-amber-500 flex items-center justify-center cursor-pointer"
                onClick={() => onSeekTo?.(sceneNotes[0]?.audioTimestampMs ?? 0)}
              >
                <MessageSquare className="w-2.5 h-2.5 text-white" />
              </span>
            )}

            {/* Hover actions: add note + reaction buttons */}
            {isHovered && (
              <div className="absolute right-0 top-0 flex items-center gap-1 bg-background/90 backdrop-blur-sm border border-border rounded px-1.5 py-0.5 shadow-sm">
                <button
                  data-testid="note-icon"
                  aria-label="Add note"
                  onClick={() => setOpenNoteBlockIndex(i)}
                  className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>

                {/* Scene-level reactions */}
                <ReactionButton
                  icon={<ThumbsUp className="w-3 h-3" />}
                  label="Like"
                  active={currentReaction === 'like'}
                  testId="reaction-like"
                  onClick={() => void saveReaction(block.sceneIndex, 'like')}
                />
                <ReactionButton
                  icon={<ThumbsDown className="w-3 h-3" />}
                  label="Pass"
                  active={currentReaction === 'dislike'}
                  testId="reaction-dislike"
                  onClick={() => void saveReaction(block.sceneIndex, 'dislike')}
                />
                <ReactionButton
                  icon={<HelpCircle className="w-3 h-3" />}
                  label="?"
                  active={currentReaction === 'undecided'}
                  testId="reaction-undecided"
                  onClick={() => void saveReaction(block.sceneIndex, 'undecided')}
                />
              </div>
            )}

            {/* Note popover */}
            {openNoteBlockIndex === i && (
              <NotePopover
                onSave={(text) => void saveNote(i, block.sceneIndex, text)}
                onCancel={() => setOpenNoteBlockIndex(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
