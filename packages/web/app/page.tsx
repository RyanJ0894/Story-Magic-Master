import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white text-lg">✨</span>
            </div>
            <span className="font-bold text-lg">Story Magic</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/guide"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              User Guide
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-24 pt-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Transform Scripts into{' '}
            <span className="text-brand-600">Immersive Audio</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Story Magic uses AI to convert your screenplays into professional-quality
            audio experiences with voice acting, music, and sound effects.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 border border-gray-300 dark:border-gray-600 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Upload Script</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Paste your screenplay or upload a PDF. We handle the parsing.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Generate Audio</h3>
              <p className="text-gray-600 dark:text-gray-400">
                AI selects voices, music, and ambience. Click generate.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Download MP3</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Get broadcast-quality audio ready for production.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                  <span className="text-white text-lg">✨</span>
                </div>
                <span className="font-bold text-lg">Story Magic</span>
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Transform scripts into immersive audio experiences with AI.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link href="/guide#getting-started" className="hover:text-brand-600">Getting Started</Link></li>
                <li><Link href="/guide#storyscore" className="hover:text-brand-600">StoryScore</Link></li>
                <li><Link href="/guide#audio-generation" className="hover:text-brand-600">Audio Generation</Link></li>
                <li><Link href="/guide#billing" className="hover:text-brand-600">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link href="/guide" className="hover:text-brand-600">User Guide</Link></li>
                <li><Link href="/guide#help" className="hover:text-brand-600">FAQ</Link></li>
                <li><a href="mailto:support@storymagic.ai" className="hover:text-brand-600">Contact Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Account</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link href="/login" className="hover:text-brand-600">Sign In</Link></li>
                <li><Link href="/signup" className="hover:text-brand-600">Create Account</Link></li>
                <li><Link href="/dashboard" className="hover:text-brand-600">Dashboard</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-gray-600 dark:text-gray-400">
            <p className="mb-2">
              <a
                href="https://www.storymagicapp.net"
                className="text-brand-600 hover:text-brand-700 font-medium"
              >
                www.StoryMagicApp.net
              </a>
            </p>
            <p>&copy; 2026 Story Magic. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
