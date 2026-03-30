'use client';

import { useState, useEffect } from 'react';
import type { WizardState } from '../wizard-state';
import { getCategoryById } from '@/lib/impact/categories';

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  goNext: () => void;
  goBack: () => void;
}

type ProduceStatus = 'idle' | 'queuing' | 'processing' | 'complete' | 'error';

export function StepProduce({ state, goBack }: Props) {
  const [status, setStatus] = useState<ProduceStatus>('idle');
  const [audioUrl, setAudioUrl] = useState(state.audioUrl ?? '');
  const [error, setError] = useState('');
  const cat = getCategoryById(state.category ?? '');

  async function handleProduce() {
    setStatus('queuing');
    setError('');
    try {
      const displayText = state.useExpanded && state.expandedText
        ? state.expandedText
        : state.storyText;

      const res = await fetch('/api/impact/stories/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: state.storyId,
          storyText: displayText,
          voiceId: state.voiceId,
          voiceName: state.voiceName,
          title: state.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Production failed');
      setStatus('processing');
      pollForCompletion(data.jobId ?? data.storyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  }

  function pollForCompletion(id: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/impact/stories/${state.storyId}`);
        const data = await res.json();
        if (data.status === 'complete' && data.audioUrl) {
          setAudioUrl(data.audioUrl);
          setStatus('complete');
          clearInterval(interval);
        } else if (data.status === 'failed') {
          setError('Production failed. Please try again.');
          setStatus('error');
          clearInterval(interval);
        }
      } catch {
        // polling failure — keep trying
      }
    }, 4000);
    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 300_000);
  }

  useEffect(() => {
    if (state.audioUrl) {
      setAudioUrl(state.audioUrl);
      setStatus('complete');
    }
  }, [state.audioUrl]);

  if (status === 'complete') {
    return (
      <div className="space-y-6 text-center">
        <div className="text-5xl">🎉</div>
        <div>
          <h2 className="text-2xl font-bold text-white">Your story is alive.</h2>
          <p className="text-zinc-400 mt-2 text-sm">
            {state.title} has been transformed into audio narrated by {state.voiceName}.
          </p>
        </div>

        <audio controls src={audioUrl} className="w-full" />

        <div className="space-y-3">
          {audioUrl && (
            <a
              href={audioUrl}
              download={`${state.title}.mp3`}
              className="block w-full py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-center transition-colors"
            >
              Download my story audio
            </a>
          )}

          {state.isPublic && (
            <div className="bg-green-900/20 border border-green-700 rounded-xl p-4 text-left">
              <p className="text-green-300 text-sm font-medium">Your story has been submitted for gallery review.</p>
              <p className="text-zinc-400 text-xs mt-1">
                Once approved by our team, it will appear in the Impact gallery for others to hear.
              </p>
            </div>
          )}

          {state.prizeEligible && (
            <div className="bg-violet-900/20 border border-violet-700 rounded-xl p-4 text-left">
              <p className="text-violet-300 text-sm font-medium">You are entered in this month&apos;s $100 prize drawing.</p>
              <p className="text-zinc-400 text-xs mt-1">
                Winners are notified by email. Drawing held the last day of each month.
              </p>
            </div>
          )}

          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <p className="text-xs text-zinc-500 text-center">Share your story with organizations that can help</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {[
                { label: 'SAMHSA Helpline', href: 'https://www.samhsa.gov/find-help/national-helpline' },
                { label: 'National Alliance on Mental Illness', href: 'https://www.nami.org' },
                { label: 'Story Magic Impact Gallery', href: '/impact/stories' },
              ].map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-400 hover:text-violet-300 underline"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'processing' || status === 'queuing') {
    return (
      <div className="text-center space-y-4 py-12">
        <div className="text-4xl animate-pulse">🎙️</div>
        <h2 className="text-xl font-bold text-white">
          {status === 'queuing' ? 'Submitting your story…' : 'Bringing your story to life…'}
        </h2>
        <p className="text-zinc-400 text-sm">
          {state.voiceName} is narrating your story. This takes about 30–60 seconds.
        </p>
        <div className="flex justify-center gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-violet-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-4">{cat?.emoji ?? '✨'}</div>
        <h2 className="text-2xl font-bold text-white">Ready to create your audio story?</h2>
        <p className="text-zinc-400 mt-2 text-sm">
          {state.voiceName} will narrate your story. The full audio production is free for Impact participants.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-400">Story</span>
          <span className="text-white font-medium">{state.title}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Category</span>
          <span className="text-white">{cat?.label}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Voice</span>
          <span className="text-white">{state.voiceName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Gallery</span>
          <span className="text-white">{state.isPublic ? 'Sharing publicly' : 'Private'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Prize draw</span>
          <span className="text-white">{state.prizeEligible ? 'Entered' : 'Not entered'}</span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={goBack} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">
          ← Back
        </button>
        <button
          onClick={handleProduce}
          disabled={status !== 'idle' && status !== 'error'}
          className="px-6 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-colors"
        >
          Create my story audio
        </button>
      </div>
    </div>
  );
}
