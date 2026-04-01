import Link from 'next/link';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { PricingSection } from '@/components/pricing-section';
import {
  Mic2,
  Music2,
  Volume2,
  BarChart3,
  MessageSquare,
  FileText,
  Upload,
  Wand2,
  Download,
  Star,
  Users,
  Clapperboard,
} from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.storymagicapp.net';

const FEATURES = [
  {
    icon: Mic2,
    title: 'AI Voice Casting',
    description:
      'Intelligent voice selection matches character traits, age, and personality from your script — across 50 to 150+ premium voices depending on your plan.',
  },
  {
    icon: Users,
    title: 'Voice Cloning',
    description:
      'Create custom AI voices trained on your own samples. Pro plans include 3 cloned voices; Creator plans unlock up to 10 for full casting control.',
  },
  {
    icon: Music2,
    title: 'Music & Ambience',
    description:
      'Scene-aware background music and ambient soundscapes automatically scored to match the emotional beats of your story.',
  },
  {
    icon: Volume2,
    title: 'Sound Effects',
    description:
      'Footsteps, doors, weather, props — synchronized sound effects pulled from a 500+ curated library keyed to scene descriptions.',
  },
  {
    icon: Clapperboard,
    title: 'Casting Simulation',
    description:
      'Audition characters with different voice combinations before committing to a final cast. Available on Pro and Creator plans.',
  },
  {
    icon: BarChart3,
    title: 'StoryScore Analysis',
    description:
      'Deep narrative analysis scores pacing, conflict density, dialogue balance, and emotional arcs across your full script.',
  },
  {
    icon: MessageSquare,
    title: 'Story Adviser',
    description:
      'AI-driven editorial feedback on character arcs, structural issues, and scene-level improvements grounded in your corpus.',
  },
  {
    icon: FileText,
    title: 'Export Reports',
    description:
      'Production-ready exports: broadcast-quality M4A audio, PDF production notes, and character voice breakdowns.',
  },
];

const STEPS = [
  {
    icon: Upload,
    step: '01',
    title: 'Upload Your Script',
    description:
      'Paste your screenplay or upload a PDF — up to 150 pages. We parse scenes, dialogue, and action lines automatically.',
  },
  {
    icon: Wand2,
    step: '02',
    title: 'AI Directs',
    description:
      'Our Director agent assigns voices, selects music, scores ambience, and validates the full production timeline.',
  },
  {
    icon: Download,
    step: '03',
    title: 'Download Audio',
    description:
      'Receive broadcast-quality M4A at EBU R128 -16 LUFS — ready for production, pitch, or review.',
  },
];

