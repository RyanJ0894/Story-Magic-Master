'use client';

import { useState } from 'react';
import { getCategoryById } from '@/lib/impact/categories';
import type { WizardState } from '../wizard-state';

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  goNext: () => void;
  goBack: () => void;
}

export function StepWrite({ state, update, goNext, goBack }: Props) {
  const cat = getCategoryById(state.category ?? '');
  const [expanding, setExpanding] = useState(false);
  const [expandError, setExpandError] = useState('');
  const [activePrompt, setActivePrompt] = useState<number | null>(null);

  const wordCount = state.storyText.trim().split(/\s+/).filter(Boolean).length;
  const canExpand = wordCount >= 30 && !state.expandedText;
  const canContinue = wordCount >= 30 && state.title.trim().length >= 3;

  async function handleExpand() {
    if (!canExpand) return;
    setExpanding(true);
    setExpandError('');
    try {
      const res = await fetch('/api/impact/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: state.title || 'My Story',
          category: state.category,
          storyText: state.storyText,
          isPublic: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      update({
        storyId: data.id,
        expandedText: data.expandedText ?? null,
        useExpanded: Boolean(data.expandedText),
      });
    } catch (err) {
      setExpandError(err instanceof Error ? err.message : 'Could not expand story');
    } finally {
      setExpanding(false);
    }
  }

  function handleNext() {
    if (canContinue) goNext();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">{cat?.label ?? 'Your Story'}</h2>
        <p className="text-zinc-400 mt-1 italic text-sm">{cat?.tagline}</p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">Story title</label>
        <input
          type="text"
          value={state.title}
          onChange={e => update({ title: e.target.value })}
          placeholder="Give your story a name"
          maxLength={100}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 text-sm"
        />
      </div>

      {/* Writing prompt */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
        <p className="text-zinc-300 text-sm font-medium mb-2">Writing prompt</p>
        <p className="text-zinc-400 text-sm">{cat?.writingPrompt}</p>
        {cat && cat.followUpPrompts.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-zinc-500 text-xs font-medium">You might also explore:</p>
            {cat.followUpPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => setActivePrompt(activePrompt === i ? null : i)}
                className="block text-left text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                {activePrompt === i ? '▾' : '▸'} {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Story textarea */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          Your story{' '}
          <span className={`text-xs font-normal ${wordCount < 30 ? 'text-zinc-500' : 'text-green-400'}`}>
            ({wordCount} words{wordCount < 30 ? ' — keep going' : ''})
          </span>
        </label>
        <textarea
          value={state.storyText}
          onChange={e => update({ storyText: e.target.value, expandedText: null })}
          placeholder="Write in your own words. There's no wrong way to tell your story."
          rows={10}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 text-sm resize-none"
        />
      </div>

      {/* AI expansion */}
      {!state.expandedText ? (
        <div className="flex items-center gap-3">
          <button
            onClick={handleExpand}
            disabled={!canExpand || expanding}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 border border-zinc-600 transition-colors"
          >
            {expanding ? 'Expanding…' : 'Let AI help expand my story'}
          </button>
          <span className="text-xs text-zinc-500">Adds detail while keeping your voice</span>
          {expandError && <span className="text-xs text-red-400">{expandError}</span>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-300">AI-expanded version</span>
            <span className="text-xs text-green-400">Ready</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-sm text-zinc-300 max-h-48 overflow-y-auto leading-relaxed">
            {state.expandedText}
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="textChoice"
                checked={state.useExpanded}
                onChange={() => update({ useExpanded: true })}
                className="accent-violet-500"
              />
              <span className="text-sm text-zinc-300">Use expanded version</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="textChoice"
                checked={!state.useExpanded}
                onChange={() => update({ useExpanded: false })}
                className="accent-violet-500"
              />
              <span className="text-sm text-zinc-300">Keep my original</span>
            </label>
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="flex justify-between pt-2">
        <button
          onClick={goBack}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          disabled={!canContinue}
          className="px-6 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white transition-colors"
        >
          Choose my voice →
        </button>
      </div>
    </div>
  );
}
