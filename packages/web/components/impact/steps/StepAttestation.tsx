'use client';

import { useState } from 'react';
import { STORY_WORD_LIMIT, STORY_RATE_LIMIT_LABEL } from '@/lib/impact/limits';
import { fmtInt } from '@/lib/format';
import type { WizardState } from '../wizard-state';

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  goNext: () => void;
  goBack: () => void;
}

interface Checkbox {
  id: string;
  label: string;
  required: boolean;
}

const ATTESTATIONS: Checkbox[] = [
  {
    id: 'own_story',
    label: 'I am sharing my own lived, personal experience — not someone else\'s story.',
    required: true,
  },
  {
    id: 'no_commercial',
    label: 'I will not use this program for commercial, promotional, marketing, or business purposes of any kind.',
    required: true,
  },
  {
    id: 'review',
    label:
      'I understand that if I choose to share my story publicly, it will be reviewed by the Story Magic team before appearing in the gallery.',
    required: true,
  },
  {
    id: 'age',
    label: 'I am 18 years of age or older, or I have the written consent of a parent or legal guardian.',
    required: true,
  },
  {
    id: 'terms',
    label:
      'I agree to the Story Magic Impact Program Terms of Use. I understand my story may be used for platform demonstration and outreach with my attribution preferences respected.',
    required: true,
  },
];

export function StepAttestation({ goNext }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const allRequired = ATTESTATIONS.filter(a => a.required).every(a => checked[a.id]);

  function toggle(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="text-4xl">❤️</div>
        <h2 className="text-2xl font-bold text-white">Before you begin</h2>
        <p className="text-zinc-300 text-sm max-w-md mx-auto leading-relaxed">
          The Impact StoryBuilder is a free program for people sharing their genuine personal experiences.
          Please read and agree to each statement below before continuing.
        </p>
      </div>

      {/* Program summary */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-2 text-sm text-zinc-400">
        <p className="text-zinc-300 font-medium text-xs uppercase tracking-wide">Program guidelines</p>
        <ul className="space-y-1.5 list-none">
          <li className="flex items-start gap-2">
            <span className="text-violet-400 flex-shrink-0 mt-0.5">•</span>
            Stories must be your own lived experience. Fiction and third-party accounts are not eligible.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400 flex-shrink-0 mt-0.5">•</span>
            Stories are limited to {fmtInt(STORY_WORD_LIMIT)} words of your own writing.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400 flex-shrink-0 mt-0.5">•</span>
            You may submit {STORY_RATE_LIMIT_LABEL} to keep the program fair for everyone.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400 flex-shrink-0 mt-0.5">•</span>
            This program is for personal, non-commercial use only.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400 flex-shrink-0 mt-0.5">•</span>
            Stories submitted for the public gallery are reviewed before publication.
          </li>
        </ul>
      </div>

      {/* Checkboxes */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Please confirm each of the following</p>
        {ATTESTATIONS.map(attestation => (
          <label
            key={attestation.id}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              checked[attestation.id]
                ? 'border-violet-500/60 bg-violet-900/20'
                : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  checked[attestation.id]
                    ? 'bg-violet-600 border-violet-600'
                    : 'border-zinc-500 bg-transparent'
                }`}
                onClick={() => toggle(attestation.id)}
              >
                {checked[attestation.id] && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span
              className="text-sm text-zinc-300 leading-relaxed"
              onClick={() => toggle(attestation.id)}
            >
              {attestation.label}
            </span>
          </label>
        ))}
      </div>

      {/* CTA */}
      <div className="space-y-3 pt-2">
        <button
          onClick={goNext}
          disabled={!allRequired}
          className="w-full py-3 text-sm font-semibold rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        >
          I agree — start my story →
        </button>
        {!allRequired && (
          <p className="text-xs text-zinc-500 text-center">
            Please check all boxes to continue.
          </p>
        )}
        <p className="text-xs text-zinc-600 text-center leading-relaxed">
          Your agreement is recorded with a timestamp when you submit your story.
          <br />
          This program is completely free. No credit card required.
        </p>
      </div>
    </div>
  );
}
