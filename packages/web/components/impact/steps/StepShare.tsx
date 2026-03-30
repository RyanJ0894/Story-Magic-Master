'use client';

import type { WizardState } from '../wizard-state';

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  goNext: () => void;
  goBack: () => void;
}

export function StepShare({ state, update, goNext, goBack }: Props) {
  async function saveAndContinue() {
    if (state.storyId) {
      await fetch(`/api/impact/stories/${state.storyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublic: state.isPublic,
          prizeEligible: state.prizeEligible,
          authorName: state.authorName || null,
          authorCity: state.authorCity || null,
        }),
      }).catch(() => {});
    }
    goNext();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Share your story</h2>
        <p className="text-zinc-400 mt-1 text-sm">
          Your story belongs to you. Choose what you are comfortable sharing.
        </p>
      </div>

      {/* Sharing toggle */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
        <label className="flex items-start gap-4 cursor-pointer">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={state.isPublic}
              onChange={e => update({ isPublic: e.target.checked })}
              className="sr-only"
            />
            <div
              onClick={() => update({ isPublic: !state.isPublic })}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${state.isPublic ? 'bg-violet-600' : 'bg-zinc-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${state.isPublic ? 'translate-x-5.5' : 'translate-x-0.5'}`} style={{ marginLeft: state.isPublic ? '22px' : '2px' }} />
            </div>
          </div>
          <div>
            <p className="font-medium text-white text-sm">Share in the public gallery</p>
            <p className="text-zinc-400 text-xs mt-0.5">
              Your story will appear in the Story Magic Impact gallery after review. Others can listen and be inspired.
            </p>
          </div>
        </label>

        {state.isPublic && (
          <>
            <hr className="border-zinc-700" />
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Display name (optional)
                </label>
                <input
                  type="text"
                  value={state.authorName}
                  onChange={e => update({ authorName: e.target.value })}
                  placeholder="e.g. Maria G. or Anonymous"
                  maxLength={60}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 text-sm"
                />
                <p className="text-xs text-zinc-500 mt-1">Leave blank to be listed as &ldquo;Anonymous&rdquo;</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  City / Region (optional)
                </label>
                <input
                  type="text"
                  value={state.authorCity}
                  onChange={e => update({ authorCity: e.target.value })}
                  placeholder="e.g. Los Angeles, CA"
                  maxLength={80}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 text-sm"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Prize drawing */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
        <label className="flex items-start gap-4 cursor-pointer">
          <div className="relative mt-0.5">
            <div
              onClick={() => update({ prizeEligible: !state.prizeEligible })}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${state.prizeEligible ? 'bg-violet-600' : 'bg-zinc-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5`} style={{ marginLeft: state.prizeEligible ? '22px' : '2px' }} />
            </div>
          </div>
          <div>
            <p className="font-medium text-white text-sm">Enter the $100 monthly prize drawing</p>
            <p className="text-zinc-400 text-xs mt-0.5">
              Each month we draw one story author to receive $100 as a thank-you for sharing.
              No purchase necessary. Winners selected randomly from completed stories.
            </p>
          </div>
        </label>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={goBack} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">
          ← Back
        </button>
        <button
          onClick={saveAndContinue}
          className="px-6 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
        >
          Create my audio story →
        </button>
      </div>
    </div>
  );
}
