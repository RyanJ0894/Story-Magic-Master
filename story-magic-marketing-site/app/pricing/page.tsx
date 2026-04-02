import type { Metadata } from 'next';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { PricingSection } from '@/components/pricing-section';
import { TIERS } from '@/lib/pricing-data';
import { CheckCircle2, XCircle } from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.storymagicapp.net';

export const metadata: Metadata = {
  title: 'Pricing — Story Magic',
  description:
    'Simple, transparent pricing for every production scale. Free to start, 7-day trial on paid plans.',
};

const COMPARE_FEATURES = [
  { label: 'Scripts per month', key: 'scripts' },
  { label: 'Pages per script', key: 'pages' },
  { label: 'Voice library', key: 'voices' },
  { label: 'Voice cloning', key: 'cloning' },
  { label: 'Music library', key: 'music' },
  { label: 'SFX library', key: 'sfx' },
  { label: 'Audio export formats', key: 'export' },
  { label: 'Project storage', key: 'storage' },
  { label: 'Commercial use rights', key: 'commercial' },
  { label: 'Priority processing', key: 'priority' },
  { label: 'Collaboration', key: 'collab' },
  { label: 'Casting simulation', key: 'casting' },
  { label: 'White-label audio', key: 'whitelabel' },
  { label: 'StoryScore analysis', key: 'storyscore' },
  { label: 'Story Adviser', key: 'adviser' },
];

const COMPARE_DATA: Record<string, Record<string, string | boolean>> = {
  free: {
    scripts: '1 / month',
    pages: 'Up to 150',
    voices: '50+ standard',
    cloning: false,
    music: '100+ tracks',
    sfx: 'Full library',
    export: 'M4A',
    storage: '7 days',
    commercial: false,
    priority: false,
    collab: false,
    casting: false,
    whitelabel: false,
    storyscore: false,
    adviser: false,
  },
  starter: {
    scripts: '5 / month',
    pages: 'Up to 150',
    voices: '50+ standard',
    cloning: false,
    music: '100+ tracks',
    sfx: 'Full library',
    export: 'M4A + MP3',
    storage: '30 days',
    commercial: false,
    priority: false,
    collab: false,
    casting: false,
    whitelabel: false,
    storyscore: false,
    adviser: false,
  },
  pro: {
    scripts: '15 / month',
    pages: 'Up to 150',
    voices: '100+ premium',
    cloning: '3 voices',
    music: '300+ tracks',
    sfx: '500+ effects',
    export: 'M4A + MP3 + WAV',
    storage: '90 days',
    commercial: true,
    priority: '2× faster',
    collab: 'Up to 3 people',
    casting: false,
    whitelabel: false,
    storyscore: true,
    adviser: false,
  },
  creator: {
    scripts: 'Unlimited',
    pages: 'Up to 150',
    voices: '150+ premium',
    cloning: '10 voices',
    music: 'Genre packs included',
    sfx: '500+ effects',
    export: 'M4A + MP3 + WAV',
    storage: 'Unlimited',
    commercial: true,
    priority: true,
    collab: 'Real-time rooms',
    casting: true,
    whitelabel: true,
    storyscore: true,
    adviser: true,
  },
};

const ENTERPRISE_TIERS = [
  {
    name: 'Starter Enterprise',
    price: '$2,400 / yr',
    users: '10 users',
    features: [
      'Team management & shared library',
      'Standard voice library',
      'Email support',
      'Basic analytics',
    ],
  },
  {
    name: 'Professional Enterprise',
    price: '$6,000 / yr',
    users: '30 users',
    features: [
      'Premium voice library (50+ voices)',
      'Custom voice cloning (5 voices)',
      'Advanced team analytics',
      'Dedicated account manager',
      'Priority support',
    ],
  },
  {
    name: 'Studio Enterprise',
    price: '$15,000 / yr',
    users: '75 users',
    features: [
      'Unlimited custom voice cloning',
      '24/7 priority support',
      'Enterprise-grade security (SSO)',
      'Dedicated account manager',
      'SLA guarantee',
    ],
  },
  {
    name: 'Enterprise Unlimited',
    price: 'Custom',
    users: '200+ users',
    features: [
      'Custom feature development',
      'Private cloud infrastructure',
      'Advanced compliance (SOC 2, GDPR)',
      'Multiple admin hierarchies',
      'Quarterly business reviews',
    ],
  },
];

const FAQ = [
  {
    q: 'What counts as one script?',
    a: 'Each screenplay you submit for audio generation counts as one script. Re-generating the same script (with different voice settings, for example) does not consume additional quota within the same billing period.',
  },
  {
    q: 'Is there a free trial on paid plans?',
    a: 'Yes — Starter, Pro, and Creator all include a 7-day free trial with full access to that tier\'s features. No credit card is required to start. You\'ll only be charged if you keep the plan after the trial ends.',
  },
  {
    q: 'What audio format do I get?',
    a: 'All plans export broadcast-quality M4A (AAC, 48 kHz, 192 kbps) mastered to EBU R128 −16 LUFS with −1.5 dB true peak. Pro and Creator also include WAV (uncompressed) and MP3 options.',
  },
  {
    q: 'What is voice cloning?',
    a: 'Voice cloning lets you create a custom AI voice from a short audio sample — your own voice, a client\'s voice, or a character reference you record. Cloned voices are private to your account and can be used across any script. Pro includes 3 cloned voices; Creator includes 10.',
  },
  {
    q: 'Do I need commercial use rights?',
    a: 'For personal projects, auditions, rehearsals, and internal pitches, the Free and Starter plans are sufficient. For any audio you distribute, publish, broadcast, or monetise, you need the commercial use rights included in Pro and Creator.',
  },
  {
    q: 'Can I upgrade or downgrade at any time?',
    a: 'Yes. Upgrades take effect immediately. Downgrades take effect at the end of your current billing period.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards via Stripe. Enterprise plans can be invoiced annually.',
  },
  {
    q: 'Is academic pricing available?',
    a: 'Yes — accredited film schools and university programs can apply for the University Program ($1,200–$3,000/yr for up to 30 students). Contact us with your institutional email to apply.',
  },
];

