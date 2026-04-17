export const dynamic = 'force-dynamic';

import Image from 'next/image';
import Link from 'next/link';
import { MobileNav } from './mobile-nav';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="Story Magic" width={144} height={144} className="rounded-lg" />
          </Link>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/guide" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              User Guide
            </Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/voice-marketplace" className="text-sm text-amber-600 dark:text-amber-400 font-medium hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
              Voice Marketplace
            </Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              Get Started
            </Link>
            <ThemeToggle />
          </div>
          <MobileNav />
        </div>
      </nav>

      {/* Hero Section — cinema dark with gradient */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-4 py-24 pt-32 overflow-hidden bg-slate-950">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/80 via-slate-950 to-slate-900 pointer-events-none" />
        {/* Subtle particle dots */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[
            { top: '15%', left: '10%', size: 3, delay: '0s' },
            { top: '30%', left: '85%', size: 2, delay: '0.5s' },
            { top: '60%', left: '20%', size: 2, delay: '1s' },
            { top: '75%', left: '70%', size: 3, delay: '1.5s' },
            { top: '45%', left: '50%', size: 2, delay: '0.8s' },
            { top: '20%', left: '60%', size: 2, delay: '2s' },
            { top: '80%', left: '40%', size: 3, delay: '0.3s' },
          ].map((dot, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white/20 animate-pulse"
              style={{
                top: dot.top,
                left: dot.left,
                width: dot.size,
                height: dot.size,
                animationDelay: dot.delay,
              }}
            />
          ))}
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600/20 border border-brand-500/30 text-brand-300 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
            AI-Powered Audio Production
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-white">
            Transform Scripts into{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-200">
              Cinematic Audio
            </span>
          </h1>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Upload your screenplay and hear it come alive with realistic AI voices,
            ambient soundscapes, and cinematic music. Before it&apos;s ever filmed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors text-lg shadow-lg shadow-brand-900/50"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 border border-slate-600 text-slate-200 font-semibold rounded-lg hover:bg-slate-800 transition-colors text-lg"
            >
              Sign In
            </Link>
          </div>
          {/* Trust signals */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-slate-400 text-sm">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              PDF &amp; Final Draft supported
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Broadcast-quality output
            </span>
          </div>
        </div>
      </section>

      {/* Features Strip */}
      <section className="py-6 bg-brand-950/50 border-y border-brand-900/40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center text-sm text-brand-200">
            <div className="flex items-center justify-center gap-3 py-2">
              <span className="text-2xl">🎬</span>
              <span className="font-medium">Upload Script</span>
              <span className="text-brand-400/60">—</span>
              <span className="text-brand-300/80">PDF or Final Draft format</span>
            </div>
            <div className="flex items-center justify-center gap-3 py-2">
              <span className="text-2xl">🎭</span>
              <span className="font-medium">AI Voice Casting</span>
              <span className="text-brand-400/60">—</span>
              <span className="text-brand-300/80">Unique voices per character</span>
            </div>
            <div className="flex items-center justify-center gap-3 py-2">
              <span className="text-2xl">🎵</span>
              <span className="font-medium">Immersive Audio</span>
              <span className="text-brand-400/60">—</span>
              <span className="text-brand-300/80">Cinematic soundscapes &amp; music</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-muted">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From screenplay to broadcast-quality audio in minutes, not months.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: '📄',
                title: 'Upload Your Script',
                description: 'Paste your screenplay or upload a PDF. Our parser handles scene headings, dialogue, action lines, and character names automatically.',
              },
              {
                step: '02',
                icon: '🎭',
                title: 'AI Casts the Voices',
                description: 'Story Magic\'s AI Director assigns emotionally-tuned voices to every character based on their personality, role, and arc in the story.',
              },
              {
                step: '03',
                icon: '🎬',
                title: 'Download Cinematic Audio',
                description: 'Get broadcast-quality audio with multi-voice performances, ambient soundscapes, adaptive music, and sound effects — ready for production.',
              },
            ].map((item) => (
              <div key={item.step} className="relative bg-card border border-border rounded-xl p-8 hover:shadow-lg transition-shadow">
                <div className="absolute -top-4 left-8 px-3 py-1 bg-brand-600 text-white text-xs font-bold rounded-full">
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

      {/* AI Voice Casting Showcase */}
      <section className="py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">AI Voice Casting Director</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Our AI automatically assigns unique, emotionally-tuned voices to each character
              based on their personality and role in your story.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'STACY', role: 'Lead', description: 'Determined entrepreneur', range: 'Female 20s–30s', color: 'from-pink-500/20 to-blue-500/20', border: 'border-pink-500/30' },
              { name: 'LUCKY', role: 'Supporting', description: 'Tech-savvy assistant', range: 'Female 20s–30s', color: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30' },
              { name: 'CODY', role: 'Supporting', description: 'Deep, calm presence', range: 'Male 28–38', color: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30' },
              { name: 'NARRATOR', role: 'Narrator', description: 'Deep, authoritative', range: 'Male 40–45', color: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/30' },
            ].map((char) => (
              <div key={char.name} className={`bg-gradient-to-br ${char.color} border ${char.border} rounded-xl p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{char.role}</span>
                  <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center">
                    <span className="text-brand-300 text-sm">🎤</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-1">{char.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">{char.description}</p>
                <p className="text-xs text-muted-foreground/70">{char.range}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">
            Characters, voices, and roles are automatically identified and cast from your script.
          </p>
        </div>
      </section>

      {/* StoryScore Feature */}
      <section className="py-24 bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-600/20 border border-brand-500/30 text-brand-300 text-xs font-medium mb-6">
                Exclusive Feature
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">StoryScore™ Analysis</h2>
              <p className="text-slate-300 text-lg mb-6 leading-relaxed">
                Before you generate audio, get an AI-powered script analysis that scores your
                screenplay against professional production standards. Know what works and what
                to improve before production.
              </p>
              <ul className="space-y-3 text-slate-300">
                {[
                  'Character arc depth and consistency',
                  'Dialogue naturalism and distinctiveness',
                  'Scene pacing and structural flow',
                  'Emotional tone and tension analysis',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-brand-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <span className="font-semibold text-white">StoryScore™</span>
                <span className="text-3xl font-bold text-brand-400">87<span className="text-lg text-slate-400">/100</span></span>
              </div>
              {[
                { label: 'Character Voice', score: 92 },
                { label: 'Dialogue Flow', score: 88 },
                { label: 'Scene Pacing', score: 84 },
                { label: 'Emotional Arc', score: 79 },
              ].map((metric) => (
                <div key={metric.label} className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-400">{metric.label}</span>
                    <span className="text-slate-300">{metric.score}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full"
                      style={{ width: `${metric.score}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-slate-500 text-xs mt-6 text-center">Sample analysis — your script will be scored against 40+ professional criteria</p>
            </div>
          </div>
        </div>
      </section>

      {/* Voice Marketplace CTA */}
      <section className="py-24 bg-gradient-to-br from-amber-950/80 to-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium mb-6">
                Voice Marketplace — Now Open
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                AI That <span className="text-amber-400">Pays</span> Voice Actors<br />
                Instead of Replacing Them
              </h2>
              <p className="text-slate-300 text-lg mb-6 leading-relaxed">
                Story Magic is the first AI audio platform built to pay voice actors, not replace them.
                Submit your voice, get cloned with your consent, and earn a royalty every time
                a screenplay uses your voice.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/voice-marketplace"
                  className="inline-block px-8 py-3 bg-amber-500 text-slate-950 font-bold rounded-lg hover:bg-amber-400 transition-colors"
                >
                  Join the Marketplace
                </Link>
                <div className="flex items-center gap-2 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-sm text-slate-300">
                  <span>💵</span>
                  <span>$2.50 avg per use · 15% revenue share</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: '🎤', title: 'Submit Demo', desc: 'A short reel is all we need' },
                { icon: '🤖', title: 'AI Voice Clone', desc: 'Created with your full consent' },
                { icon: '📝', title: 'Productions Use You', desc: 'Automatic casting in scripts' },
                { icon: '💰', title: 'Earn Royalties', desc: 'Every use pays you passively' },
              ].map((card) => (
                <div key={card.title} className="bg-white/10 border border-white/20 rounded-xl p-5">
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <p className="font-semibold text-sm mb-1">{card.title}</p>
                  <p className="text-xs text-slate-400">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-brand-950 to-slate-950 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Hear Your Script Come Alive?</h2>
          <p className="text-slate-300 text-xl mb-10">
            Upload your screenplay today and transform it into a cinematic audio experience.
          </p>
          <Link
            href="/signup"
            className="inline-block px-10 py-4 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors text-lg shadow-xl shadow-brand-900/60"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-5 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-4">
                <Image src="/logo.png" alt="Story Magic" width={64} height={64} className="rounded-lg" />
                <span className="font-bold text-lg">Story Magic</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                Transform scripts into immersive audio experiences with AI.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/guide#getting-started" className="hover:text-brand-600 transition-colors">Getting Started</Link></li>
                <li><Link href="/guide#storyscore" className="hover:text-brand-600 transition-colors">StoryScore™</Link></li>
                <li><Link href="/guide#audio-generation" className="hover:text-brand-600 transition-colors">Audio Generation</Link></li>
                <li><Link href="/pricing" className="hover:text-brand-600 transition-colors">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/guide" className="hover:text-brand-600 transition-colors">User Guide</Link></li>
                <li><Link href="/guide#help" className="hover:text-brand-600 transition-colors">FAQ</Link></li>
                <li><Link href="/voice-marketplace" className="hover:text-amber-600 text-amber-600 dark:text-amber-400 font-medium transition-colors">Voice Marketplace</Link></li>
                <li><a href="mailto:support@storymagicapp.net" className="hover:text-brand-600 transition-colors">Contact Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Account</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="hover:text-brand-600 transition-colors">Sign In</Link></li>
                <li><Link href="/signup" className="hover:text-brand-600 transition-colors">Create Account</Link></li>
                <li><Link href="/dashboard" className="hover:text-brand-600 transition-colors">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/terms" className="hover:text-brand-600 transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-brand-600 transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p className="mb-1">
              <a href="https://www.storymagicapp.net" className="text-brand-600 hover:text-brand-700 font-medium">
                www.StoryMagicApp.net
              </a>
            </p>
            <p>
              &copy; 2026 Story Magic. All rights reserved.
              {' '}&middot;{' '}
              <Link href="/terms" className="hover:text-brand-600 transition-colors">Terms</Link>
              {' '}&middot;{' '}
              <Link href="/privacy" className="hover:text-brand-600 transition-colors">Privacy</Link>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
