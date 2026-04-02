import Link from 'next/link';
import { IMPACT_CATEGORIES } from '@/lib/impact/categories';

export const metadata = {
  title: 'Impact StoryBuilder — Story Magic',
  description:
    'A free program giving voice to trauma survivors, recovery advocates, and community storytellers. And a way for those who want to help, to help.',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-widest uppercase text-violet-400 mb-3">
      {children}
    </p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
      {children}
    </h2>
  );
}

function Divider() {
  return <div className="border-t border-zinc-800" />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ImpactLandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">

      {/* ===================================================================
          HERO — Mission + two paths
      =================================================================== */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-950/60 via-zinc-950/80 to-zinc-950" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-violet-800/10 blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-violet-900/50 text-violet-300 border border-violet-700/40 mb-8">
            💜 Story Magic Impact Program
          </span>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
            Every voice{' '}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-violet-300 bg-clip-text text-transparent">
                deserves an audience.
              </span>
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-300 max-w-2xl mx-auto leading-relaxed mb-4">
            Story Magic Impact is a free program for people who have survived trauma,
            navigated broken systems, or rebuilt their lives — and who want to share
            their story in their own voice.
          </p>
          <p className="text-base text-zinc-500 max-w-xl mx-auto mb-12">
            And for those who want to make that possible, there is a way.
          </p>

          {/* Two paths */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="#tell-your-story"
              className="group flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-base transition-all shadow-lg shadow-violet-900/40"
            >
              <span>🎙️</span>
              <span>Tell your story</span>
              <span className="opacity-50 group-hover:opacity-100 transition-opacity">→</span>
            </Link>
            <Link
              href="#help"
              className="group flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-base border border-zinc-700 hover:border-violet-500 transition-all"
            >
              <span>💜</span>
              <span>Help make it possible</span>
              <span className="opacity-50 group-hover:opacity-100 transition-opacity">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ===================================================================
          THE MISSION — Why this exists
      =================================================================== */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-zinc-900/40">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <div className="md:col-span-2">
              <Eyebrow>The mission</Eyebrow>
              <SectionHeading>
                Storytelling has always been{' '}
                <span className="text-violet-400">a human right.</span>
              </SectionHeading>
              <div className="mt-6 space-y-4 text-zinc-400 leading-relaxed">
                <p>
                  Professional audio production costs thousands of dollars. That barrier has
                  kept the most important stories — the ones born from real hardship, real
                  survival, real change — from reaching the people who need to hear them most.
                </p>
                <p>
                  Impact StoryBuilder removes that barrier. We use AI voice generation to give
                  every participant — at no cost — a professionally narrated audio story in a
                  voice that feels like them. Their truth. Their words. Their voice.
                </p>
                <p className="text-zinc-300 font-medium">
                  Stories that might otherwise disappear into silence become something permanent,
                  something shareable, something that can move another person to tears — or to action.
                </p>
              </div>
            </div>

            {/* Stat column */}
            <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
              {[
                { value: '100%', label: 'Free for storytellers', sub: 'Always. No exceptions.' },
                { value: '$100', label: 'Monthly prize drawing', sub: 'For one brave voice.' },
                { value: '6', label: 'Story categories', sub: 'From justice to recovery.' },
              ].map(stat => (
                <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <div className="text-3xl font-black text-white">{stat.value}</div>
                  <div className="text-sm font-semibold text-zinc-300 mt-1">{stat.label}</div>
                  <div className="text-xs text-zinc-600 mt-0.5">{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* ===================================================================
          TELL YOUR STORY — For storytellers
      =================================================================== */}
      <section id="tell-your-story" className="py-20 px-4 sm:px-6 lg:px-8 scroll-mt-8">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="text-center mb-14">
            <Eyebrow>For those with a story to tell</Eyebrow>
            <SectionHeading>
              You went through something real.{' '}
              <span className="text-violet-400">Let it be heard.</span>
            </SectionHeading>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              No writing experience needed. No recording studio. No cost.
              Just you, your story, and the voice we help you find for it.
            </p>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
            {[
              {
                step: '01',
                icon: '✍️',
                title: 'Write it in your words',
                desc: 'Answer a simple prompt about your experience. Our AI can help expand your draft — but every word stays true to your voice and your facts.',
              },
              {
                step: '02',
                icon: '🎙️',
                title: 'Choose how it sounds',
                desc: 'Select from voices chosen for warmth and authenticity. Listen to a preview before you commit. It should feel like you.',
              },
              {
                step: '03',
                icon: '🌍',
                title: 'Share it with the world',
                desc: 'Download your audio. Optionally share in our public gallery — or keep it private. Either way, your story is real and it is yours.',
              },
            ].map(item => (
              <div key={item.step} className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 overflow-hidden">
                <div className="absolute top-4 right-4 text-4xl font-black text-zinc-800/80 select-none">
                  {item.step}
                </div>
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-white text-base mb-2">{item.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Privacy + safety callout */}
          <div className="bg-gradient-to-r from-violet-950/60 to-zinc-900 border border-violet-800/40 rounded-2xl p-6 mb-14 flex flex-col sm:flex-row gap-4 items-start">
            <div className="text-3xl flex-shrink-0">🔒</div>
            <div>
              <h3 className="font-bold text-white mb-1">Your privacy, your control</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                You choose what to share and what to keep private. You can use a first name only,
                remain anonymous entirely, or share your full story publicly. Stories submitted for
                the public gallery are reviewed by our team before appearing. You can delete your
                story at any time.
              </p>
            </div>
          </div>

          {/* Categories */}
          <div className="mb-14">
            <h3 className="text-xl font-bold text-white text-center mb-2">What kind of story do you have?</h3>
            <p className="text-sm text-zinc-500 text-center mb-8">
              Every experience qualifies. Choose the category that fits closest.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {IMPACT_CATEGORIES.map(cat => (
                <Link
                  key={cat.id}
                  href="/sign-up?redirect_url=/impact/build"
                  className="group flex flex-col items-start gap-2 p-5 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-violet-500/60 hover:bg-zinc-800/80 transition-all"
                >
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
                    {cat.label}
                  </span>
                  <span className="text-xs text-zinc-500 leading-snug">{cat.tagline}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Prize drawing */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 flex flex-col sm:flex-row gap-6 items-center">
            <div className="text-5xl flex-shrink-0">🏆</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2">Monthly $100 prize drawing</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Every completed story is automatically entered into our monthly drawing.
                One participant receives $100 as a thank-you for having the courage to share.
                No purchase necessary. Winners are notified by email on the last day of the month.
              </p>
              <p className="text-xs text-zinc-600 mt-2">
                Only completed stories with a valid email address are eligible. Drawing held monthly.
              </p>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="text-center mt-12">
            <Link
              href="/sign-up?redirect_url=/impact/build"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-base transition-all shadow-xl shadow-violet-900/30"
            >
              Create a free account and start your story →
            </Link>
            <p className="text-xs text-zinc-600 mt-3">Free. Always. No credit card required.</p>
          </div>
        </div>
      </section>

      <Divider />

      {/* ===================================================================
          QUOTE BREAK — Emotional pause
      =================================================================== */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-zinc-950 to-violet-950/20">
        <div className="max-w-3xl mx-auto text-center">
          <blockquote className="text-2xl sm:text-3xl font-light text-zinc-200 leading-relaxed italic">
            &ldquo;The most powerful thing you can do for someone who has been silenced
            is hand them a microphone.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm text-zinc-600">— The belief behind this program</p>
        </div>
      </section>

      <Divider />

      {/* ===================================================================
          HELP — For donors and partners
      =================================================================== */}
      <section id="help" className="py-20 px-4 sm:px-6 lg:px-8 scroll-mt-8">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="text-center mb-14">
            <Eyebrow>For those who want to help</Eyebrow>
            <SectionHeading>
              You can be the reason{' '}
              <span className="text-violet-400">someone&apos;s story is heard.</span>
            </SectionHeading>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Running Impact at zero cost requires resources. There are two ways to contribute —
              as an individual with a gift, or as an organization ready to invest in a mission.
            </p>
          </div>

          {/* Two columns: Donate + Partner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">

            {/* Donate card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col">
              <div className="text-4xl mb-4">💜</div>
              <h3 className="text-xl font-bold text-white mb-3">Give a gift</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6 flex-1">
                A one-time donation — any amount — directly funds the AI voice generation
                that makes a story possible. $15 covers a full production. $50 funds five.
                There is no overhead here. Your gift goes to the work.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-6">
                {[
                  { label: '$5', desc: 'One preview' },
                  { label: '$15', desc: 'One full story' },
                  { label: '$25', desc: 'Two storytellers' },
                  { label: '$50', desc: 'Five stories' },
                ].map(opt => (
                  <Link
                    key={opt.label}
                    href={`/impact/donate`}
                    className="p-3 rounded-xl border border-zinc-700 hover:border-violet-500 bg-zinc-950 hover:bg-zinc-800/60 transition-all text-left"
                  >
                    <div className="text-base font-bold text-white">{opt.label}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{opt.desc}</div>
                  </Link>
                ))}
              </div>

              <Link
                href="/impact/donate"
                className="w-full text-center py-3 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
              >
                Donate to Impact →
              </Link>
              <p className="text-xs text-zinc-600 text-center mt-3">
                Processed by Stripe. Voluntary gift — not tax-deductible.
              </p>
            </div>

            {/* Partner card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-xl font-bold text-white mb-3">Become a partner</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6 flex-1">
                Organizations — nonprofits, foundations, CSR programs, community groups —
                can formally partner with Impact StoryBuilder. Partners receive recognition
                in the gallery, co-branding opportunities, and direct visibility into the
                stories their support makes possible.
              </p>

              <div className="space-y-3 mb-6">
                {[
                  { tier: 'Community Partner', amount: 'From $500/yr', desc: 'Gallery recognition + impact reports' },
                  { tier: 'Impact Partner', amount: 'From $2,500/yr', desc: 'Co-branding + dedicated storytelling batch' },
                  { tier: 'Sustaining Partner', amount: 'From $10,000/yr', desc: 'Mission-level partnership + custom programs' },
                ].map(p => (
                  <div key={p.tier} className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-violet-500 mt-1" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{p.tier}</div>
                      <div className="text-xs text-violet-400 font-medium">{p.amount}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/impact/partners"
                className="w-full text-center py-3 px-6 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-violet-500 text-white font-semibold text-sm transition-all"
              >
                Explore partnership →
              </Link>
            </div>
          </div>

          {/* What support does */}
          <div className="bg-gradient-to-br from-violet-950/40 to-zinc-900 border border-violet-800/30 rounded-2xl p-8">
            <h3 className="text-base font-bold text-white mb-6 text-center">What your support actually does</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: '🎙️',
                  title: 'Covers production costs',
                  desc: 'AI voice generation, audio processing, and R2 cloud storage for each story. Every dollar goes directly to infrastructure.',
                },
                {
                  icon: '🏆',
                  title: 'Funds the prize drawing',
                  desc: 'Monthly $100 cash prize to one storyteller. A tangible thank-you from the community to someone who had the courage to share.',
                },
                {
                  icon: '🌱',
                  title: 'Keeps it free, forever',
                  desc: 'Without donor and partner support, the program cannot remain free. Your gift is what makes "no cost, no exceptions" possible.',
                },
                {
                  icon: '📢',
                  title: 'Expands outreach',
                  desc: 'Enables partnership with shelters, recovery centers, legal aid organizations, and advocacy groups to reach storytellers who need this most.',
                },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-white">{item.title}</div>
                    <div className="text-xs text-zinc-400 leading-relaxed mt-1">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* ===================================================================
          WHO THIS IS FOR — Audience clarity
      =================================================================== */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Eyebrow>Who Impact StoryBuilder serves</Eyebrow>
            <SectionHeading>Built for the voices that rarely get a stage.</SectionHeading>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: '⚖️', who: 'Justice seekers', desc: 'People who fought — or are still fighting — to be treated fairly.' },
              { icon: '🏛️', who: 'System survivors', desc: 'Those who moved through foster care, incarceration, or child welfare.' },
              { icon: '🌱', who: 'Trauma survivors', desc: 'Those carrying something most people cannot imagine.' },
              { icon: '🏠', who: 'Housing-insecure voices', desc: 'People who have experienced homelessness and are ready to tell it.' },
              { icon: '💪', who: 'Recovery advocates', desc: 'Those rebuilding from addiction, mental health crises, or rock bottom.' },
              { icon: '✨', who: 'Anyone with a story', desc: 'If your story matters to you, it belongs here. Full stop.' },
            ].map(item => (
              <div key={item.who} className="flex items-start gap-3 p-5 bg-zinc-900 border border-zinc-800 rounded-xl">
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-white">{item.who}</div>
                  <div className="text-xs text-zinc-500 leading-relaxed mt-1">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Divider />

      {/* ===================================================================
          FINAL SPLIT CTA
      =================================================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Storytellers */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-900/60 to-violet-950 border border-violet-700/40 p-8 flex flex-col">
              <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="relative">
                <div className="text-4xl mb-4">🎙️</div>
                <h3 className="text-2xl font-extrabold text-white mb-3">
                  Your story is waiting to be told.
                </h3>
                <p className="text-sm text-violet-200/80 leading-relaxed mb-8">
                  Create a free account. Write what you&apos;ve been through.
                  Choose a voice. Share it — or don&apos;t. Either way, you&apos;ve
                  turned experience into something that lasts.
                </p>
                <Link
                  href="/sign-up?redirect_url=/impact/build"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-violet-900 font-bold text-sm hover:bg-violet-100 transition-colors"
                >
                  Start your story — free →
                </Link>
              </div>
            </div>

            {/* Helpers */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-700 p-8 flex flex-col">
              <div className="absolute top-0 right-0 w-40 h-40 bg-zinc-700/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="relative">
                <div className="text-4xl mb-4">💜</div>
                <h3 className="text-2xl font-extrabold text-white mb-3">
                  Someone else&apos;s story needs you.
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-8">
                  $15 produces one complete audio story. $50 gives five people a voice.
                  Or partner with us organizationally to bring Impact to your community.
                </p>
                <div className="flex flex-col gap-3">
                  <Link
                    href="/impact/donate"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-colors"
                  >
                    Donate to Impact →
                  </Link>
                  <Link
                    href="/impact/partners"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-zinc-700 hover:border-violet-500 text-zinc-300 hover:text-white font-semibold text-sm transition-all"
                  >
                    Explore partnerships →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Gallery link */}
          <div className="text-center mt-10 pt-10 border-t border-zinc-800">
            <p className="text-sm text-zinc-500 mb-3">
              Want to hear what stories sound like first?
            </p>
            <Link
              href="/impact/stories"
              className="text-violet-400 hover:text-violet-300 font-medium text-sm underline underline-offset-4 transition-colors"
            >
              Listen to the community story gallery →
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
