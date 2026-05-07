'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ReviewDecisionButton({ reviewId }: { reviewId: string }) {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  async function decide(decision: 'approved' | 'rejected') {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/review-queue/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewerNotes: notes || undefined }),
      });
      if (res.ok) {
        setDone(decision);
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? 'Request failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <span className={`text-xs font-medium ${done === 'approved' ? 'text-green-400' : 'text-red-400'}`}>
        ✓ {done === 'approved' ? 'Approved' : 'Rejected'} — customer notified
      </span>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Reviewer notes (optional — sent to customer)"
        rows={2}
        className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => decide('approved')}
          disabled={loading}
          className="px-4 py-1.5 text-xs font-semibold rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white transition-colors"
        >
          {loading ? 'Saving…' : '✓ Approve'}
        </button>
        <button
          onClick={() => decide('rejected')}
          disabled={loading}
          className="px-4 py-1.5 text-xs font-semibold rounded bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white transition-colors"
        >
          {loading ? 'Saving…' : '✗ Reject'}
        </button>
      </div>
    </div>
  );
}
