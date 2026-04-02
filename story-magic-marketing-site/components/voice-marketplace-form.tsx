'use client';

import { useState, FormEvent } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

const VOICE_TYPES = [
  'Male — Bass',
  'Male — Baritone',
  'Male — Tenor',
  'Female — Contralto',
  'Female — Mezzo-Soprano',
  'Female — Soprano',
  'Non-binary / Androgynous',
  'Character / Specialty',
];

const EXPERIENCE_LEVELS = [
  'Hobbyist (no professional credits)',
  'Semi-professional (some paid work)',
  'Professional (regular paid credits)',
  'Studio veteran (5+ years full-time)',
];

const GENRE_OPTIONS = [
  'Drama',
  'Thriller / Horror',
  'Sci-Fi',
  'Comedy',
  'Romance',
  'Action / Adventure',
  'Documentary',
  'Animation / Kids',
];

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function VoiceMarketplaceForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: (fd.get('name') as string).trim(),
      email: (fd.get('email') as string).trim(),
      voiceType: fd.get('voiceType') as string,
      experience: fd.get('experience') as string,
      demoUrl: (fd.get('demoUrl') as string).trim(),
      genres: selectedGenres.join(', '),
      bio: (fd.get('bio') as string).trim(),
      consent: fd.get('consent') as string,
    };

    try {
      // Submit directly from the browser so Formsubmit.co receives the correct
      // Referer / Origin headers (their service is browser-first).
      const res = await fetch('https://formsubmit.co/ajax/talent@storymagicapp.net', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `Voice Marketplace Application — ${payload.name}`,
          _replyto: payload.email,
          _template: 'table',
          _captcha: 'false',
          Name: payload.name,
          Email: payload.email,
          'Voice Type': payload.voiceType,
          'Experience Level': payload.experience,
          'Demo URL': payload.demoUrl || '(none provided)',
          Genres: payload.genres || '(none selected)',
          'Bio / Pitch': payload.bio,
          Source: 'storymagic.servicevision.io/voice-marketplace',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === 'false') {
        setErrorMsg('Submission failed. Please email talent@storymagicapp.net directly.');
        setStatus('error');
      } else {
        setStatus('success');
      }
    } catch {
      setErrorMsg('Network error. Please email talent@storymagicapp.net directly.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-gold-500/15 border border-gold-500/40 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-gold-400" />
        </div>
        <h3 className="text-2xl font-bold mb-3">Application Received!</h3>
        <p className="text-[var(--color-muted-foreground)] max-w-md mx-auto">
          Thanks for applying to the Story Magic Voice Marketplace. Our team reviews all
          applications manually and will be in touch within 5 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Name + Email */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="vm-name" className="block text-sm font-medium mb-2">
            Full Name <span className="text-red-400">*</span>
          </label>
          <input
            id="vm-name"
            name="name"
            type="text"
            required
            placeholder="Jane Smith"
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] text-sm placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/60 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="vm-email" className="block text-sm font-medium mb-2">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input
            id="vm-email"
            name="email"
            type="email"
            required
            placeholder="jane@example.com"
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] text-sm placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/60 transition-colors"
          />
        </div>
      </div>

      {/* Voice type + Experience */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="vm-voiceType" className="block text-sm font-medium mb-2">
            Voice Type <span className="text-red-400">*</span>
          </label>
          <select
            id="vm-voiceType"
            name="voiceType"
            required
            defaultValue=""
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/60 transition-colors appearance-none"
          >
            <option value="" disabled>Select your voice type</option>
            {VOICE_TYPES.map((vt) => (
              <option key={vt} value={vt}>{vt}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="vm-experience" className="block text-sm font-medium mb-2">
            Experience Level <span className="text-red-400">*</span>
          </label>
          <select
            id="vm-experience"
            name="experience"
            required
            defaultValue=""
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/60 transition-colors appearance-none"
          >
            <option value="" disabled>Select your level</option>
            {EXPERIENCE_LEVELS.map((el) => (
              <option key={el} value={el}>{el}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Demo URL */}
      <div>
        <label htmlFor="vm-demoUrl" className="block text-sm font-medium mb-2">
          Demo Reel URL{' '}
          <span className="text-[var(--color-muted-foreground)] font-normal text-xs">(SoundCloud, YouTube, personal site, etc.)</span>
        </label>
        <input
          id="vm-demoUrl"
          name="demoUrl"
          type="url"
          placeholder="https://soundcloud.com/yourname"
          className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] text-sm placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/60 transition-colors"
        />
      </div>

      {/* Genres */}
      <div>
        <p className="text-sm font-medium mb-3">
          Genres You Specialise In{' '}
          <span className="text-[var(--color-muted-foreground)] font-normal text-xs">(select all that apply)</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GENRE_OPTIONS.map((genre) => {
            const checked = selectedGenres.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors text-left ${
                  checked
                    ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                    : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-gold-500/40 hover:text-[var(--color-foreground)]'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bio / Pitch */}
      <div>
        <label htmlFor="vm-bio" className="block text-sm font-medium mb-2">
          Tell Us About Yourself <span className="text-red-400">*</span>
          <span className="text-[var(--color-muted-foreground)] font-normal text-xs ml-2">
            What makes your voice unique? Any notable credits?
          </span>
        </label>
        <textarea
          id="vm-bio"
          name="bio"
          required
          rows={5}
          placeholder="I've been doing voice work for 8 years, specialising in dramatic characters. Credits include..."
          className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] text-sm placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500/60 transition-colors resize-none"
        />
      </div>

      {/* Consent */}
      <div className="flex items-start gap-3">
        <input
          id="vm-consent"
          name="consent"
          type="checkbox"
          value="true"
          required
          className="mt-0.5 w-4 h-4 rounded border border-[var(--color-border)] accent-gold-500 flex-shrink-0"
        />
        <label htmlFor="vm-consent" className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
          I confirm that any voice samples I provide are original recordings of my own voice
          and I have the legal right to submit them. I agree to Story Magic&apos;s{' '}
          <a href="/terms" className="text-gold-400 hover:underline">Terms of Service</a>{' '}
          and understand that marketplace participation is subject to a separate talent agreement.
          <span className="text-red-400 ml-1">*</span>
        </label>
      </div>

      {/* Error */}
      {status === 'error' && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          {errorMsg}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full sm:w-auto px-10 py-3 bg-gold-500 text-black font-bold rounded-lg hover:bg-gold-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {status === 'submitting' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting…
          </>
        ) : (
          'Submit Application'
        )}
      </button>
    </form>
  );
}
