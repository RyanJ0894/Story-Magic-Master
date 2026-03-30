'use client';

import { IMPACT_CATEGORIES } from '@/lib/impact/categories';
import type { WizardState } from '../wizard-state';

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  goNext: () => void;
  goBack: () => void;
}

export function StepCategory({ state, update, goNext }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">What is your story about?</h2>
        <p className="text-zinc-400 mt-2">
          Choose the theme that best fits your experience. You can always describe it in your own words.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {IMPACT_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              update({ category: cat.id });
              goNext();
            }}
            className={`text-left p-4 rounded-xl border transition-all ${
              state.category === cat.id
                ? 'border-violet-500 bg-violet-900/30'
                : 'border-zinc-700 bg-zinc-900 hover:border-violet-600 hover:bg-zinc-800'
            }`}
          >
            <div className="text-2xl mb-2">{cat.emoji}</div>
            <div className="font-semibold text-white text-sm">{cat.label}</div>
            <div className="text-zinc-400 text-xs mt-1">{cat.tagline}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
