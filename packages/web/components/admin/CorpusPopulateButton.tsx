'use client';

import { useState } from 'react';

export function CorpusPopulateButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handlePopulate() {
    setState('loading');
    try {
      const res = await fetch('/api/admin/corpus/populate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unknown error');
      setMessage(data.message ?? 'Done');
      setState('done');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed');
      setState('error');
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handlePopulate}
        disabled={state === 'loading'}
        className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white border border-violet-600 transition-colors"
      >
        {state === 'loading' ? 'Populating…' : 'Populate Missing Embeddings'}
      </button>
      {message && (
        <span className={`text-xs ${state === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </span>
      )}
    </div>
  );
}
