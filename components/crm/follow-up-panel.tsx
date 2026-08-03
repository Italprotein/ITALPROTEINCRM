'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Clock, MessageSquareReply, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { isApiMode } from '@/lib/data-mode';
import { flagEmoji, formatDate } from '@/lib/formatting';
import type { FollowUpCandidate } from '@/lib/follow-up';
import { followUpCandidates } from '@/lib/services/follow-up.actions';
import type { Locale } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Companies that replied to us at least once and have since gone quiet for ten
 * days or more. Clicking one asks Amina to brief you on what the follow-up
 * should actually be about, using the thread she can already read.
 */
export function FollowUpPanel() {
  const t = useTranslations('FollowUp');
  const locale = useLocale() as Locale;
  // `isApiMode` is a build-time constant, so mock mode starts settled-and-empty
  // rather than loading: the query reads real inbound mail and the fixture
  // mailbox is empty by design.
  const [rows, setRows] = React.useState<FollowUpCandidate[] | null>(isApiMode ? null : []);

  React.useEffect(() => {
    if (!isApiMode) return;
    let active = true;
    followUpCandidates()
      .then((result) => active && setRows(result))
      .catch(() => active && setRows([]));
    return () => {
      active = false;
    };
  }, []);

  function askAmina(candidate: FollowUpCandidate) {
    const prompt = t('aminaPrompt', {
      company: candidate.companyName,
      days: candidate.quietDays,
      subject: candidate.lastInboundSubject ?? t('noSubject'),
      date: formatDate(candidate.lastInboundAt, locale),
    });
    window.dispatchEvent(new CustomEvent('amina:ask', { detail: { prompt } }));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareReply className="h-4 w-4 text-brand-goldDark" />
          {t('title')}
        </CardTitle>
        {rows && rows.length > 0 ? <Badge variant="warning">{rows.length}</Badge> : null}
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-xs text-muted-foreground">{t('subtitle')}</p>

        {rows === null ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            {isApiMode ? t('empty') : t('needsApiMode')}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((candidate) => (
              <li key={candidate.companyId}>
                <button
                  type="button"
                  onClick={() => askAmina(candidate)}
                  className={cn(
                    'group flex w-full items-start gap-3 rounded-md border bg-card p-3 text-left transition-colors',
                    'hover:border-brand-gold/50 hover:bg-muted/50',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  <span className="mt-0.5 text-base leading-none">{flagEmoji(candidate.countryCode)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-foreground">{candidate.companyName}</span>
                      <Badge variant="muted" className="gap-1 text-2xs">
                        <Clock className="h-3 w-3" />
                        {t('quietDays', { days: candidate.quietDays })}
                      </Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {candidate.lastInboundSubject ?? t('noSubject')}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 self-center text-2xs font-medium text-brand-goldDark opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('askAmina')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
