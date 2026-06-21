'use client';

/**
 * ProjectReactionBar — Like / Dislike / Undecided at the PROJECT level.
 *
 * 2026-06-21 — Ryan 6/21 item n:
 *   "This feature isn't about selecting whether or not the user likes,
 *    or dislikes a scene or a line. This feature is to select whether
 *    the user likes, dislikes, or is undecided about the script as a
 *    whole. Once a selection has been made, that selection/new status
 *    should show on the script in the Projects section before entering
 *    the specific project as well."
 *
 * Storage uses the existing ProjectComment table with `sceneIndex: null`
 * to mean "project-level reaction." The comments POST route already
 * accepts this shape; PR #345's comments dedup was extended to also
 * upsert on the project-level row so only the latest selection stands.
 *
 * Renders as a toolbar bar at the top of the screenplay reader (NOT a
 * hover affordance on individual scenes). The same component re-renders
 * the current reaction as a status badge on the Projects list — see
 * Projects-list integration in a follow-up PR.
 */

import { useState, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api/fetch';
import { cn } from '@/lib/utils';

export type ProjectReactionType = 'like' | 'dislike' | 'undecided';

export interface ProjectReactionBarProps {
  projectId: string;
  /** Current user's reaction, if any. Hydrated from server data. */
  initialReaction?: ProjectReactionType | null;
  /** Called after a successful save with the new reaction value. */
  onReactionChange?: (reaction: ProjectReactionType | null) => void;
  /** Hide the prompt copy (compact mode for embedded contexts). */
  compact?: boolean;
}

const BUTTON_BASE =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors disabled:opacity-50';

const ACTIVE_STYLES: Record<ProjectReactionType, string> = {
  like:
    'bg-green-100 border-green-400 text-green-700 dark:bg-green-900/30 dark:border-green-600 dark:text-green-300',
  dislike:
    'bg-red-100 border-red-400 text-red-700 dark:bg-red-900/30 dark:border-red-600 dark:text-red-300',
  undecided:
    'bg-gray-100 border-gray-400 text-gray-700 dark:bg-gray-800 dark:border-gray-500 dark:text-gray-300',
};

const INACTIVE_STYLES =
  'bg-transparent border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground';

export function ProjectReactionBar({
  projectId,
  initialReaction = null,
  onReactionChange,
  compact = false,
}: ProjectReactionBarProps) {
  const [reaction, setReaction] = useState<ProjectReactionType | null>(initialReaction);
  const [saving, setSaving] = useState<ProjectReactionType | null>(null);

  useEffect(() => {
    setReaction(initialReaction);
  }, [initialReaction]);

  // Hydrate from server on first mount IF the parent didn't pass an
  // initialReaction. Looks for the user's project-level reaction (the row
  // with sceneIndex == null && reactionType != null) in the existing
  // /comments collection. Cheap, cached client-side after first call.
  // 2026-06-21 — keeps the bar correct on page reloads / direct nav.
  useEffect(() => {
    if (initialReaction !== null && initialReaction !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/projects/${projectId}/comments`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          comments?: Array<{
            sceneIndex: number | null;
            reactionType: string | null;
            userId: string;
          }>;
          currentUserId?: string;
        };
        if (cancelled) return;
        const mine = (data.comments ?? []).find(
          (c) =>
            c.sceneIndex == null &&
            c.reactionType != null &&
            // Either the server narrowed to this user, or we just take the
            // first project-level reaction (single-user-per-project view).
            (data.currentUserId ? c.userId === data.currentUserId : true),
        );
        if (mine?.reactionType && ['like', 'dislike', 'undecided'].includes(mine.reactionType)) {
          setReaction(mine.reactionType as ProjectReactionType);
        }
      } catch {
        // best-effort hydrate — silent failure is acceptable, user can still click
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, initialReaction]);

  const setReactionRemote = useCallback(
    async (next: ProjectReactionType) => {
      setSaving(next);
      try {
        const res = await apiFetch(`/api/projects/${projectId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reactionType: next,
            // sceneIndex is intentionally omitted so the server treats this
            // as a project-level reaction (per the route's 2026-06-21 upsert
            // branch on `sceneIndex == null`).
          }),
        });
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        setReaction(next);
        onReactionChange?.(next);
        toast.success(
          next === 'like'
            ? 'Marked as Liked'
            : next === 'dislike'
              ? 'Marked as Passed'
              : 'Marked as Undecided',
        );
      } catch (err) {
        toast.error('Could not save your reaction — please try again.');
        // log to console for support diagnosis
        // eslint-disable-next-line no-console
        console.error('[ProjectReactionBar] save failed', err);
      } finally {
        setSaving(null);
      }
    },
    [projectId, onReactionChange],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact && (
        <span className="text-sm text-muted-foreground mr-2">
          How do you feel about this script?
        </span>
      )}
      <button
        type="button"
        data-testid="project-reaction-like"
        disabled={saving !== null}
        aria-pressed={reaction === 'like'}
        onClick={() => setReactionRemote('like')}
        className={cn(
          BUTTON_BASE,
          reaction === 'like' ? ACTIVE_STYLES.like : INACTIVE_STYLES,
        )}
      >
        <ThumbsUp className="w-4 h-4" />
        Like
      </button>
      <button
        type="button"
        data-testid="project-reaction-dislike"
        disabled={saving !== null}
        aria-pressed={reaction === 'dislike'}
        onClick={() => setReactionRemote('dislike')}
        className={cn(
          BUTTON_BASE,
          reaction === 'dislike' ? ACTIVE_STYLES.dislike : INACTIVE_STYLES,
        )}
      >
        <ThumbsDown className="w-4 h-4" />
        Pass
      </button>
      <button
        type="button"
        data-testid="project-reaction-undecided"
        disabled={saving !== null}
        aria-pressed={reaction === 'undecided'}
        onClick={() => setReactionRemote('undecided')}
        className={cn(
          BUTTON_BASE,
          reaction === 'undecided' ? ACTIVE_STYLES.undecided : INACTIVE_STYLES,
        )}
      >
        <HelpCircle className="w-4 h-4" />
        Undecided
      </button>
    </div>
  );
}

/**
 * Compact status badge for the Projects list. Shows nothing if the user
 * hasn't reacted yet.
 */
export function ProjectReactionBadge({
  reaction,
}: {
  reaction: ProjectReactionType | null | undefined;
}) {
  if (!reaction) return null;
  const config = {
    like: { label: 'Liked', icon: ThumbsUp, className: ACTIVE_STYLES.like },
    dislike: { label: 'Passed', icon: ThumbsDown, className: ACTIVE_STYLES.dislike },
    undecided: { label: 'Undecided', icon: HelpCircle, className: ACTIVE_STYLES.undecided },
  }[reaction];
  const Icon = config.icon;
  return (
    <span
      data-testid={`project-reaction-badge-${reaction}`}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border',
        config.className,
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
