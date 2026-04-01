'use client';

import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.storymagicapp.net';

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-background)]/95 backdrop-blur border-b border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Story Magic" className="h-8 w-auto" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/features" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors">
            Features
          </Link>
          <Link href="/pricing" className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors">
            Pricing
          </Link>
          <Link href="/impact" className="text-sm font-medium text-violet-500 hover:text-violet-400 transition-colors">
            💜 Impact
          </Link>
          <a href={`${APP_URL}/voice-marketplace`} className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors">
            Voice Marketplace
          </a>
          <a href={`${APP_URL}/login`} className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors">
            Sign In
          </a>
          <a
            href={`${APP_URL}/signup`}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            Get Started
          </a>
          <ThemeToggle />
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-[var(--color-border)] bg-[var(--color-background)] px-4 py-4 flex flex-col gap-4">
          <Link href="/features" className="text-sm text-[var(--color-muted-foreground)]" onClick={() => setOpen(false)}>Features</Link>
          <Link href="/pricing" className="text-sm text-[var(--color-muted-foreground)]" onClick={() => setOpen(false)}>Pricing</Link>
          <Link href="/impact" className="text-sm font-medium text-violet-500" onClick={() => setOpen(false)}>💜 Impact</Link>
          <a href={`${APP_URL}/voice-marketplace`} className="text-sm text-[var(--color-muted-foreground)]" onClick={() => setOpen(false)}>Voice Marketplace</a>
          <a href={`${APP_URL}/login`} className="text-sm text-[var(--color-muted-foreground)]">Sign In</a>
          <a href={`${APP_URL}/signup`} className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg text-center hover:bg-brand-700 transition-colors">
            Get Started Free
          </a>
          <div className="flex justify-start">
            <ThemeToggle />
          </div>
        </div>
      )}
    </nav>
  );
}
