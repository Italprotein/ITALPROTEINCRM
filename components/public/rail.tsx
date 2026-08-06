'use client';

import { Building2, Globe2, Mail, Phone, UserPlus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { WordmarkScan } from '@/components/landing/wordmark-scan';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { siteContact } from '@/lib/config/site';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * The rail: identity, the signature, the doors and contact — permanently on
 * screen, so the column is never more than a glance from any door.
 *
 * Three doors, not two: the two sign-in doors as lit panels, then `/register`
 * beneath them. Registration is the only way a company that has no account yet
 * can get one, and after `access-menu.tsx` was deleted nothing on the site
 * linked to it. It is rendered as a quieter dashed row rather than a third
 * panel because it is subordinate — most visitors already have an account —
 * but it lives in the same `<nav>` so it is never missed.
 *
 * `Logo` renders `variant="mark"` only (the circular image badge, no text
 * lockup). Its `variant="full"`/`"wordmark"` text spans hard-code the
 * Playfair display typeface, which is banned on public pages, and the
 * wordmark is already carried by `WordmarkScan` below — rendering both would
 * also just repeat "ITALPROTEIN" twice.
 *
 * `lg:fixed lg:inset-y-0 lg:left-0 lg:w-[25rem]` pins the rail at `lg`; below
 * that it is a normal static block (no fixed positioning, which on a phone
 * would consume the whole viewport) and `PublicShell` stacks the column
 * beneath it in flow.
 */
export function Rail() {
  const t = useTranslations('Public');
  const tLanding = useTranslations('Landing');
  const tAccess = useTranslations('Access');
  const pathname = usePathname();

  const doors = [
    {
      href: '/team-login' as const,
      icon: Users,
      title: t('doorTeam'),
      hint: t('doorTeamHint'),
      label: 'CRM',
    },
    {
      href: '/login' as const,
      icon: Building2,
      title: t('doorPortal'),
      hint: t('doorPortalHint'),
      label: 'B2B PORTAL',
    },
  ];

  return (
    <aside
      className={
        'relative z-40 border-b border-border bg-card/95 px-4 py-5 text-card-foreground backdrop-blur-xl ' +
        'transition-colors duration-300 motion-reduce:transition-none sm:px-6 sm:py-6 ' +
        'lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[25rem] lg:flex-col lg:overflow-y-auto ' +
        'lg:border-b-0 lg:border-r lg:px-8 lg:py-8'
      }
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-navy via-brand-goldDark to-brand-gold dark:from-brand-goldDark dark:via-brand-gold dark:to-brand-teal" aria-hidden />

      <div className="flex flex-col gap-6 lg:h-full lg:gap-7">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo variant="mark" tone="dark" href="/" className="shrink-0 focus-visible:ring-offset-background" />
            <div className="min-w-0 border-l border-border pl-3">
              <p className="truncate text-xs font-bold tracking-[0.12em] text-brand-navy dark:text-white">ITALPROTEIN</p>
              <p className="mt-0.5 truncate font-mono text-[0.625rem] uppercase tracking-[0.15em] text-brand-molecular dark:text-brand-gold">
                Proamina® · Access
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 [&_button]:!h-11 [&_button]:!min-w-11">
            <ThemeToggle tone="dark" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
            <LanguageSwitcher tone="dark" compact />
          </div>
        </div>

        <div className="hidden sm:block">
          <WordmarkScan caption={tLanding('heroCaption')} />
        </div>

        <p className="max-w-[34ch] font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
          {t('positioning')}
        </p>

        <nav aria-label={t('accessNav')} className="grid grid-cols-2 gap-2.5 lg:grid-cols-1 lg:gap-3">
          {doors.map((door) => {
            const active = pathname === door.href;
            return (
              <Link
                key={door.href}
                href={door.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex min-h-[6.5rem] items-start gap-3 overflow-hidden rounded-xl border p-3.5 transition-[border-color,background-color,transform] duration-200 ',
                  'hover:-translate-y-0.5 hover:border-brand-goldDark/45 hover:bg-accent/70 motion-reduce:transform-none ',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:min-h-0 lg:p-4',
                  active
                    ? 'border-brand-goldDark/45 bg-info-subtle dark:border-brand-gold/40'
                    : 'border-border bg-background/60',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-white shadow-sm dark:bg-brand-molecular">
                  <door.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-[0.5625rem] font-semibold uppercase tracking-[0.13em] text-brand-molecular dark:text-brand-gold">
                    {door.label}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-foreground">{door.title}</span>
                  <span className="mt-1 hidden font-mono text-[0.625rem] leading-relaxed text-muted-foreground sm:block">
                    {door.hint}
                  </span>
                </span>
                {active && <span className="absolute inset-y-3 left-0 w-0.5 bg-brand-goldDark dark:bg-brand-gold" aria-hidden />}
              </Link>
            );
          })}

          {/* The third door. Dashed and unlit so it reads as subordinate to
              the two sign-in panels above, but it is a full-width target with
              the same focus ring — a company with no account has no other
              route in. Copy reuses the `Access` namespace the deleted access
              menu already carried. */}
          <Link
            href="/register"
            className={
              'group col-span-2 flex min-h-11 items-center gap-3 rounded-xl border border-dashed border-border bg-background/30 px-3.5 py-3 ' +
              'transition-colors duration-200 hover:border-brand-goldDark/45 hover:bg-accent/60 ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:col-span-1'
            }
          >
            <UserPlus
              className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand-goldDark dark:group-hover:text-brand-gold"
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-foreground">
                {tAccess('register')}
              </span>
              <span className="mt-0.5 hidden font-mono text-[0.625rem] leading-relaxed text-muted-foreground sm:block">
                {tAccess('registerHint')}
              </span>
            </span>
          </Link>
        </nav>

        <div className="flex flex-col gap-4 border-t border-border pt-5 lg:mt-auto">
          <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-3 lg:grid-cols-1">
            <a
              href={siteContact.emailHref}
              className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 font-mono text-muted-foreground transition-colors hover:bg-accent hover:text-brand-molecular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-brand-gold"
            >
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{siteContact.email}</span>
            </a>
            {siteContact.phones.map((phone) => (
              <a
                key={phone.id}
                href={phone.href}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-mono text-muted-foreground transition-colors hover:bg-accent hover:text-brand-molecular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-brand-gold"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{phone.display}</span>
              </a>
            ))}
            <a
              href={siteContact.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 font-mono text-muted-foreground transition-colors hover:bg-accent hover:text-brand-molecular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-brand-gold"
            >
              <Globe2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{siteContact.website.replace(/^https?:\/\//, '')}</span>
            </a>
          </div>
          <p className="font-mono text-[0.5625rem] uppercase tracking-[0.15em] text-muted-foreground">
            Parma, Italia · B2B
          </p>
        </div>
      </div>
    </aside>
  );
}
