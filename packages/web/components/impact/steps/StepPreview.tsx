'use client';

import { useState } from 'react';
import { getImpactVoiceById } from '@/lib/impact/voices';
import type { WizardState } from '../wizard-state';

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  goNext: () => void;
  goBack: () => void;
}

export function StepPreview({ state, update, goNext, goBack }: Props) {
  const voice = getImpactVoiceById(state.voiceId ?? '');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const displayText = state.useExpanded && state.expandedText
    ? state.expandedText
    : state.storyText;

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      // Re-use the existing generation API by creating a small project with the story text
      const res = await fetch('/api/impact/stories/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: state.storyId,
          storyText: displayText,
          voiceId: state.voiceId,
          voiceName: state.voiceName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      update({ audioUrl: data.audioUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Preview your story</h2>
        <p className="text-zinc-400 mt-1 text-sm">
          Generate a short audio preview narrated by {voice?.name ?? 'your chosen voice'}.
        </p>
      </div>

      {/* Story text preview */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
        <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">
          Story text {state.useExpanded && state.expandedText ? '(AI expanded)' : '(your words)'}
        </p>
        <p className="text-zinc-300 text-sm leading-relaxed line-clamp-6">{displayText}</p>
      </div>

      {/* Voice summary */}
      {voice && (
        <div className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {voice.name[0]}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{voice.name}</p>
            <p className="text-xs text-zinc-400">{voice.tone}</p>
          </div>
          <button
            onClick={goBack}
            className="ml-auto text-xs text-violet-400 hover:text-violet-300"
          >
            Change
          </button>
        </div>
      )}

      {/* Audio player or generate button */}
      {state.audioUrl ? (
        <div className="space-y-3">
          <audio
            controls
            src={state.audioUrl}
            className="w-full"
            onPlay={() => {
              if (state.storyId) {
                fetch(`/api/impact/stories/${state.storyId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ playCount: 1 }),
                }).catch(() => {});
              }
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => update({ audioUrl: null })}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Regenerate with different voice
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-colors"
          >
            {generating ? 'Generating preview…' : 'Generate audio preview'}
          </button>
          <p className="text-xs text-zinc-500 text-center">
            Free for Impact StoryBuilder participants
          </p>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={goBack} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">
          ← Back
        </button>
        <button
          onClick={goNext}
          className="px-6 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
        >
          {state.audioUrl ? 'Looks great →' : 'Skip preview →'}
        </button>
      </div>
    </div>
  );
}
