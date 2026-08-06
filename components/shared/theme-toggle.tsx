'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'ui:theme';
const CHANGE_EVENT = 'italprotein:theme-change';
type Theme = 'light' | 'dark';

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark';
}

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function currentTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  if (value === 'light' || value === 'dark') return value;
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const handleThemeChange = () => onStoreChange();
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    applyTheme(isTheme(event.newValue) ? event.newValue : systemTheme());
  };
  const handleSystemChange = () => {
    if (!storedTheme()) applyTheme(systemTheme());
  };

  window.addEventListener(CHANGE_EVENT, handleThemeChange);
  window.addEventListener('storage', handleStorage);
  media.addEventListener('change', handleSystemChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleThemeChange);
    window.removeEventListener('storage', handleStorage);
    media.removeEventListener('change', handleSystemChange);
  };
}

/**
 * A compact, persistent light/dark control. Until a person explicitly chooses,
 * it continues to follow their operating-system preference.
 */
export function ThemeToggle({ tone = 'dark', className }: { tone?: 'light' | 'dark'; className?: string }) {
  const theme = React.useSyncExternalStore(subscribe, currentTheme, () => 'light');
  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';

  function toggle() {
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Theme switching still works when storage is unavailable or disabled.
    }
    applyTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${nextTheme} mode`}
      className={cn(
        'relative inline-flex h-11 w-16 shrink-0 touch-manipulation items-center rounded-full border p-1.5 transition-[background-color,border-color,box-shadow] duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blueBright focus-visible:ring-offset-2',
        tone === 'light'
          ? 'border-white/20 bg-white/[0.08] text-white hover:border-white/35 hover:bg-white/[0.14] focus-visible:ring-offset-brand-navy'
          : 'border-border bg-secondary text-foreground shadow-xs hover:border-brand-blue/35 hover:bg-accent focus-visible:ring-offset-background',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 translate-x-0 items-center justify-center rounded-full shadow-sm transition-transform duration-300 ease-editorial dark:translate-x-5',
          tone === 'light' ? 'bg-white text-brand-navy' : 'bg-card text-brand-navy dark:text-brand-blueBright',
        )}
        aria-hidden
      >
        <Sun className="h-3.5 w-3.5 dark:hidden" strokeWidth={1.8} />
        <Moon className="hidden h-3.5 w-3.5 dark:block" strokeWidth={1.8} />
      </span>
      <span className="sr-only">{theme === 'dark' ? 'Dark mode active' : 'Light mode active'}</span>
    </button>
  );
}
