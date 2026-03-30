'use client';

import { useState, useCallback, useEffect } from 'react';
import { INITIAL_WIZARD_STATE, WIZARD_STEPS, STEP_LABELS, stepIndex, nextStep, prevStep, type WizardState, type WizardStep } from './wizard-state';
import { StepAttestation } from './steps/StepAttestation';
import { StepCategory } from './steps/StepCategory';
import { StepWrite } from './steps/StepWrite';
import { StepVoice } from './steps/StepVoice';
import { StepPreview } from './steps/StepPreview';
import { StepShare } from './steps/StepShare';
import { StepProduce } from './steps/StepProduce';

/** Generate or retrieve an anonymous session ID stored in localStorage */
function getOrCreateSessionId(): string {
  try {
    const key = 'impact_session_id';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    // SSR or private browsing — generate ephemeral ID
    return crypto.randomUUID();
  }
}

function ProgressBar({ step }: { step: WizardStep }) {
  // Only render for numbered steps (attest returns -1 from stepIndex)
  const current = stepIndex(step);
  if (current < 0) return null;

  const total = WIZARD_STEPS.length;
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-2">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s} className="flex flex-col items-center gap-1" style={{ width: `${100 / total}%` }}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              i < current ? 'bg-violet-600 text-white' :
              i === current ? 'bg-violet-500 text-white ring-2 ring-violet-300' :
              'bg-zinc-800 text-zinc-500'
            }`}>
              {i < current ? '✓' : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === current ? 'text-violet-300 font-medium' : 'text-zinc-500'}`}>
              {STEP_LABELS[s]}
            </span>
          </div>
        ))}
      </div>
      <div className="h-1 bg-zinc-800 rounded-full">
        <div
          className="h-full bg-violet-500 rounded-full transition-all duration-500"
          style={{ width: `${(current / (total - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function StoryBuilderWizard() {
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE);

  // Initialize sessionId from localStorage on mount (client only)
  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    setState(prev => ({ ...prev, sessionId }));
  }, []);

  const update = useCallback((patch: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  const goNext = useCallback(() => {
    const next = nextStep(state.step);
    if (next) update({ step: next });
  }, [state.step, update]);

  const goBack = useCallback(() => {
    const prev = prevStep(state.step);
    if (prev) update({ step: prev });
  }, [state.step, update]);

  const stepProps = { state, update, goNext, goBack };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <ProgressBar step={state.step} />

      {state.step === 'attest'   && <StepAttestation {...stepProps} />}
      {state.step === 'category' && <StepCategory    {...stepProps} />}
      {state.step === 'write'    && <StepWrite        {...stepProps} />}
      {state.step === 'voice'    && <StepVoice        {...stepProps} />}
      {state.step === 'preview'  && <StepPreview      {...stepProps} />}
      {state.step === 'share'    && <StepShare        {...stepProps} />}
      {state.step === 'produce'  && <StepProduce      {...stepProps} />}
    </div>
  );
}
