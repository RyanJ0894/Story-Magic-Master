'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ApproveStoryButton({ storyId }: { storyId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function approve() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/impact/stories/${storyId}/approve`, { method: 'POST' });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) return <span className="text-xs text-green-400 font-medium">✓ Approved</span>;

  return (
    <button
      onClick={approve}
      disabled={loading}
      className="px-3 py-1 text-xs font-medium rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white"
    >
      {loading ? '…' : 'Approve'}
    </button>
  );
}
