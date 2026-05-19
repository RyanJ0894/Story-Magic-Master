'use client';

/**
 * NotesPanel — sidebar listing all notes + reactions for a project.
 * Click any entry to seek audio + scroll screenplay to that moment.
 */

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Trash2, Clock, ThumbsUp, ThumbsDown, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { NoteComment } from './ScreenplayPlayer';

interface NotesPanelProps {
  projectId: string;
  currentUserId: string;
  /** Called when user clicks a note's timestamp */
  onSeekTo?: (ms: number) => void;
  /** New comment added externally (from ScreenplayPlayer) — merge into list */
  newComment?: NoteComment;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

const REACTION_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  like: { icon: <ThumbsUp className="w-3 h-3" />, label: 'Liked', color: 'text-green-600 dark:text-green-400' },
  dislike: { icon: <ThumbsDown className="w-3 h-3" />, label: 'Passed', color: 'text-red-600 dark:text-red-400' },
  undecided: { icon: <HelpCircle className="w-3 h-3" />, label: 'Undecided', color: 'text-muted-foreground' },
};

export function NotesPanel({ projectId, currentUserId, onSeekTo, newComment }: NotesPanelProps) {
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`);
      if (res.ok) {
        const json = await res.json() as { comments: NoteComment[] };
        setComments(json.comments);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  // Merge externally added comments (from ScreenplayPlayer)
  useEffect(() => {
    if (!newComment) return;
    setComments((prev) => {
      // For reactions: replace existing reaction for same user+scene
      if (newComment.reactionType && newComment.sceneIndex != null) {
        const filtered = prev.filter(
          (c) => !(c.sceneIndex === newComment.sceneIndex && c.reactionType && c.userId === currentUserId)
        );
        return [...filtered, newComment];
      }
      return [...prev.filter((c) => c.id !== newComment.id), newComment];
    });
  }, [newComment, currentUserId]);

  async function deleteComment(id: string) {
    if (!window.confirm('Delete this note?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== id));
      } else {
        toast.error('Failed to delete note. Please try again.');
      }
    } catch {
      toast.error('Network error — note not deleted.');
    } finally {
      setDeletingId(null);
    }
  }

  const textNotes = comments.filter((c) => c.text);
  const reactions = comments.filter((c) => c.reactionType && !c.text);

  return (
    <div
      data-testid="notes-panel"
      className="flex flex-col h-full border-l border-border bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          Notes
          {comments.length > 0 && (
            <span className="text-muted-foreground ml-1">({comments.length})</span>
          )}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <p className="text-xs text-muted-foreground px-4 py-3">Loading…</p>}

        {!loading && comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center px-4 py-8">
            Hover over any line to add a note or reaction.
          </p>
        )}

        {/* Text notes */}
        {textNotes.length > 0 && (
          <div className="px-4 py-3 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
            {textNotes.map((c) => (
              <div
                key={c.id}
                data-testid={`note-entry-${c.id}`}
                className="group space-y-1 cursor-pointer"
                onClick={() => c.audioTimestampMs != null && onSeekTo?.(c.audioTimestampMs)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium">{c.user.name}</span>
                  {c.userId === currentUserId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); void deleteComment(c.id); }}
                      disabled={deletingId === c.id}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-opacity disabled:opacity-50"
                      title="Delete note"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {c.audioTimestampMs != null && (
                  <div className="flex items-center gap-1 text-xs text-violet-500">
                    <Clock className="h-3 w-3" />
                    {formatTs(c.audioTimestampMs)}
                    {c.sceneIndex != null && (
                      <span className="text-muted-foreground ml-1">· Scene {c.sceneIndex + 1}</span>
                    )}
                  </div>
                )}
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{c.text}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="px-4 py-3 space-y-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reactions</p>
            {reactions.map((c) => {
              const meta = c.reactionType ? REACTION_META[c.reactionType] : null;
              if (!meta) return null;
              return (
                <div key={c.id} className="flex items-center gap-2 text-xs">
                  <span className={cn('flex items-center gap-1', meta.color)}>
                    {meta.icon}
                    {meta.label}
                  </span>
                  <span className="text-muted-foreground">
                    {c.sceneIndex != null ? `Scene ${c.sceneIndex + 1}` : ''}
                  </span>
                  <span className="text-muted-foreground ml-auto">{c.user.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
