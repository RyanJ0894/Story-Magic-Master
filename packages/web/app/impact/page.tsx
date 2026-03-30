import Link from 'next/link';
import { IMPACT_CATEGORIES } from '@/lib/impact/categories';

export const metadata = {
  title: 'Impact StoryBuilder — Story Magic',
  description: 'Transform your personal journey into a powerful audio story. Free for trauma survivors, recovery advocates, and community voices.',
};

const STATS = [
  { value: '$100', label: 'Monthly prize drawing' },
  { value: '6', label: 'Story categories' },
  { value: 'Free', label: 'For all participants' },
  { value: '100%', label: 'Your voice, your story' },
];

export default function ImpactLandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/50 via-zinc-950 to-zinc-950 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-violet-900/40 text-violet-300 border border-violet-700/50 mb-6">
            ❤️ Story Magic Impact Program
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
            Your story deserves{' '}
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              to be heard.
            </span>
          </h1>
          <p className="mt-6 text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed">
            Story Magic Impact is a free program for people who have survived trauma, navigated broken systems,
            or rebuilt their lives — and who want to share their story with the world in their own voice.
          </p>
          <p className="mt-3 text-zinc-400 text-sm max-w-xl mx-auto">
            We use AI to help you write, expand, and narrate your personal story.
            No experience required. No cost. Just your truth.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sign-up?redirect_url=/impact/build"
              className="px-8 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
            >
              Create a free account to share your story
            </Link>
            <Link
              href="/impact/stories"
              className="px-8 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm border border-zinc-700 transition-colors"
            >
              Listen to the gallery
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-zinc-800 py-6 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map(stat => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { step: '1', icon: '✍️', title: 'Write your story', desc: 'Answer a simple prompt about your experience. Our AI can help you expand it — while keeping your voice.' },
              { step: '2', icon: '🎙️', title: 'Choose your narrator', desc: 'Select from voices chosen for warmth and authenticity. Preview your story before committing.' },
              { step: '3', icon: '🎧', title: 'Share and inspire', desc: 'Download your audio story. Optionally share it in our public gallery and enter the $100 monthly prize drawing.' },
            ].map(item => (
              <div key={item.step} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                <div className="text-3xl mb-3">{item.icon}</div>
                <div className="text-xs font-medium text-violet-400 mb-1">Step {item.step}</div>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-3">What kind of story do you have?</h2>
          <p className="text-zinc-400 text-sm text-center mb-10">
            Every experience matters. Choose the category that fits, or tell it in your own way.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {IMPACT_CATEGORIES.map(cat => (
              <Link
                key={cat.id}
                href={`/sign-up?redirect_url=/impact/build`}
                className="flex flex-col items-center gap-2 p-4 bg-zinc-900 border border-zinc-700 rounded-xl hover:border-violet-500 hover:bg-zinc-800 transition-all text-center"
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-sm font-medium text-white">{cat.label}</span>
                <span className="text-xs text-zinc-500">{cat.tagline}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Prize drawing */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-4xl mb-4">🏆</div>
          <h2 className="text-2xl font-bold text-white mb-3">Monthly $100 Prize Drawing</h2>
          <p className="text-zinc-300 text-sm leading-relaxed mb-4">
            Every completed story is automatically entered into our monthly drawing.
            One participant receives $100 as a thank-you for having the courage to share.
            No purchase necessary. Winners are notified by email.
          </p>
          <p className="text-zinc-500 text-xs">
            Drawing held the last day of each month. Only completed stories with a valid contact email are eligible.
          </p>
        </div>
      </section>

      {/* Partners CTA */}
      <section className="py-12 px-4 border-t border-zinc-800">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-zinc-400 text-sm">
            The Impact program is made possible by our technology partners.{' '}
            <Link href="/impact/partners" className="text-violet-400 hover:text-violet-300 underline">
              Learn about partnering with us →
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
