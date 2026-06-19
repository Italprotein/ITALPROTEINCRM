'use client';

import { useParams } from 'next/navigation';
import { useTransition } from 'react';
import { Languages, Check } from 'lucide-react';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { routing, localeNames, type Locale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

/**
 * Switches locale while preserving the current route AND any dynamic params
 * (e.g. the selected company id), so language changes never lose context.
 */
export function LanguageSwitcher({ tone = 'dark', compact = false }: { tone?: 'light' | 'dark'; compact?: boolean }) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const current = (params.locale as Locale) ?? routing.defaultLocale;

  function change(locale: Locale) {
    startTransition(() => {
      // `pathname` is locale-stripped and still contains any dynamic id segments,
      // so switching the locale preserves both the route and the selected record.
      router.replace(pathname, { locale });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon-sm' : 'sm'}
          disabled={isPending}
          className={cn(tone === 'light' && 'text-sidebar-foreground hover:bg-white/10 hover:text-white')}
          aria-label="Change language"
        >
          <Languages className="h-4 w-4" />
          {!compact && <span className="uppercase">{current}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Language / Lingua</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {routing.locales.map((locale) => (
          <DropdownMenuItem key={locale} onClick={() => change(locale)}>
            <span className="text-base">{localeNames[locale].flag}</span>
            <span className="flex-1">{localeNames[locale].label}</span>
            {locale === current && <Check className="h-4 w-4 text-success" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
