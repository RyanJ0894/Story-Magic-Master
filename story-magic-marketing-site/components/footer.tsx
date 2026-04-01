import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 gap-y-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Story Magic" className="h-7 w-auto" />
            </Link>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Transform scripts into immersive audio experiences with AI.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-[var(--color-foreground)]">Product</h4>
            <ul className="space-y-2 text-sm text-[var(--color-muted-foreground)]">
              <li><Link href="/features" className="hover:text-brand-600 transition-colors">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-brand-600 transition-colors">Pricing</Link></li>
              <li><a href="https://app.storymagicapp.net/guide" className="hover:text-brand-600 transition-colors">User Guide</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-[var(--color-foreground)]">Company</h4>
            <ul className="space-y-2 text-sm text-[var(--color-muted-foreground)]">
              <li>
                <a href="mailto:support@storymagicapp.net" className="hover:text-brand-600 transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <Link href="/voice-marketplace" className="hover:text-brand-600 transition-colors">
                  Voice Marketplace
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-violet-500">💜 Impact</h4>
            <ul className="space-y-2 text-sm text-[var(--color-muted-foreground)]">
              <li><Link href="/impact" className="hover:text-violet-500 transition-colors">About the Program</Link></li>
              <li><a href="https://app.storymagicapp.net/impact/stories" className="hover:text-violet-500 transition-colors">Story Gallery</a></li>
              <li><a href="https://app.storymagicapp.net/impact/donate" className="hover:text-violet-500 transition-colors">Donate</a></li>
              <li><a href="https://app.storymagicapp.net/impact/partners" className="hover:text-violet-500 transition-colors">Partner With Us</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-[var(--color-foreground)]">Developers</h4>
            <ul className="space-y-2 text-sm text-[var(--color-muted-foreground)]">
              <li>
                <span className="opacity-50 cursor-not-allowed">API (coming soon)</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-[var(--color-foreground)]">Legal</h4>
            <ul className="space-y-2 text-sm text-[var(--color-muted-foreground)]">
              <li><Link href="/terms" className="hover:text-brand-600 transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-brand-600 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/cookies" className="hover:text-brand-600 transition-colors">Cookie Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--color-muted-foreground)]">
          <p>&copy; 2026 Story Magic. All rights reserved.</p>
          <p className="text-xs">
            💜 <Link href="/impact" className="text-violet-500 hover:text-violet-400 transition-colors">Impact StoryBuilder</Link>
            {' '}— giving voice to those who need it most.
          </p>
        </div>
      </div>
    </footer>
  );
}
