import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-24">
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
      <footer className="py-8 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-600 dark:text-gray-400">
          <p>&copy; 2026 Story Magic. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
