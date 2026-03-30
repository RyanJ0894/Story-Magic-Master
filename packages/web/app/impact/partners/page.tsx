'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PARTNER_TIERS, TARGET_PARTNERS } from '@/lib/impact/partners';

export default function PartnersPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    contactName: '',
    contactEmail: '',
    tier: '',
    message: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/impact/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <Link href="/impact" className="text-zinc-400 hover:text-white text-sm">← Impact</Link>
        <span className="text-zinc-700">|</span>
        <h1 className="text-sm font-semibold text-white">Corporate Partner Program</h1>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-16">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-extrabold text-white">
            Partner with a program that{' '}
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              actually changes lives.
            </span>
          </h2>
          <p className="text-zinc-300 text-base max-w-2xl mx-auto leading-relaxed">
            The Story Magic Impact program gives trauma survivors, housing advocates, and recovery voices
            the tools to tell their stories through professional AI-narrated audio — free of charge.
          </p>
          <p className="text-zinc-400 text-sm max-w-xl mx-auto">
            Your company&apos;s support makes every story possible. In return, you get meaningful brand association,
            co-branding rights, and ESG reporting materials that demonstrate real-world impact.
          </p>
        </div>

        {/* Tiers */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white text-center">Sponsorship Tiers</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PARTNER_TIERS.map(tier => (
              <div
                key={tier.id}
                className={`relative rounded-2xl border p-6 space-y-4 ${
                  tier.featured
                    ? 'border-violet-500 bg-violet-900/20 ring-1 ring-violet-500/30'
                    : 'border-zinc-700 bg-zinc-900'
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-violet-600 text-white">
                      Most popular
                    </span>
                  </div>
                )}
                <div>
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${tier.badgeColor} mb-2`}>
                    {tier.name}
                  </div>
                  <div className="text-2xl font-bold text-white">
                    ${tier.annualAmount.toLocaleString()}
                    <span className="text-sm font-normal text-zinc-400">/year</span>
                  </div>
                  <p className="text-zinc-400 text-xs mt-1">{tier.tagline}</p>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed">{tier.description}</p>
                <ul className="space-y-1.5">
                  {tier.benefits.map(b => (
                    <li key={b} className="flex items-start gap-2 text-xs text-zinc-300">
                      <span className="text-violet-400 mt-0.5 flex-shrink-0">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-700/50">
                  Funds approx. <strong className="text-zinc-300">{tier.storiesPerYear} stories</strong> per year
                </div>
                <button
                  onClick={() => {
                    setForm(f => ({ ...f, tier: tier.id }));
                    document.getElementById('partner-form')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                >
                  Become a partner
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Target partners section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Why technology companies partner with us</h3>
          <p className="text-zinc-400 text-sm">
            Our tools run on AI infrastructure. When ElevenLabs voices a story, when Render serves the audio,
            when Claude expands a narrative — your platform is the reason that story exists.
            Partnership formalizes what&apos;s already true.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {TARGET_PARTNERS.map(partner => (
              <div key={partner.name} className="flex items-start gap-3 p-3 bg-zinc-800 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-white">{partner.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{partner.reason}</p>
                  <p className="text-xs text-violet-400 mt-1">
                    Suggested tier: {PARTNER_TIERS.find(t => t.id === partner.suggestedTier)?.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact form */}
        <div id="partner-form" className="max-w-xl mx-auto">
          <h3 className="text-xl font-bold text-white text-center mb-6">Start the conversation</h3>
          {submitted ? (
            <div className="text-center space-y-3 py-8">
              <div className="text-4xl">✅</div>
              <p className="text-white font-semibold">Thank you for your interest!</p>
              <p className="text-zinc-400 text-sm">
                We&apos;ll be in touch within 2 business days to discuss how we can partner.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Company name *</label>
                <input
                  required
                  type="text"
                  value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Your name</label>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Email address *</label>
                <input
                  required
                  type="email"
                  value={form.contactEmail}
                  onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Tier of interest *</label>
                <select
                  required
                  value={form.tier}
                  onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="">Select a tier…</option>
                  {PARTNER_TIERS.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} (${t.annualAmount.toLocaleString()}/year)
                    </option>
                  ))}
                  <option value="custom">Custom / In-kind partnership</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Message (optional)</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={4}
                  placeholder="Tell us about your company&apos;s social impact goals or any questions you have."
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 text-sm font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-colors"
              >
                {submitting ? 'Sending…' : 'Get in touch'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
