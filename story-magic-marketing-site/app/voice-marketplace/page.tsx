import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { VoiceMarketplaceForm } from '@/components/voice-marketplace-form';
import {
  Mic2,
  DollarSign,
  Shield,
  BarChart3,
  Globe,
  Star,
  CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Voice Marketplace — Story Magic',
  description:
    'License your AI voice to filmmakers and studios worldwide. Earn 15% revenue share — $2.50 avg per use — with no ongoing effort required.',
};

const STATS = [
  { value: '15%', label: 'Revenue Share' },
  { value: '$2.50', label: 'Avg. Per Use' },
  { value: '500+', label: 'Active Productions' },
  { value: '∞', label: 'Passive Income Potential' },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Apply & Record',
    description:
      "Complete the application below. If accepted, we'll send you a short recording script — typically 10–15 minutes of guided studio-quality prompts you can record at home.",
  },
  {
    step: '02',
    title: 'We Train Your AI Voice',
    description:
      'Our team uses your recordings to build a high-fidelity AI voice model. You review and approve the output before it ever goes live on the marketplace.',
  },
  {
    step: '03',
    title: "Earn Every Time You're Cast",
    description:
      'Once published, filmmakers and writers cast your voice in their productions. You earn 15% of the usage fee — automatically, with monthly payouts.',
  },
];

const BENEFITS = [
  {
    icon: DollarSign,
    title: 'Passive Revenue',
    description:
      "Record once and earn indefinitely. Your AI voice works while you sleep, earning $2.50 on average each time it's cast in a production.",
  },
  {
    icon: Shield,
    title: 'You Own Your Voice',
    description:
      'You retain full rights to your voice. We operate under a clear talent agreement — your voice is never used outside the Story Magic platform without your written consent.',
  },
  {
    icon: Globe,
    title: 'Global Reach',
    description:
      'Your voice becomes available to screenwriters, producers, and studios worldwide — without you having to audition, negotiate, or travel.',
  },
  {
    icon: BarChart3,
    title: 'Transparent Analytics',
    description:
      'A dedicated talent dashboard shows every use, every production it appeared in, and your monthly earnings — always in real time.',
  },
  {
    icon: Mic2,
    title: 'Quality First',
    description:
      'We only accept voices that meet our fidelity threshold. Getting accepted means your voice has been validated against broadcast-quality standards.',
  },
  {
    icon: Star,
    title: 'Featured Placement',
    description:
      'Top-performing voices earn featured placement in the marketplace — increasing visibility and casting frequency across new productions.',
  },
];

const REQUIREMENTS = [
  'Access to a quiet recording environment (home studio or treated room)',
  'A condenser or dynamic microphone — USB mics are acceptable for application',
  'Ability to deliver consistent performance across multiple takes',
  'Willingness to provide 10–15 minutes of guided recording prompts',
  'Full ownership or rights to the voice being submitted',
  'Agreement to our talent participation terms',
];

const FAQ = [
  {
    q: 'Do I need professional studio equipment?',
    a: "No. A quiet room and a decent USB microphone are sufficient for your application recording. If accepted, we'll guide you on optimising your setup. We care most about voice quality and consistency, not the gear.",
  },
  {
    q: 'How long does the review process take?',
    a: "We review all applications manually within 5 business days. If your application progresses, we'll contact you with the next steps, including the recording script.",
  },
  {
    q: 'What happens to my voice model if I leave?',
    a: 'You can request removal of your voice model at any time by contacting us. Your model will be taken down from the marketplace within 7 days of your request, and no new productions will be able to cast it.',
  },
  {
    q: 'How often are payouts made?',
    a: 'Payouts are processed monthly via bank transfer or PayPal, provided your balance exceeds $25. Earnings below that threshold roll over to the following month.',
  },
  {
    q: 'Can I submit multiple voice styles?',
    a: "Each application covers one primary voice profile. If you have significantly different character voices you'd like to submit, please note them in your application bio and we'll discuss the options.",
  },
  {
    q: 'Is this open internationally?',
    a: 'Yes — we accept voice talent from anywhere in the world. Payouts are made in USD.',
  },
];

export default function VoiceMarketplacePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Nav />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-32 pb-24 overflow-hidden min-h-[60vh]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/hero-cinema.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(10,10,15,0.80) 0%, rgba(10,10,15,0.65) 40%, rgba(10,10,15,0.92) 100%)',
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-400 text-sm font-medium mb-6">
            <Star className="w-3.5 h-3.5 fill-current" />
            Voice Marketplace
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight text-white">
            Get Paid Every Time{' '}
            <span className="text-gold-400">Your Voice Performs</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            License your AI voice to filmmakers and studios worldwide. Record once — earn
            every time you&apos;re cast in a production.
          </p>
          <a
            href="#apply"
            className="inline-block px-8 py-3 bg-gold-500 text-black font-bold rounded-lg hover:bg-gold-600 transition-colors"
          >
            Apply to Join
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-muted)] py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-bold text-gold-400">{s.value}</div>
                <div className="text-sm text-[var(--color-muted-foreground)] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-[var(--color-muted-foreground)] max-w-xl mx-auto">
              From application to passive income in three straightforward steps.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step) => (
              <div
                key={step.step}
                className="flex flex-col items-center text-center p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
              >
                <div className="w-14 h-14 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center mb-5">
                  <span className="text-gold-400 font-bold text-lg">{step.step}</span>
                </div>
                <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
                <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits grid */}
      <section className="py-24 px-4 sm:px-6 bg-[var(--color-muted)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why Join the Marketplace?</h2>
            <p className="text-[var(--color-muted-foreground)] max-w-xl mx-auto">
              A revenue-sharing platform built to respect voice actors — not exploit them.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] hover:border-gold-500/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-gold-500/15 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-gold-400" />
                  </div>
                  <h3 className="font-semibold mb-2">{b.title}</h3>
                  <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                    {b.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">What We&apos;re Looking For</h2>
            <p className="text-[var(--color-muted-foreground)]">
              We accept a limited number of voices each month to maintain marketplace quality.
            </p>
          </div>
          <div className="p-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <ul className="space-y-4">
              {REQUIREMENTS.map((req) => (
                <li key={req} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-gold-400 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                    {req}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Application form */}
      <section id="apply" className="py-24 px-4 sm:px-6 bg-[var(--color-muted)]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-400 text-sm font-medium mb-4">
              <Mic2 className="w-3.5 h-3.5" />
              Apply Now
            </div>
            <h2 className="text-3xl font-bold mb-4">Voice Talent Application</h2>
            <p className="text-[var(--color-muted-foreground)]">
              Fill in the form below. All applications are reviewed by our team — we aim to
              respond within 5 business days.
            </p>
          </div>
          <div className="p-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
            <VoiceMarketplaceForm />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
              >
                <h3 className="font-semibold mb-2">{item.q}</h3>
                <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(124,58,237,0.08) 100%)',
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to license your voice?
          </h2>
          <p className="text-[var(--color-muted-foreground)] mb-8">
            Applications are open now. Limited spots available each month.
          </p>
          <a
            href="#apply"
            className="inline-block px-10 py-4 bg-gold-500 text-black font-bold rounded-lg hover:bg-gold-600 transition-colors"
          >
            Apply Now — It&apos;s Free
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
