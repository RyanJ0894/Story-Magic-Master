'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

const THEMES = ['light', 'dark', 'system'] as const;

const THEME_META: Record<string, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: 'Light mode' },
  dark: { icon: Moon, label: 'Dark mode' },
  system: { icon: Monitor, label: 'System theme' },
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle theme">
        <Monitor className="h-4 w-4" />
      </Button>
    );
  }

  const currentIndex = THEMES.indexOf((theme as typeof THEMES[number]) ?? 'system');
  const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
  const meta = THEME_META[theme ?? 'system'];
  const Icon = meta.icon;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => setTheme(nextTheme)}
      aria-label={meta.label}
      data-testid="theme-toggle"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
