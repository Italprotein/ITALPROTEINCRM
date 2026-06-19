'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const KEY = 'ui:theme';
type Theme = 'light' | 'dark';

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
}

export function ThemeToggle({ tone = 'dark', className }: { tone?: 'light' | 'dark'; className?: string }) {
  const [theme, setTheme] = React.useState<Theme>('light');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme | null) ?? 'light';
    setTheme(stored);
    apply(stored);
    setMounted(true);
  }, []);

  function toggle() {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(KEY, next);
      apply(next);
      return next;
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors',
        tone === 'light'
          ? 'text-white/80 hover:bg-white/10 hover:text-white'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {mounted && theme === 'dark' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
    </button>
  );
}
