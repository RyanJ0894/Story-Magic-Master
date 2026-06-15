'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Trash2, Send, Clock } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Comment {
  id: string;
  body: string;
  sceneIndex?: number | null;
  audioTimestampMs?: number | null;
  createdAt: string;
  userId: string;
  author: { fullName?: string | null; email?: string | null };
}

interface CommentsSidebarProps {
  projectId: string;
  currentUserId: string;
  /** Called when user clicks a timestamp — seek audio to this ms position */
  onSeekTo?: (ms: number) => void;
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
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CommentsSidebar({ projectId, currentUserId, onSeekTo }: CommentsSidebarProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`);
      if (res.ok) {
        const json = await res.json() as { comments: Comment[] };
        setComments(json.comments);
      } else {
        setFetchError('Failed to load comments.');
      }
    } catch {
      setFetchError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      if (res.ok) {
        const comment = await res.json() as Comment;
        setComments((prev) => [...prev, comment]);
        setBody('');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function executeDeleteComment(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== id));
      } else {
        setDeleteError('Failed to delete comment. Please try again.');
      }
    } catch {
      setDeleteError('Connection error. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Comments {comments.length > 0 && <span className="text-muted-foreground">({comments.length})</span>}
        </span>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && fetchError && (
          <p className="text-xs text-destructive text-center py-4">
            {fetchError}{' '}
            <button onClick={() => void load()} className="underline hover:no-underline">Retry</button>
          </p>
        )}
        {!loading && !fetchError && comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            No comments yet. Be the first!
          </p>
        )}
        {deleteError && (
          <p className="text-xs text-destructive text-center py-1">
            {deleteError}{' '}
            <button onClick={() => setDeleteError(null)} className="underline hover:no-underline">Dismiss</button>
          </p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="group space-y-1">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-foreground">
                {c.author.fullName ?? c.author.email ?? 'Unknown'}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {c.userId === currentUserId && (
                  <button
                    onClick={() => setConfirmDeleteId(c.id)}
                    disabled={deletingId === c.id}
                    className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive disabled:opacity-50"
                    title="Delete comment"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {c.audioTimestampMs != null && (
              <button
                onClick={() => onSeekTo?.(c.audioTimestampMs!)}
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
              >
                <Clock className="h-3 w-3" />
                {formatTs(c.audioTimestampMs)}
              </button>
            )}

            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{c.body}</p>

            <p className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</p>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={(e) => void submit(e)} className="p-4 border-t border-border space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
        <button
          type="submit"
          disabled={!body.trim() || submitting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white transition-colors"
        >
          <Send className="h-3 w-3" />
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </form>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete comment?"
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          const id = confirmDeleteId;
          setConfirmDeleteId(null);
          if (id) void executeDeleteComment(id);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
