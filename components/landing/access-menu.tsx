'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Building2, ChevronDown, ClipboardEdit, LogIn, ShieldCheck } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Top-right access menu. Three doors:
 *   1. Register your business   → /register
 *   2. Company portal (clients) → /login
 *   3. Italprotein team (us)    → /team-login  (separated, staff-only)
 */
export function AccessMenu({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const t = useTranslations('Access');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={tone === 'light' ? 'ghost' : 'outline'}
          size="sm"
          className={cn(
            'gap-1.5',
            tone === 'light' && 'text-white hover:bg-white/10 hover:text-white',
          )}
        >
          <Building2 className="h-4 w-4" />
          <span className="hidden sm:inline">{t('menu')}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 p-1.5">
        {/* 1 — Register */}
        <DropdownMenuItem asChild className="py-2.5">
          <Link href="/register">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-gold/15 [&_svg]:!text-brand-goldDark">
              <ClipboardEdit className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium text-foreground">{t('register')}</span>
              <span className="text-xs text-muted-foreground">{t('registerHint')}</span>
            </span>
          </Link>
        </DropdownMenuItem>

        {/* 2 — Company portal */}
        <DropdownMenuItem asChild className="py-2.5">
          <Link href="/login">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal/15 [&_svg]:!text-brand-teal">
              <LogIn className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium text-foreground">{t('portal')}</span>
              <span className="text-xs text-muted-foreground">{t('portalHint')}</span>
            </span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('teamHint')}</DropdownMenuLabel>

        {/* 3 — Italprotein team (reserved for us) */}
        <DropdownMenuItem asChild className="py-2.5">
          <Link href="/team-login">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy [&_svg]:!text-brand-gold">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium text-foreground">{t('team')}</span>
              <span className="text-xs text-muted-foreground">italprotein.com</span>
            </span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
