'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const AMOUNTS = [
  { cents: 500,  label: '$5',  desc: 'Covers one story preview' },
  { cents: 1500, label: '$15', desc: 'Helps produce one full story' },
  { cents: 2500, label: '$25', desc: 'Sponsors two storytellers' },
  { cents: 5000, label: '$50', desc: 'Funds five complete stories' },
];

function DonatePageContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === 'true';
  const [selected, setSelected] = useState(1500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDonate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl">💜</div>
          <h1 className="text-2xl font-bold text-white">Thank you.</h1>
          <p className="text-zinc-300 leading-relaxed">
            Your gift helps give someone the tools to tell their story — in their own voice.
            That&apos;s a meaningful thing.
          </p>
          <div className="flex flex-col gap-3 pt-4">
            <Link
              href="/impact/stories"
              className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
            >
              Listen to community stories
            </Link>
            <Link href="/impact" className="text-sm text-zinc-400 hover:text-white transition-colors">
              ← Back to Impact
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <Link href="/impact" className="text-zinc-400 hover:text-white text-sm">← Impact</Link>
        <span className="text-zinc-700">|</span>
        <span className="text-sm font-semibold text-white">Support Impact Stories</span>
      </div>

      <div className="max-w-xl mx-auto px-4 py-12 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="text-5xl">💜</div>
          <h1 className="text-3xl font-extrabold text-white">
            Give the gift of a story.
          </h1>
          <p className="text-zinc-300 text-base leading-relaxed max-w-md mx-auto">
            Every donation funds free access for trauma survivors, recovery advocates,
            and housing-insecure voices to tell their story in professional AI-narrated audio.
          </p>
        </div>

        {/* Impact stats */}
        <div className="grid grid-cols-3 gap-4 py-4 border-y border-zinc-800">
          {[
            { value: '100%', label: 'Free for storytellers' },
            { value: '$100', label: 'Monthly prize drawing' },
            { value: '∞', label: 'Lives it can touch' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Amount selector */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-300 text-center">Choose your gift amount</p>
          <div className="grid grid-cols-2 gap-3">
            {AMOUNTS.map(opt => (
              <button
                key={opt.cents}
                onClick={() => setSelected(opt.cents)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selected === opt.cents
                    ? 'border-violet-500 bg-violet-900/30 ring-1 ring-violet-500/30'
                    : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
                }`}
              >
                <div className="text-lg font-bold text-white">{opt.label}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        <button
          onClick={handleDonate}
          disabled={loading}
          className="w-full py-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-base transition-colors"
        >
          {loading
            ? 'Opening checkout…'
            : `Donate ${AMOUNTS.find(a => a.cents === selected)?.label ?? ''} — Support a Storyteller`}
        </button>
        <p className="text-center text-xs text-zinc-600">
          Processed securely by Stripe. Story Magic is a for-profit company — this is a voluntary gift, not tax-deductible.
        </p>

        {/* What your gift does */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">What your gift does</h3>
          <ul className="space-y-2">
            {[
              'Covers the AI voice generation cost for a complete story',
              'Keeps the Impact program free for every participant',
              'Helps fund the monthly $100 prize drawing for storytellers',
              'Supports outreach to trauma recovery organizations and shelters',
            ].map(item => (
              <li key={item} className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-violet-400 mt-0.5 flex-shrink-0">♦</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center">
          <Link href="/impact/stories" className="text-sm text-violet-400 hover:text-violet-300 underline">
            Listen to the stories your gift makes possible →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DonatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <DonatePageContent />
    </Suspense>
  );
}
