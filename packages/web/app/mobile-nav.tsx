'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="p-2 rounded-lg hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      >
        {open ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
      </button>

      {open && (
        <div className="absolute top-16 left-0 right-0 bg-background border-b border-border shadow-lg">
          <div className="flex flex-col p-4 space-y-3">
            <Link
              href="/guide"
              onClick={() => setOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              User Guide
            </Link>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors text-center"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
