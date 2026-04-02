import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { Heart, Mic2, Shield, Trophy, Users, Building2 } from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.storymagicapp.net';

export const metadata: Metadata = {
  title: 'Impact StoryBuilder — Story Magic',
  description:
    'A free program giving voice to trauma survivors, recovery advocates, and community storytellers — and a way for those who want to help to make it possible.',
  openGraph: {
    title: 'Story Magic Impact — Every voice deserves an audience',
    description: 'Free AI audio memoir program for people who have survived trauma, navigated broken systems, or rebuilt their lives.',
  },
};

const CATEGORIES = [
  { emoji: '⚖️', label: 'Justice & Advocacy', tagline: 'Your fight for fairness changed you.' },
  { emoji: '🏛️', label: 'Navigating the System', tagline: 'The maze no one hands you a map for.' },
  { emoji: '🌱', label: 'Surviving Trauma', tagline: 'You went through something that would have broken most people.' },
  { emoji: '🏠', label: 'Housing & Homelessness', tagline: 'Home is more than a roof.' },
  { emoji: '💪', label: 'Recovery & Resilience', tagline: 'You chose yourself — again and again.' },
  { emoji: '✨', label: 'My Story', tagline: 'Every story matters. Tell it your way.' },
];

const PARTNER_TIERS = [
  { name: 'Community Partner', amount: 'From $500/yr', desc: 'Gallery recognition, impact reports, and acknowledgment in the program.' },
  { name: 'Impact Partner', amount: 'From $2,500/yr', desc: 'Co-branding, dedicated storytelling batch for your community, and quarterly impact calls.' },
  { name: 'Sustaining Partner', amount: 'From $10,000/yr', desc: 'Mission-level partnership, custom programs, and full program sponsorship.' },
];

