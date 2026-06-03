'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface TeamComment {
  id: string;
  reactionType: string | null;
  body: string | null;
  sceneIndex: number | null;
  createdAt: Date | string;
  author: { fullName: string | null; email: string | null };
  project: { id: string; name: string };
}

interface TeamNotesTabProps {
  initialComments: TeamComment[];
  hasMore: boolean;
}

function timeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function TeamNotesTab({ initialComments, hasMore: initialHasMore }: TeamNotesTabProps) {
  const [comments, setComments] = useState<TeamComment[]>(initialComments);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/enterprise/team-comments?skip=${comments.length}`);
      if (res.ok) {
        const data = await res.json() as { comments: TeamComment[]; hasMore: boolean };
        setComments((prev) => [...prev, ...data.comments]);
        setHasMore(data.hasMore);
      }
    } finally {
      setLoading(false);
    }
  };

  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No notes or reactions yet. Share a project with your team and ask them to annotate the screenplay.
      </p>
    );
  }

  return (
    <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
      {comments.map((comment) => {
        const isReaction = !!comment.reactionType && !comment.body;
        return (
          <div
            key={comment.id}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-sm"
          >
            <span className="text-base leading-none mt-0.5 w-5 text-center flex-shrink-0">
              {isReaction
                ? comment.reactionType === 'like' ? '👍' : comment.reactionType === 'dislike' ? '👎' : '🤔'
                : '📝'}
            </span>

            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {comment.author.fullName ?? comment.author.email ?? 'Team member'}
              </p>
              <p className="text-xs text-muted-foreground">
                <Link href={`/projects/${comment.project.id}`} className="hover:underline font-medium">
                  {comment.project.name}
                </Link>
                {comment.sceneIndex != null && (
                  <> · Scene {comment.sceneIndex + 1}</>
                )}
              </p>
              {comment.body && (
                <p className="text-xs text-foreground/80 mt-0.5 line-clamp-2">{comment.body}</p>
              )}
              {isReaction && (
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{comment.reactionType}</p>
              )}
            </div>

            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
              {timeAgo(comment.createdAt)}
            </span>
          </div>
        );
      })}

      {hasMore && (
        <div className="pt-2 flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => void loadMore()} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
