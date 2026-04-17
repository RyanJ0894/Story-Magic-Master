'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileNav } from '../mobile-nav';
import { Upload, X, Music } from 'lucide-react';

const MAX_AUDIO_MB = 500;
const MAX_AUDIO_BYTES = MAX_AUDIO_MB * 1024 * 1024;
const ACCEPTED_AUDIO = '.mp3,.wav,.ogg,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/x-wav,audio/wave';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VoiceMarketplacePage() {
  const [form, setForm] = useState({ name: '', email: '', role: 'actor' as 'actor' | 'producer' | 'both', notes: '' });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDragging, setAudioDragging] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleAudioFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['mp3', 'wav', 'ogg'].includes(ext ?? '')) {
      toast.error('Please upload an MP3, WAV, or OGG file.');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      toast.error(`File too large. Maximum size is ${MAX_AUDIO_MB} MB.`);
      return;
    }
    setAudioFile(file);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('email', form.email);
      if (form.name) fd.append('name', form.name);
      fd.append('role', form.role);
      if (form.notes) fd.append('notes', form.notes);
      if (audioFile) fd.append('demoAudio', audioFile);

      const res = await fetch('/api/waitlist', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setSubmitted(true);
      toast.success("You're on the list! We'll be in touch.");
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="Story Magic" width={72} height={72} className="rounded-lg" />
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/guide" className="text-sm text-muted-foreground hover:text-foreground transition-colors">User Guide</Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/signup" className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">Get Started</Link>
            <ThemeToggle />
          </div>
          <MobileNav />
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 bg-slate-950 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-slate-950 to-brand-950/40 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Voice Actor Marketplace — Now Accepting Early Members
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            AI That <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-300">Pays</span> Voice Actors<br />
            Instead of Replacing Them
          </h1>
          <p className="text-xl text-slate-300 mb-10 max-w-3xl mx-auto leading-relaxed">
            Story Magic is the first AI audio production platform built around a simple belief:
            voice actors should profit from AI, not compete with it.
            Join our marketplace and earn every time your voice brings a screenplay to life.
          </p>
          <a href="#join" className="inline-block px-10 py-4 bg-amber-500 text-slate-950 font-bold rounded-xl hover:bg-amber-400 transition-colors text-lg shadow-xl shadow-amber-900/40">
            Join the Marketplace
          </a>
        </div>
      </section>

      {/* How it works for actors */}
      <section className="py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works for Voice Actors</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Your voice becomes a digital asset that earns passive income on every production.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: '🎤',
                title: 'Submit Your Voice',
                description: 'Record a short demo reel — a few minutes of dialogue covering emotional range. We handle the rest.',
              },
              {
                step: '02',
                icon: '🤖',
                title: 'AI Clones Your Voice',
                description: 'We create a high-fidelity AI clone of your voice that producers can license for their productions.',
              },
              {
                step: '03',
                icon: '💰',
                title: 'Earn Every Time',
                description: 'Every screenplay produced using your voice earns you a royalty. No auditions. Pure passive income.',
              },
            ].map((item) => (
              <div key={item.step} className="relative bg-card border border-border rounded-xl p-8">
                <div className="absolute -top-4 left-8 px-3 py-1 bg-amber-500 text-slate-950 text-xs font-bold rounded-full">
                  {item.step}
                </div>
                <div className="text-4xl mb-4 mt-2">{item.icon}</div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Revenue share */}
      <section className="py-24 bg-muted">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Real Revenue. Real Actors.</h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                Unlike other AI platforms that train on your voice and pay you nothing,
                Story Magic operates on a transparent revenue share model.
                Your voice, your earnings, your rights.
              </p>
              <div className="space-y-4">
                {[
                  { label: 'Average per use', value: '$2.50', icon: '💵' },
                  { label: 'Actor revenue share', value: '15%', icon: '📊' },
                  { label: 'Your rights retained', value: '100%', icon: '⚖️' },
                  { label: 'Opt-out anytime', value: 'Guaranteed', icon: '🔓' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg">
                    <span className="text-2xl">{item.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                    </div>
                    <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-950 rounded-2xl p-8 text-white">
              <h3 className="text-xl font-semibold text-amber-300 mb-2">What makes this different</h3>
              <p className="text-slate-400 text-sm mb-6">Other AI platforms vs. Story Magic</p>
              <div className="space-y-4">
                {[
                  { other: 'Trains on your voice without consent', us: 'Requires your explicit participation' },
                  { other: 'Pays you nothing after training', us: 'Royalty on every use, forever' },
                  { other: 'Owns your voice clone', us: 'You own it. We license it.' },
                  { other: 'No opt-out once trained', us: 'Revoke access anytime' },
                ].map((row, i) => (
                  <div key={i} className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start gap-2 text-slate-400">
                      <span className="text-red-400 mt-0.5 flex-shrink-0">✕</span>
                      {row.other}
                    </div>
                    <div className="flex items-start gap-2 text-slate-200">
                      <span className="text-amber-400 mt-0.5 flex-shrink-0">✓</span>
                      {row.us}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For producers */}
      <section className="py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">For Producers</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-12">
            Access a curated library of licensed AI voice clones — real actors who consented,
            get paid, and stand behind every performance.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { icon: '🎭', title: 'Authentic Performances', desc: 'Real actor voices with genuine emotional range — not synthetic voice generators.' },
              { icon: '⚖️', title: 'Fully Licensed', desc: 'Every voice clone is consented, contracted, and cleared for commercial use.' },
              { icon: '🚀', title: 'Production-Ready', desc: 'Upload your script and Story Magic casts from the marketplace automatically.' },
            ].map((card) => (
              <div key={card.title} className="bg-card border border-border rounded-xl p-6 text-left">
                <div className="text-3xl mb-3">{card.icon}</div>
                <h3 className="font-semibold mb-2">{card.title}</h3>
                <p className="text-sm text-muted-foreground">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Celebrity voice marketplace coming soon */}
      <section className="py-16 bg-gradient-to-r from-brand-950 to-slate-950 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600/30 border border-brand-500/40 text-brand-300 text-sm font-medium mb-6">
            Coming Soon
          </div>
          <h2 className="text-3xl font-bold mb-4">Celebrity Voice Marketplace</h2>
          <p className="text-slate-300 text-lg">
            Access licensed SAG actor voices and celebrity AI voices for professional productions.
            The same ethical model — real people, real consent, real revenue share.
          </p>
        </div>
      </section>

      {/* Join form */}
      <section id="join" className="py-24 bg-muted">
        <div className="max-w-xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Join the Marketplace</h2>
            <p className="text-muted-foreground">
              Whether you&apos;re a voice actor looking to monetize your talent or a producer
              looking for authentic voices, get early access.
            </p>
          </div>

          {submitted ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-xl font-bold mb-2">You&apos;re on the list!</h3>
              <p className="text-muted-foreground">
                We&apos;ll reach out as soon as the marketplace opens for your role.
                In the meantime, try the platform free.
              </p>
              <Link href="/signup" className="inline-block mt-6 px-8 py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors">
                Try Story Magic Free
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="vm-name">Your Name</label>
                <input
                  id="vm-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Smith"
                  className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="vm-email">Email *</label>
                <input
                  id="vm-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">I am a *</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'actor', label: '🎤 Voice Actor' },
                    { value: 'producer', label: '🎬 Producer' },
                    { value: 'both', label: '✨ Both' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, role: opt.value as 'actor' | 'producer' | 'both' })}
                      className={`py-3 px-2 rounded-lg border text-sm font-medium transition-colors ${
                        form.role === opt.value
                          ? 'border-brand-500 bg-brand-600/10 text-brand-600 dark:text-brand-400'
                          : 'border-border hover:border-brand-400 text-muted-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="vm-notes">
                  Tell us about yourself <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  id="vm-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Union status, experience, genres, production goals..."
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              {/* Audio Demo Upload — voice actors only */}
              {(form.role === 'actor' || form.role === 'both') && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Voice Demo <span className="text-muted-foreground font-normal">(optional — MP3, WAV, or OGG, max 500 MB)</span>
                  </label>
                  {audioFile ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                      <Music className="w-5 h-5 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{audioFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(audioFile.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setAudioFile(null); if (audioInputRef.current) audioInputRef.current.value = ''; }}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        aria-label="Remove file"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setAudioDragging(true); }}
                      onDragLeave={() => setAudioDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setAudioDragging(false); const f = e.dataTransfer.files[0]; if (f) handleAudioFile(f); }}
                      onClick={() => audioInputRef.current?.click()}
                      className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                        audioDragging
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                          : 'border-muted-foreground/25 hover:border-amber-400 hover:bg-muted/50'
                      }`}
                    >
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground text-center">
                        Drop your demo here or <span className="text-amber-600 dark:text-amber-400 font-medium">browse</span>
                      </p>
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept={ACCEPTED_AUDIO}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAudioFile(f); }}
                        onClick={(e) => e.stopPropagation()}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !form.email}
                className="w-full py-3 bg-amber-500 text-slate-950 font-bold rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Joining...' : 'Join the Marketplace'}
              </button>
              <p className="text-xs text-center text-muted-foreground">
                We respect your privacy. No spam, ever. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <Link href="/" className="text-brand-600 hover:text-brand-700 font-medium">← Back to Story Magic</Link>
          <p className="mt-2">&copy; 2026 Story Magic. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