export default function ImpactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-24 px-4 sm:px-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(76,29,149,0.4) 0%, rgba(10,10,15,0.95) 60%)' }}
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 text-sm font-medium mb-6">
            <Heart className="w-3.5 h-3.5 fill-current" />
            Story Magic Impact Program
          </div>
          <h1 className="text-5xl sm:text-6xl font-black leading-tight mb-6 text-white">
            Every voice deserves{' '}
            <span className="text-violet-400">an audience.</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-4 leading-relaxed">
            Impact StoryBuilder is a free program for people who have survived trauma,
            navigated broken systems, or rebuilt their lives — and who want to share
            their story in their own voice.
          </p>
          <p className="text-base text-gray-500 max-w-xl mx-auto mb-10">
            And for those who want to make that possible, there is a way.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`${APP_URL}/impact`}
              className="px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-base transition-colors shadow-lg shadow-violet-900/30"
            >
              🎙️ Tell your story — free
            </a>
            <a
              href={`${APP_URL}/impact/donate`}
              className="px-8 py-4 rounded-xl border border-[var(--color-border)] hover:border-violet-500 text-[var(--color-foreground)] font-bold text-base transition-all"
            >
              💜 Help make it possible
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-muted)] py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 grid grid-cols-3 gap-6">
          {[
            { value: '100%', label: 'Free for storytellers', sub: 'No cost. No exceptions.' },
            { value: '$100', label: 'Monthly prize drawing', sub: 'For one brave voice.' },
            { value: '6', label: 'Story categories', sub: 'From justice to recovery.' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-black text-violet-500">{s.value}</div>
              <div className="text-sm font-semibold text-[var(--color-foreground)] mt-1">{s.label}</div>
              <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The Mission */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-violet-500 mb-3">The mission</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-6 leading-tight">
                Storytelling has always been{' '}
                <span className="text-violet-500">a human right.</span>
              </h2>
              <div className="space-y-4 text-[var(--color-muted-foreground)] leading-relaxed">
                <p>
                  Professional audio production costs thousands of dollars. That barrier has kept the most
                  important stories — born from real hardship, real survival, real change — from reaching
                  the people who need to hear them most.
                </p>
                <p>
                  Impact StoryBuilder removes that barrier. We use AI voice generation to give every
                  participant — at no cost — a professionally narrated audio story. Their truth.
                  Their words. Their voice.
                </p>
                <p className="text-[var(--color-foreground)] font-medium">
                  Stories that might otherwise disappear into silence become something permanent,
                  shareable, and capable of moving another person to action.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Mic2, title: 'AI-narrated audio', desc: 'Professional voice generation from 50+ premium voices.' },
                { icon: Shield, title: 'Privacy first', desc: 'Anonymous, pseudonymous, or named — your choice entirely.' },
                { icon: Trophy, title: 'Monthly prize', desc: '$100 drawing for one storyteller each month.' },
                { icon: Users, title: 'Community gallery', desc: 'Optional public gallery to inspire others.' },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
                    <div className="w-9 h-9 rounded-lg bg-violet-600/15 flex items-center justify-center mb-3">
                      <Icon className="w-4 h-4 text-violet-500" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                    <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Tell Your Story */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--color-muted)]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-violet-500 mb-3">For storytellers</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              You went through something real.{' '}
              <span className="text-violet-500">Let it be heard.</span>
            </h2>
            <p className="text-[var(--color-muted-foreground)] max-w-xl mx-auto">
              No writing experience. No recording studio. No cost. Just you, your story,
              and the voice we help you find for it.
            </p>
          </div>

          {/* How it works */}
          <div className="grid sm:grid-cols-3 gap-6 mb-14">
            {[
              { step: '01', emoji: '✍️', title: 'Write in your words', desc: 'Answer a simple prompt. Our AI can expand your draft — but every word stays true to your voice and facts.' },
              { step: '02', emoji: '🎙️', title: 'Choose your narrator', desc: 'Preview your story in different voices before committing. It should feel like you.' },
              { step: '03', emoji: '🌍', title: 'Share and inspire', desc: 'Download your audio. Optionally share in the public gallery — or keep it private. Either way, it is yours.' },
            ].map(item => (
              <div key={item.step} className="relative p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] overflow-hidden">
                <div className="absolute top-3 right-4 text-5xl font-black text-[var(--color-border)] select-none">{item.step}</div>
                <div className="text-3xl mb-4">{item.emoji}</div>
                <h3 className="font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Category grid */}
          <h3 className="text-xl font-bold text-center mb-2">What kind of story do you have?</h3>
          <p className="text-sm text-[var(--color-muted-foreground)] text-center mb-8">Every experience qualifies.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
            {CATEGORIES.map(cat => (
              <a
                key={cat.label}
                href={`${APP_URL}/signup?redirect_url=/impact/build`}
                className="flex flex-col items-start gap-2 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] hover:border-violet-500/60 transition-colors"
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-sm font-semibold">{cat.label}</span>
                <span className="text-xs text-[var(--color-muted-foreground)] leading-snug">{cat.tagline}</span>
              </a>
            ))}
          </div>

          <div className="text-center">
            <a
              href={`${APP_URL}/signup?redirect_url=/impact/build`}
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-base transition-colors shadow-lg shadow-violet-900/20"
            >
              Create a free account and start your story →
            </a>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-3">Free. Always. No credit card required.</p>
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="py-16 px-4 sm:px-6 border-y border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto text-center">
          <blockquote className="text-2xl sm:text-3xl font-light text-[var(--color-foreground)] leading-relaxed italic">
            &ldquo;The most powerful thing you can do for someone who has been silenced
            is hand them a microphone.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">— The belief behind this program</p>
        </div>
      </section>

      {/* Help */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-violet-500 mb-3">For those who want to help</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
              You can be the reason{' '}
              <span className="text-violet-500">someone&apos;s story is heard.</span>
            </h2>
            <p className="text-[var(--color-muted-foreground)] max-w-xl mx-auto">
              Two ways to contribute — as an individual with a gift, or as an organization
              ready to invest in a mission.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Donate */}
            <div className="p-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <div className="text-4xl mb-4">💜</div>
              <h3 className="text-xl font-bold mb-3">Give a gift</h3>
              <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed mb-6">
                A one-time donation directly funds the AI voice generation that makes a story possible.
                $15 covers a full production. $50 funds five. Every dollar goes to the work.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {[
                  { label: '$5', desc: 'One preview' },
                  { label: '$15', desc: 'One full story' },
                  { label: '$25', desc: 'Two storytellers' },
                  { label: '$50', desc: 'Five stories' },
                ].map(opt => (
                  <a
                    key={opt.label}
                    href={`${APP_URL}/impact/donate`}
                    className="p-3 rounded-xl border border-[var(--color-border)] hover:border-violet-500 bg-[var(--color-muted)] transition-all text-left"
                  >
                    <div className="text-base font-bold">{opt.label}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{opt.desc}</div>
                  </a>
                ))}
              </div>
              <a
                href={`${APP_URL}/impact/donate`}
                className="block w-full text-center py-3 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
              >
                Donate to Impact →
              </a>
              <p className="text-xs text-[var(--color-muted-foreground)] text-center mt-3">
                Processed by Stripe. Voluntary gift — not tax-deductible.
              </p>
            </div>

            {/* Partner */}
            <div className="p-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-xl font-bold mb-3">Become a partner</h3>
              <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed mb-6">
                Nonprofits, foundations, and CSR programs can formally partner with Impact StoryBuilder.
                Partners receive gallery recognition, co-branding, and direct visibility into impact.
              </p>
              <div className="space-y-3 mb-6">
                {PARTNER_TIERS.map(tier => (
                  <div key={tier.name} className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">{tier.name}</span>
                      <span className="text-xs text-violet-500 font-medium">{tier.amount}</span>
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">{tier.desc}</p>
                  </div>
                ))}
              </div>
              <a
                href={`${APP_URL}/impact/partners`}
                className="block w-full text-center py-3 px-6 rounded-xl border border-[var(--color-border)] hover:border-violet-500 font-semibold text-sm transition-all"
              >
                Explore partnership →
              </a>
            </div>
          </div>

          {/* What support does */}
          <div
            className="rounded-2xl border border-violet-500/20 p-8"
            style={{ background: 'linear-gradient(135deg, rgba(76,29,149,0.15) 0%, transparent 100%)' }}
          >
            <h3 className="font-bold text-center mb-6">What your support actually does</h3>
            <div className="grid sm:grid-cols-2 gap-5">
              {[
                { icon: '🎙️', title: 'Covers production costs', desc: 'AI voice generation and cloud storage for each story. Every dollar goes directly to infrastructure.' },
                { icon: '🏆', title: 'Funds the prize drawing', desc: 'Monthly $100 cash prize to one storyteller — a tangible thank-you for the courage to share.' },
                { icon: '🌱', title: 'Keeps it free, forever', desc: 'Without support, the program cannot remain free. Your gift is what makes "no cost, no exceptions" possible.' },
                { icon: '📢', title: 'Expands outreach', desc: 'Enables partnership with shelters, recovery centers, and legal aid organizations to reach those who need this most.' },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <div className="text-sm font-semibold mb-1">{item.title}</div>
                    <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 sm:px-6 bg-[var(--color-muted)] border-t border-[var(--color-border)]">
        <div className="max-w-2xl mx-auto text-center">
          <Building2 className="w-8 h-8 text-violet-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Want to learn more?</h2>
          <p className="text-[var(--color-muted-foreground)] text-sm mb-6">
            Hear the community stories, meet our technology partners, or start your own story today.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`${APP_URL}/impact/stories`}
              className="px-6 py-3 rounded-xl border border-[var(--color-border)] hover:border-violet-500 font-semibold text-sm transition-all"
            >
              Listen to the gallery →
            </a>
            <a
              href={`${APP_URL}/impact/partners`}
              className="px-6 py-3 rounded-xl border border-[var(--color-border)] hover:border-violet-500 font-semibold text-sm transition-all"
            >
              Technology partners →
            </a>
            <a
              href={`${APP_URL}/impact`}
              className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
            >
              Enter the program →
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
