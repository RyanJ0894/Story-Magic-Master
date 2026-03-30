'use client';

import { IMPACT_VOICES } from '@/lib/impact/voices';
import type { WizardState } from '../wizard-state';

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  goNext: () => void;
  goBack: () => void;
}

export function StepVoice({ state, update, goNext, goBack }: Props) {
  function select(voiceId: string, voiceName: string) {
    update({ voiceId, voiceName });
    if (state.storyId) {
      fetch(`/api/impact/stories/${state.storyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId, voiceName }),
      }).catch(() => {});
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Choose your narrator</h2>
        <p className="text-zinc-400 mt-1 text-sm">
          Each voice has been selected for warmth and authenticity — perfect for personal storytelling.
        </p>
      </div>

      <div className="space-y-3">
        {IMPACT_VOICES.map(voice => (
          <button
            key={voice.id}
            onClick={() => select(voice.id, voice.name)}
            className={`w-full text-left p-4 rounded-xl border transition-all ${
              state.voiceId === voice.id
                ? 'border-violet-500 bg-violet-900/30'
                : 'border-zinc-700 bg-zinc-900 hover:border-violet-600 hover:bg-zinc-800'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{voice.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    voice.gender === 'female'
                      ? 'bg-pink-500/10 text-pink-300 border-pink-500/30'
                      : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                  }`}>
                    {voice.description}
                  </span>
                </div>
                <p className="text-zinc-400 text-xs mt-1">{voice.tone}</p>
              </div>
              {state.voiceId === voice.id && (
                <span className="text-violet-400 text-sm flex-shrink-0">✓ Selected</span>
              )}
            </div>
            <p className="text-zinc-500 text-xs mt-2 italic">&ldquo;{voice.previewText}&rdquo;</p>
          </button>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={goBack} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">
          ← Back
        </button>
        <button
          onClick={goNext}
          disabled={!state.voiceId}
          className="px-6 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white transition-colors"
        >
          Preview →
        </button>
      </div>
    </div>
  );
}
