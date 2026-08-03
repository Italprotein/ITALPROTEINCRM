import { Building2, Globe2, Mail, Phone, UserPlus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { WordmarkScan } from '@/components/landing/wordmark-scan';
import { siteContact } from '@/lib/config/site';
import { Link } from '@/lib/i18n/navigation';

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
 * `lg:fixed lg:inset-y-0 lg:left-0 lg:w-[26rem]` pins the rail at `lg`; below
 * that it is a normal static block (no fixed positioning, which on a phone
 * would consume the whole viewport) and `PublicShell` stacks the column
 * beneath it in flow.
 */
export function Rail() {
  const t = useTranslations('Public');
  const tLanding = useTranslations('Landing');
  const tAccess = useTranslations('Access');

  const doors = [
    {
      href: '/team-login' as const,
      icon: Users,
      title: t('doorTeam'),
      hint: t('doorTeamHint'),
    },
    {
      href: '/login' as const,
      icon: Building2,
      title: t('doorPortal'),
      hint: t('doorPortalHint'),
    },
  ];

  return (
    <aside
      className={
        'border-b border-white/10 bg-brand-navy px-6 py-8 ' +
        'lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-[26rem] lg:flex-col ' +
        'lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-8 lg:py-10'
      }
    >
      <div className="flex flex-col gap-8 lg:h-full">
        <Logo variant="mark" tone="light" href="/" />

        <WordmarkScan caption={tLanding('heroCaption')} />

        <p className="max-w-[26ch] font-mono text-xs leading-relaxed text-slate-400">
          {t('positioning')}
        </p>

        <nav aria-label={t('accessNav')} className="space-y-3">
          {doors.map((door) => (
            <Link
              key={door.href}
              href={door.href}
              className={
                'group flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 ' +
                'transition-colors duration-200 hover:border-sky-400/40 hover:bg-white/[0.06] ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy'
              }
            >
              <door.icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{door.title}</span>
                <span className="mt-1 block font-mono text-[0.6875rem] leading-relaxed text-slate-400">
                  {door.hint}
                </span>
              </span>
            </Link>
          ))}

          {/* The third door. Dashed and unlit so it reads as subordinate to
              the two sign-in panels above, but it is a full-width target with
              the same focus ring — a company with no account has no other
              route in. Copy reuses the `Access` namespace the deleted access
              menu already carried. */}
          <Link
            href="/register"
            className={
              'group flex items-start gap-3 rounded-lg border border-dashed border-white/15 px-4 py-3 ' +
              'transition-colors duration-200 hover:border-sky-400/40 hover:bg-white/[0.03] ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy'
            }
          >
            <UserPlus
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-sky-400"
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-slate-300 transition-colors group-hover:text-white">
                {tAccess('register')}
              </span>
              <span className="mt-0.5 block font-mono text-[0.625rem] leading-relaxed text-slate-500">
                {tAccess('registerHint')}
              </span>
            </span>
          </Link>
        </nav>

        <div className="flex flex-col gap-6 border-t border-white/10 pt-6 lg:mt-auto">
          <div className="space-y-2 text-xs">
            <a
              href={siteContact.emailHref}
              className="inline-flex items-center gap-2 rounded-md font-mono text-slate-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{siteContact.email}</span>
            </a>
            {siteContact.phones.map((phone) => (
              <a
                key={phone.id}
                href={phone.href}
                className="inline-flex items-center gap-2 rounded-md font-mono text-slate-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{phone.display}</span>
              </a>
            ))}
            <a
              href={siteContact.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md font-mono text-slate-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
            >
              <Globe2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{siteContact.website.replace(/^https?:\/\//, '')}</span>
            </a>
          </div>

          <LanguageSwitcher tone="light" />
        </div>
      </div>
    </aside>
  );
}
