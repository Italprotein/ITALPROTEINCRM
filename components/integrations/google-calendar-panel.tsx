'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { format, parseISO, isSameDay } from 'date-fns';
import { CalendarClock, ExternalLink, Video, Building2 } from 'lucide-react';

import { getLinkedCalendarEvents, type LinkedCalendarEvent } from '@/lib/services/google.actions';
import { Link } from '@/lib/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';

/*
 * Google Calendar events for the shared ad@italprotein.com account, next to the
 * CRM's own meetings. They stay visually distinct rather than being merged: one
 * set is booked in Google and read-only here, the other lives in the CRM, and
 * pretending they are the same thing would make it unclear where to edit.
 */

export function GoogleCalendarPanel({
  day,
  calendarState,
  asOf,
}: {
  day?: Date | null;
  calendarState?: {
    events: LinkedCalendarEvent[];
    connected: boolean;
    error?: string;
  } | null;
  asOf?: number | null;
}) {
  const t = useTranslations('GoogleCalendar');
  const [state, setState] = React.useState<{
    events: LinkedCalendarEvent[];
    connected: boolean;
    error?: string;
  } | null>(null);

  // Pinned at load: "upcoming" is relative to when the list was fetched, so it
  // does not silently reshuffle on an unrelated re-render.
  const [loadedAt, setLoadedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (calendarState !== undefined) return;
    getLinkedCalendarEvents()
      .then((res) => { setState(res); setLoadedAt(new Date().getTime()); })
      .catch(() => { setState({ events: [], connected: false }); setLoadedAt(new Date().getTime()); });
  }, [calendarState]);

  const effectiveState = calendarState === undefined ? state : calendarState;

  const shown = React.useMemo(() => {
    if (!effectiveState) return [];
    if (day) return effectiveState.events.filter((e) => isSameDay(parseISO(e.start), day));
    const from = asOf ?? loadedAt ?? 0;
    return effectiveState.events.filter((e) => parseISO(e.end).getTime() >= from).slice(0, 8);
  }, [effectiveState, day, loadedAt, asOf]);

  // Not connected is the normal state before anyone authorises: say what to do,
  // don't render an empty box that looks broken.
  if (effectiveState && !effectiveState.connected) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{t('title')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('notConnected')}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/settings">{t('goToSettings')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-brand-teal" />
          {day ? t('titleForDay') : t('title')}
        </CardTitle>
        {effectiveState && !effectiveState.error && (
          <Badge variant="muted">{t('eventCount', { count: shown.length })}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {effectiveState === null ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14 w-full" />)
        ) : effectiveState.error ? (
          <p className="text-sm text-muted-foreground">{effectiveState.error}</p>
        ) : shown.length === 0 ? (
          <EmptyState title={day ? t('noneThisDay') : t('noneUpcoming')} className="py-6" />
        ) : (
          shown.map((event) => (
            <div key={event.id} className="rounded-lg border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium" title={event.summary}>
                  {event.summary}
                </p>
                {event.htmlLink && (
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={t('openInGoogle')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={event.location || undefined}>
                {event.allDay
                  ? t('allDay', { date: format(parseISO(event.start), 'd MMM') })
                  : `${format(parseISO(event.start), 'd MMM HH:mm')}–${format(parseISO(event.end), 'HH:mm')}`}
                {event.location ? ` · ${event.location}` : ''}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {event.companyId ? (
                  <Link
                    href={`/admin/companies/${event.companyId}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-teal hover:underline"
                  >
                    <Building2 className="h-3 w-3" />
                    {event.companyName}
                  </Link>
                ) : (
                  <span className="text-2xs text-muted-foreground">{t('noCompanyMatch')}</span>
                )}
                {/* A domain match is a guess, so label it as one. */}
                {event.matchedBy === 'email-domain' && (
                  <Badge variant="muted" className="text-2xs">{t('matchedByDomain')}</Badge>
                )}
                {event.hangoutLink && (
                  <a
                    href={event.hangoutLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-info hover:underline"
                  >
                    <Video className="h-3 w-3" />
                    {t('joinCall')}
                  </a>
                )}
                {event.attendees.length > 0 && (
                  <span className="text-2xs text-muted-foreground">
                    {t('attendeeCount', { count: event.attendees.length })}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