export default function PricingPage() {
  const tierIds = ['free', 'starter', 'pro', 'creator'];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Nav />

      {/* Header */}
      <section className="pt-32 pb-12 px-4 sm:px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
        <p className="text-lg text-[var(--color-muted-foreground)] max-w-xl mx-auto">
          Start free. Scale as you grow. 7-day trial on all paid plans — no credit card required.
        </p>
      </section>

      {/* Pricing cards with toggle */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <PricingSection />
        </div>
      </section>

      {/* Full comparison table */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--color-muted)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Full Feature Comparison</h2>
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                  <th className="text-left py-4 px-6 font-semibold w-52 text-[var(--color-foreground)]">
                    Feature
                  </th>
                  {TIERS.map((t) => (
                    <th
                      key={t.id}
                      className={`py-4 px-4 font-semibold text-center ${
                        t.popular ? 'text-gold-500' : 'text-[var(--color-foreground)]'
                      }`}
                    >
                      {t.name}
                      {t.popular && (
                        <span className="block text-xs font-normal text-gold-500 mt-0.5">
                          Most Popular
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_FEATURES.map((feat, idx) => (
                  <tr
                    key={feat.key}
                    className={`border-b border-[var(--color-border)] ${
                      idx % 2 === 0 ? 'bg-[var(--color-background)]' : 'bg-[var(--color-card)]'
                    }`}
                  >
                    <td className="py-3 px-6 text-[var(--color-muted-foreground)] font-medium">
                      {feat.label}
                    </td>
                    {tierIds.map((tid) => {
                      const val = COMPARE_DATA[tid][feat.key];
                      const isBool = typeof val === 'boolean';
                      return (
                        <td key={tid} className="py-3 px-4 text-center">
                          {isBool ? (
                            val ? (
                              <CheckCircle2 className="w-4 h-4 text-brand-500 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-[var(--color-muted-foreground)] opacity-30 mx-auto" />
                            )
                          ) : (
                            <span className="text-[var(--color-foreground)] text-xs">{val as string}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Price row */}
                <tr className="bg-[var(--color-card)] border-t-2 border-[var(--color-border)]">
                  <td className="py-4 px-6 font-bold text-[var(--color-foreground)]">Monthly price</td>
                  {TIERS.map((t) => (
                    <td key={t.id} className="py-4 px-4 text-center font-bold text-[var(--color-foreground)]">
                      {t.monthlyPrice === 0 ? 'Free' : `$${t.monthlyPrice}/mo`}
                    </td>
                  ))}
                </tr>
                <tr className="bg-[var(--color-card)]">
                  <td className="py-4 px-6 font-bold text-[var(--color-foreground)]">
                    Annual price <span className="text-gold-500 text-xs font-normal">(save 20%)</span>
                  </td>
                  {TIERS.map((t) => (
                    <td key={t.id} className="py-4 px-4 text-center text-[var(--color-muted-foreground)] text-xs">
                      {t.annualMonthlyPrice === 0 ? '—' : `$${t.annualMonthlyPrice}/mo`}
                    </td>
                  ))}
                </tr>
                <tr className="bg-[var(--color-card)] border-t border-[var(--color-border)]">
                  <td className="py-4 px-6" />
                  {TIERS.map((t) => (
                    <td key={t.id} className="py-4 px-4 text-center">
                      <a
                        href={t.href}
                        className={`inline-block px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          t.popular
                            ? 'bg-gold-500 text-black hover:bg-gold-600'
                            : 'border border-[var(--color-border)] hover:bg-[var(--color-muted)]'
                        }`}
                      >
                        {t.cta}
                      </a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Enterprise section */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-3">Enterprise Plans</h2>
            <p className="text-[var(--color-muted-foreground)] max-w-xl mx-auto">
              Team-scale plans from 10 to 200+ users. Annual contracts with SSO, compliance, and
              dedicated support.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {ENTERPRISE_TIERS.map((tier) => (
              <div
                key={tier.name}
                className="p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] flex flex-col"
              >
                <h3 className="font-bold mb-1">{tier.name}</h3>
                <p className="text-xs text-[var(--color-muted-foreground)] mb-2">{tier.users}</p>
                <p className="text-xl font-bold text-brand-500 mb-4">{tier.price}</p>
                <ul className="space-y-2 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
              University Program also available: $1,200–$3,000/yr for accredited film schools (up to
              30 students).
            </p>
            <a
              href="mailto:sales@storymagicapp.net"
              className="inline-block px-8 py-3 border border-[var(--color-border)] font-semibold rounded-lg hover:bg-[var(--color-muted)] transition-colors"
            >
              Contact Sales for Enterprise
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--color-muted)]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]"
              >
                <h3 className="font-semibold mb-2">{item.q}</h3>
                <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to hear your script?</h2>
        <p className="text-[var(--color-muted-foreground)] mb-8">
          Start free — one full script, broadcast quality, no watermark, no credit card.
        </p>
        <a
          href={`${APP_URL}/signup`}
          className="inline-block px-8 py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors"
        >
          Get Started Free
        </a>
      </section>

      <Footer />
    </div>
  );
}
