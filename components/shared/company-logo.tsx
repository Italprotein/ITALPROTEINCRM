'use client';

import * as React from 'react';

import { CHART_COLORS } from '@/lib/chart-colors';
import type { Company } from '@/lib/types';
import { cn, initials as initialsOf } from '@/lib/utils';

/**
 * The one company avatar in the app: a fetched logo when we have one, the
 * accent-coloured initials tile when we do not.
 *
 * Four copies of the initials `<span>` used to be pasted across the companies
 * list, its mobile card, the company detail header and the search palette, so a
 * logo could only ever appear in whichever of them someone remembered to edit.
 * This is that markup, once.
 *
 * The logo bytes never travel in the company payload (see
 * lib/services/company.mapper.ts) — `logoUpdatedAt` is the "there is a logo"
 * flag, and the browser fetches the image itself from the API route, where it
 * is cached for an hour. If that fetch 404s (row deleted, malformed data URI)
 * the component falls back to initials permanently for this mount rather than
 * retrying on every re-render.
 */

export type CompanyLogoSize = 'sm' | 'md' | 'lg' | 'xl';

/** Company fields this component needs. Any company-ish object satisfying it works. */
export type CompanyLogoSubject = Pick<
  Company,
  'id' | 'legalName' | 'tradingName' | 'initials' | 'accentColor' | 'logoUpdatedAt'
>;

/**
 * Sizes are matched to the surfaces that use them so nothing reflows:
 * `sm` = the search palette's 28px icon slot, `md` = the 36px list/mobile-card
 * tile, `lg` = a roomier list, `xl` = the 64px detail-page header tile.
 */
const SIZES: Record<CompanyLogoSize, string> = {
  sm: 'h-7 w-7 rounded-md text-[0.625rem]',
  md: 'h-9 w-9 rounded-lg text-xs',
  lg: 'h-12 w-12 rounded-lg text-sm',
  xl: 'h-16 w-16 rounded-xl text-xl',
};

export function CompanyLogo({
  company,
  size = 'md',
  className,
}: {
  company: CompanyLogoSubject;
  size?: CompanyLogoSize;
  className?: string;
}) {
  // Remembers *which* image failed, not merely that one did. A row recycled for
  // a different company (list re-sort, palette re-query) or a logo that has
  // since been re-imported gets a fresh attempt, with no reset effect needed.
  const [failedKey, setFailedKey] = React.useState<string | null>(null);
  const logoKey = `${company.id}:${company.logoUpdatedAt ?? ''}`;

  // Same fallback chain the list column has always used.
  const label = company.initials || initialsOf(company.legalName);
  const base = cn('shrink-0 overflow-hidden', SIZES[size], className);

  if (company.logoUpdatedAt && failedKey !== logoKey) {
    return (
      <span className={cn(base, 'flex items-center justify-center border bg-white p-0.5')}>
        {/* Plain <img>, not next/image: these are 1-15KB favicons served from a
            session-protected API route that already sets its own cache headers.
            Routing them through the image optimizer would add a hop and a
            per-image cost to shrink something already smaller than the request. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/companies/${company.id}/logo`}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          onError={() => setFailedKey(logoKey)}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(base, 'flex items-center justify-center font-bold text-white')}
      style={{ backgroundColor: company.accentColor || CHART_COLORS[0] }}
    >
      {label}
    </span>
  );
}
