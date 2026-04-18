'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Star, Loader2, CheckCircle } from 'lucide-react';

const VERDICTS = [
  { value: 'pass', label: 'Pass', color: 'text-red-500 border-red-200 bg-red-50 dark:bg-red-900/20' },
  { value: 'consider', label: 'Consider', color: 'text-yellow-600 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20' },
  { value: 'recommend', label: 'Recommend', color: 'text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20' },
  { value: 'strong_recommend', label: 'Strong Recommend', color: 'text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20' },
] as const;

type Verdict = typeof VERDICTS[number]['value'];

interface Props {
  projectId: string;
  onSubmitted?: () => void;
}

export function FeedbackForm({ projectId, onSubmitted }: Props) {
  const [verdict, setVerdict] = useState<Verdict>('consider');
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verdict,
          numeric_rating: rating ?? undefined,
          comment: comment || undefined,
          is_anonymous: anonymous,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to submit review');
      } else {
        setDone(true);
        onSubmitted?.();
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 text-green-600 py-4">
        <CheckCircle className="w-5 h-5" />
        <span className="font-medium">Review submitted — thank you!</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Verdict */}
      <div className="space-y-2">
        <Label>Verdict</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {VERDICTS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setVerdict(v.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                verdict === v.value ? v.color : 'border-border text-muted-foreground hover:border-primary'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Star rating */}
      <div className="space-y-2">
        <Label>Rating (optional)</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(rating === n ? null : n)}
              className="p-0.5 focus-visible:outline-none"
            >
              <Star
                className={`w-6 h-6 transition-colors ${
                  rating !== null && n <= rating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground hover:text-yellow-400'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div className="space-y-2">
        <Label htmlFor="review-comment">Notes for the writer (optional)</Label>
        <Textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What worked? What could be stronger?"
          rows={4}
          maxLength={4000}
        />
        <p className="text-xs text-muted-foreground text-right">{comment.length}/4000</p>
      </div>

      {/* Anonymous toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="anon-toggle" className="cursor-pointer">
          Submit anonymously
        </Label>
        <Switch
          id="anon-toggle"
          checked={anonymous}
          onCheckedChange={setAnonymous}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Submit Review
      </Button>
    </form>
  );
}