const STATS = [
  { value: '500+', label: 'Scripts Produced' },
  { value: '150 Pages', label: 'Supported' },
  { value: 'EBU R128', label: 'Broadcast Standard' },
  { value: '99.9%', label: 'Uptime' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Nav />

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-32 pb-24 relative overflow-hidden min-h-[75vh]">
        {/* Cinema background image */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/hero-cinema.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Dark overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(10,10,15,0.75) 0%, rgba(10,10,15,0.65) 50%, rgba(10,10,15,0.92) 100%)',
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-400 text-sm font-medium mb-6">
            <Star className="w-3.5 h-3.5 fill-current" />
            Powered by Our AI Director
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight text-white">
            Transform Scripts into{' '}
            <span className="text-gold-400">Cinematic Audio</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Upload your screenplay and hear it come alive with realistic AI voices, ambient
            soundscapes, and cinematic music. Before it&apos;s ever filmed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`${APP_URL}/signup`}
              className="px-8 py-3 bg-gold-500 text-black font-bold rounded-lg hover:bg-gold-600 transition-colors"
            >
              Get Started Free
            </a>
            <Link
              href="/pricing"
              className="px-8 py-3 border border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              See Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-muted)] py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs text-[var(--color-muted-foreground)] mb-6 uppercase tracking-widest font-medium">
            Trusted by filmmakers and studios
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-brand-500">{s.value}</div>
                <div className="text-sm text-[var(--color-muted-foreground)] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-[var(--color-muted-foreground)] max-w-xl mx-auto">
              From script to broadcast-quality audio in three steps.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.step}
                  className="flex flex-col items-center text-center p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
                >
                  <div className="w-14 h-14 rounded-full bg-brand-600/15 flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6 text-brand-500" />
                  </div>
                  <div className="text-xs font-semibold text-brand-500 mb-2 tracking-widest">
                    {step.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
                  <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4 sm:px-6 bg-[var(--color-muted)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-[var(--color-muted-foreground)] max-w-xl mx-auto">
              A complete AI production studio built into one platform.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] hover:border-brand-600/40 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-600/15 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-brand-500" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple Pricing</h2>
            <p className="text-[var(--color-muted-foreground)] max-w-xl mx-auto">
              Start free, scale when you&apos;re ready. 7-day trial on all paid plans.
            </p>
          </div>
          <PricingSection compact showEnterpriseRow={false} />
          <div className="text-center mt-8">
            <Link
              href="/pricing"
              className="text-brand-500 hover:text-brand-400 text-sm font-medium transition-colors"
            >
              View full pricing details →
            </Link>
          </div>
        </div>
      </section>

      {/* Voice Actor Section */}
      <section className="py-24 px-4 sm:px-6 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(44,20,90,0.9) 0%, rgba(10,10,15,0.95) 100%)',
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-400 text-sm font-medium mb-6">
            <Star className="w-3.5 h-3.5 fill-current" />
            Voice Actor Opportunity
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-white">
            Are You a Voice Actor?
          </h2>
          <p className="text-lg text-gray-300 mb-6 max-w-xl mx-auto">
            License your voice to the Story Magic Voice Marketplace and earn passive income every
            time your AI voice is cast in a production. We handle the technology — you collect
            royalties.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-10">
            <div className="text-center">
              <div className="text-3xl font-bold text-gold-400">15%</div>
              <div className="text-sm text-gray-400 mt-1">Revenue Share</div>
            </div>
            <div className="hidden sm:block w-px bg-white/10" />
            <div className="text-center">
              <div className="text-3xl font-bold text-gold-400">$2.50</div>
              <div className="text-sm text-gray-400 mt-1">Avg. Per Use</div>
            </div>
            <div className="hidden sm:block w-px bg-white/10" />
            <div className="text-center">
              <div className="text-3xl font-bold text-gold-400">∞</div>
              <div className="text-sm text-gray-400 mt-1">Passive Income</div>
            </div>
          </div>
          <a
            href={`${APP_URL}/voice-marketplace`}
            className="inline-block px-8 py-3 bg-gold-500 text-black font-bold rounded-lg hover:bg-gold-600 transition-colors"
          >
            Apply to Join the Marketplace
          </a>
        </div>
      </section>

      {/* Impact StoryBuilder */}
      <section className="py-24 px-4 sm:px-6 border-t border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-500 text-xs font-semibold mb-5 uppercase tracking-widest">
                💜 Impact Program
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
                Every voice deserves{' '}
                <span className="text-violet-500">an audience.</span>
              </h2>
              <p className="text-[var(--color-muted-foreground)] mb-6 leading-relaxed">
                Impact StoryBuilder is our free program for trauma survivors, recovery advocates,
                and community voices. We use AI to help them write, narrate, and share their
                personal stories — at no cost, ever.
              </p>
              <div className="flex flex-col gap-3 mb-6">
                {[
                  '100% free for all participants',
                  'AI voice narration in their own style',
                  'Optional public gallery + monthly $100 prize drawing',
                  'Privacy controls — anonymous, pseudonymous, or named',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
                    <span className="text-violet-500 font-bold">♦</span>
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/impact"
                  className="px-6 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-colors text-center"
                >
                  Learn about Impact →
                </Link>
                <a
                  href={`${APP_URL}/impact/donate`}
                  className="px-6 py-3 rounded-lg border border-[var(--color-border)] hover:border-violet-500 font-semibold text-sm transition-all text-center"
                >
                  Support a storyteller
                </a>
              </div>
            </div>
            <div
              className="rounded-2xl p-8 border border-violet-500/20 flex flex-col gap-6"
              style={{ background: 'linear-gradient(135deg, rgba(76,29,149,0.2) 0%, rgba(10,10,15,0.6) 100%)' }}
            >
              <blockquote className="text-xl font-light text-[var(--color-foreground)] leading-relaxed italic">
                &ldquo;The most powerful thing you can do for someone who has been silenced
                is hand them a microphone.&rdquo;
              </blockquote>
              <div className="border-t border-violet-500/20 pt-6 grid grid-cols-3 gap-4 text-center">
                {[
                  { value: '100%', label: 'Free' },
                  { value: '$100', label: 'Monthly prize' },
                  { value: '6', label: 'Categories' },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-2xl font-black text-violet-500">{s.value}</div>
                    <div className="text-xs text-[var(--color-muted-foreground)] mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              <a
                href={`${APP_URL}/impact/stories`}
                className="text-center text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Listen to the community story gallery →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 px-4 sm:px-6 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(109,40,217,0.15) 100%)',
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Start your first script today
          </h2>
          <p className="text-[var(--color-muted-foreground)] mb-8 text-lg">
            Join filmmakers and studios already using Story Magic to produce cinematic audio at
            scale.
          </p>
          <a
            href={`${APP_URL}/signup`}
            className="inline-block px-10 py-4 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 transition-colors text-lg"
          >
            Get Started Free
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
