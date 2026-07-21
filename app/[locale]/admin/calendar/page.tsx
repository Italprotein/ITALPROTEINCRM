'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, addMonths, subMonths, parseISO, startOfDay,
} from 'date-fns';
import { CalendarDays, Users, ListChecks, ChevronLeft, ChevronRight, Video, Phone, MapPin } from 'lucide-react';
import { meetingService, taskService, companyService } from '@/lib/mock-services';
import type { Meeting, Task, Company } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatDate, formatRelative } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { PriorityBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

const ANCHOR = startOfDay(new Date());
const WEEKDAY_KEYS = ['weekdayMon', 'weekdayTue', 'weekdayWed', 'weekdayThu', 'weekdayFri', 'weekdaySat', 'weekdaySun'] as const;

export default function CalendarPage() {
  const t = useTranslations('AdminCalendar');
  const [meetings, setMeetings] = React.useState<Meeting[] | null>(null);
  const [tasks, setTasks] = React.useState<Task[] | null>(null);
  const [companyMap, setCompanyMap] = React.useState<Map<string, Company>>(new Map());
  const [month, setMonth] = React.useState<Date>(startOfMonth(ANCHOR));
  const [selected, setSelected] = React.useState<Date | null>(null);

  React.useEffect(() => {
    meetingService.list().then(setMeetings);
    taskService.list().then((l) => setTasks(l.filter((t) => t.dueDate)));
    companyService.list().then((l) => setCompanyMap(new Map(l.map((c) => [c.id, c]))));
  }, []);

  const companyName = (id?: string) => (id ? companyMap.get(id)?.tradingName ?? companyMap.get(id)?.legalName ?? '' : '');

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const meetingsOn = (d: Date) => (meetings ?? []).filter((m) => isSameDay(parseISO(m.start), d));
  const tasksOn = (d: Date) => (tasks ?? []).filter((t) => t.dueDate && isSameDay(parseISO(t.dueDate), d));

  const stats = React.useMemo(() => {
    const ms = meetings ?? [];
    const ts = tasks ?? [];
    const inMonth = (iso?: string) => iso != null && isSameMonth(parseISO(iso), month);
    return {
      scheduled: ms.filter((m) => m.status === 'scheduled').length,
      tasksThisMonth: ts.filter((t) => inMonth(t.dueDate)).length,
      completed: ms.filter((m) => m.status === 'completed').length,
    };
  }, [meetings, tasks, month]);

  const upcoming = React.useMemo(() =>
    (meetings ?? [])
      .filter((m) => parseISO(m.start) >= ANCHOR && m.status === 'scheduled')
      .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
      .slice(0, 6),
    [meetings]);

  const mIcon = (t: Meeting['type']) => (t === 'video_call' ? Video : t === 'on_site' ? MapPin : Phone);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title={t('pageTitle')} subtitle={t('pageSubtitle')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t('statMeetingsScheduled')} value={stats.scheduled} icon={Users} tone="gold" />
        <StatCard label={t('statTasksDueThisMonth')} value={stats.tasksThisMonth} icon={ListChecks} tone="warning" delay={0.05} />
        <StatCard label={t('statMeetingsCompleted')} value={stats.completed} icon={CalendarDays} tone="success" delay={0.1} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {/* Month grid */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{format(month, 'MMMM yyyy')}</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label={t('previousMonth')}><ChevronLeft /></Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(ANCHOR))}>{t('today')}</Button>
              <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label={t('nextMonth')}><ChevronRight /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-sm">
              {WEEKDAY_KEYS.map((k) => <div key={k} className="bg-muted/60 py-2 text-center text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{t(k)}</div>)}
              {days.map((d) => {
                const ms = meetingsOn(d);
                const ts = tasksOn(d);
                const inMonth = isSameMonth(d, month);
                const isToday = isSameDay(d, ANCHOR);
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => setSelected(d)}
                    className={cn('min-h-[84px] bg-card p-1.5 text-left align-top transition-colors hover:bg-muted/40', !inMonth && 'bg-muted/20 text-muted-foreground')}
                  >
                    <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs', isToday && 'bg-brand-gold font-bold text-brand-navy')}>{format(d, 'd')}</span>
                    <div className="mt-1 space-y-0.5">
                      {ms.slice(0, 2).map((m) => (
                        <div key={m.id} className="truncate rounded bg-info-subtle px-1 py-0.5 text-2xs text-info">{format(parseISO(m.start), 'HH:mm')} {m.title}</div>
                      ))}
                      {ts.slice(0, 2 - Math.min(ms.length, 2)).map((t) => (
                        <div key={t.id} className="truncate rounded bg-warning-subtle px-1 py-0.5 text-2xs text-warning-foreground">⏰ {t.title}</div>
                      ))}
                      {ms.length + ts.length > 2 && <div className="px-1 text-2xs text-muted-foreground">{t('moreCount', { count: ms.length + ts.length - 2 })}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-2xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-info-subtle ring-1 ring-info/40" /> {t('legendMeeting')}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-warning-subtle ring-1 ring-warning/40" /> {t('legendTaskDue')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t('upcoming')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {meetings === null ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-14 w-full" />)
            ) : upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('noUpcomingMeetings')}</p>
            ) : upcoming.map((m) => {
              const Icon = mIcon(m.type);
              return (
                <div key={m.id} className="flex gap-3 rounded-lg border p-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">{formatRelative(m.start)} · {companyName(m.companyId)}</p>
                    <Badge variant="muted" className="mt-1">{getLabel('meetingType', m.type)}</Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Day detail */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader><SheetTitle>{format(selected, 'EEEE d MMMM yyyy')}</SheetTitle><SheetDescription>{t('dayDetailSummary', { meetings: meetingsOn(selected).length, tasks: tasksOn(selected).length })}</SheetDescription></SheetHeader>
              <div className="space-y-3">
                {meetingsOn(selected).length === 0 && tasksOn(selected).length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t('nothingScheduled')}</p>
                )}
                {meetingsOn(selected).map((m) => {
                  const Icon = mIcon(m.type);
                  return (
                    <div key={m.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-info" /><span className="text-sm font-medium">{m.title}</span></div>
                      <p className="mt-1 text-xs text-muted-foreground">{format(parseISO(m.start), 'HH:mm')}{m.end ? `–${format(parseISO(m.end), 'HH:mm')}` : ''} · {companyName(m.companyId)}</p>
                      {m.agenda && <p className="mt-1 text-xs text-muted-foreground">{m.agenda}</p>}
                    </div>
                  );
                })}
                {tasksOn(selected).map((task) => (
                  <div key={task.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">⏰ {task.title}</span><PriorityBadge value={task.priority} /></div>
                    <p className="mt-1 text-xs text-muted-foreground">{t('dueDate', { date: formatDate(task.dueDate) })} · {companyName(task.companyId)}</p>
                    <Link href="/admin/tasks" className="mt-1 inline-block text-xs font-medium text-brand-teal hover:underline">{t('openInTasks')}</Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
