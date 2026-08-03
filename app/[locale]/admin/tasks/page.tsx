'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ListTodo,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Gauge,
  Plus,
  Table2,
  LayoutGrid,
  MoreHorizontal,
  ArrowRight,
  X,
  Sparkles,
  MailPlus,
  ExternalLink,
  Loader2,
  Trash2,
} from 'lucide-react';

import { taskService, companyService } from '@/lib/mock-services';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import { useSession } from '@/components/providers/session-provider';
import { canEdit } from '@/lib/permissions';
import type { Task, TaskType, TaskStatus, Company, Priority, Locale } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatDate, isOverdue, flagEmoji } from '@/lib/formatting';
import { cn, initials, uid } from '@/lib/utils';
import { useRouter } from '@/lib/i18n/navigation';

import { FollowUpPanel } from '@/components/crm/follow-up-panel';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/ui/data-table';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { createAiReplyDraft, generateAiTasksFromInbox } from '@/lib/services/ai-task.actions';

/* ────────────────────────────── Constants ────────────────────────────── */

/** Read the clock at call time: a session left open across midnight must not
    stamp completions — or bucket "overdue"/"due today" — with yesterday. */
const todayStamp = () => new Date().toISOString().slice(0, 10);

const TASK_TYPES: TaskType[] = [
  'follow_up',
  'call',
  'email',
  'prepare_nda',
  'prepare_sample',
  'rnd_review',
  'logistics',
  'finance',
  'meeting',
  'other',
];
const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];
const BOARD_LANES: TaskStatus[] = ['open', 'in_progress', 'blocked', 'done'];

type FilterKey = 'mine' | 'team' | 'overdue' | 'due_today' | 'upcoming' | 'completed';

const FILTERS = (t: (key: string) => string): { key: FilterKey; label: string }[] => [
  { key: 'mine', label: t('filterMine') },
  { key: 'team', label: t('filterTeam') },
  { key: 'overdue', label: t('filterOverdue') },
  { key: 'due_today', label: t('filterDueToday') },
  { key: 'upcoming', label: t('filterUpcoming') },
  { key: 'completed', label: t('filterCompleted') },
];

type Stats = Awaited<ReturnType<typeof taskService.getStatistics>>;

/* ────────────────────────────── Helpers ────────────────────────────── */

const isActive = (t: Task) => t.status !== 'done' && t.status !== 'cancelled';
const sameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

/* ────────────────────────────── Page ────────────────────────────── */

export default function TasksPage() {
  const locale = useLocale() as Locale;
  const t = useTranslations('AdminTasks');
  const router = useRouter();
  const { account, session } = useSession();
  const role = session?.role;
  const canEditTasks = !!role && canEdit(role, 'tasks');
  const { nameOf } = useStaffDirectory();

  const [rows, setRows] = React.useState<Task[] | null>(null);
  const [companies, setCompanies] = React.useState<Map<string, Company>>(new Map());
  const [stats, setStats] = React.useState<Stats | null>(null);

  const [view, setView] = React.useState<'table' | 'board'>('table');
  const [filter, setFilter] = React.useState<FilterKey>('team');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Task | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [aiGenerating, setAiGenerating] = React.useState(false);
  const [drafting, setDrafting] = React.useState(false);

  React.useEffect(() => {
    taskService.list().then(setRows);
    taskService.getStatistics().then(setStats);
    companyService.list().then((cs) => setCompanies(new Map(cs.map((c) => [c.id, c]))));
  }, []);

  const companyName = React.useCallback(
    (id?: string) => {
      if (!id) return '—';
      const c = companies.get(id);
      return c ? c.tradingName || c.legalName : '—';
    },
    [companies],
  );

  const refreshStats = React.useCallback(() => {
    void taskService.getStatistics().then(setStats);
  }, []);

  /* ── filtering — computed per render (cheap array scans) so the buckets
        follow the real clock instead of the first page load ── */
  const now = new Date();
  const bucketOf = (key: FilterKey, data: Task[]): Task[] => {
    switch (key) {
      case 'mine':
        return data.filter((t) => t.ownerId === account?.id);
      case 'overdue':
        return data.filter((t) => isActive(t) && !!t.dueDate && isOverdue(t.dueDate, now));
      case 'due_today':
        return data.filter((t) => isActive(t) && !!t.dueDate && sameDay(new Date(t.dueDate), now));
      case 'upcoming':
        return data.filter(
          (t) =>
            isActive(t) &&
            !!t.dueDate &&
            new Date(t.dueDate) > now &&
            !sameDay(new Date(t.dueDate), now),
        );
      case 'completed':
        return data.filter((t) => t.status === 'done');
      case 'team':
      default:
        return data;
    }
  };
  const filtered = bucketOf(filter, rows ?? []);
  const filterCount = (key: FilterKey): number => bucketOf(key, rows ?? []).length;

  /* ── mutations (mock) ── */
  function toastActionFailed() {
    toast({ variant: 'danger', title: 'Action failed', description: 'The task could not be updated. Please try again.' });
  }

  async function completeTask(task: Task) {
    const snapshot = rows;
    setRows((prev) =>
      prev ? prev.map((x) => (x.id === task.id ? { ...x, status: 'done', completedAt: todayStamp() } : x)) : prev,
    );
    try {
      await taskService.update(task.id, { status: 'done', completedAt: todayStamp() });
    } catch {
      setRows(snapshot);
      toastActionFailed();
      return;
    }
    refreshStats();
    toast({
      variant: 'success',
      title: t('toastCompletedTitle'),
      description: t('toastCompletedDescription', { title: task.title }),
    });
  }

  async function reopenTask(task: Task) {
    const snapshot = rows;
    setRows((prev) =>
      prev
        ? prev.map((x) => (x.id === task.id ? { ...x, status: 'open', completedAt: undefined } : x))
        : prev,
    );
    try {
      await taskService.update(task.id, { status: 'open', completedAt: undefined });
    } catch {
      setRows(snapshot);
      toastActionFailed();
      return;
    }
    refreshStats();
    toast({
      variant: 'info',
      title: t('toastReopenedTitle'),
      description: t('toastReopenedDescription', { title: task.title }),
    });
  }

  async function moveTo(task: Task, status: TaskStatus) {
    if (status === task.status) return;
    const snapshot = rows;
    setRows((prev) =>
      prev
        ? prev.map((x) =>
            x.id === task.id
              ? {
                  ...x,
                  status,
                  completedAt: status === 'done' ? todayStamp() : undefined,
                }
              : x,
          )
        : prev,
    );
    try {
      await taskService.update(task.id, {
        status,
        completedAt: status === 'done' ? todayStamp() : undefined,
      });
    } catch {
      setRows(snapshot);
      toastActionFailed();
      return;
    }
    refreshStats();
    toast({
      variant: status === 'done' ? 'success' : 'info',
      title: t('toastStatusUpdatedTitle'),
      description: t('toastStatusUpdatedDescription', {
        title: task.title,
        status: getLabel('taskStatus', status),
      }),
    });
  }

  function handleCreate(t: Task) {
    setRows((prev) => (prev ? [t, ...prev] : [t]));
    refreshStats();
  }

  function requestDelete(task: Task) {
    setSelectedTask(null);
    setDeleteTarget(task);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const task = deleteTarget;
    setDeleting(true);
    try {
      await taskService.remove(task.id);
      setRows((previous) => previous?.filter((row) => row.id !== task.id) ?? previous);
      setDeleteTarget(null);
      refreshStats();
      toast({
        variant: 'success',
        title: t('toastDeletedTitle'),
        description: t('toastDeletedDescription', { title: task.title }),
      });
    } catch {
      toast({
        variant: 'danger',
        title: t('toastDeleteFailedTitle'),
        description: t('toastDeleteFailedDescription'),
      });
    } finally {
      setDeleting(false);
    }
  }

  async function generateTodayTasks() {
    setAiGenerating(true);
    try {
      const result = await generateAiTasksFromInbox(locale === 'it' ? 'it' : 'en');
      if (!result.ok) {
        const key =
          result.error === 'openai_not_configured'
            ? 'aiErrorOpenaiNotConfigured'
            : result.error === 'rate_limited'
              ? 'aiErrorRateLimited'
              : 'aiErrorGeneration';
        toast({ variant: 'danger', title: t('aiErrorTitle'), description: t(key) });
        return;
      }
      setRows((previous) => (previous ? [...result.tasks, ...previous] : result.tasks));
      setFilter('mine');
      refreshStats();
      toast({
        variant: 'success',
        title: t('aiGeneratedTitle'),
        description: result.tasks.length
          ? t('aiGeneratedDescription', { count: result.tasks.length })
          : t('aiNoTasksDescription'),
      });
    } catch {
      toast({ variant: 'danger', title: t('aiErrorTitle'), description: t('aiErrorGeneration') });
    } finally {
      setAiGenerating(false);
    }
  }

  async function draftReply(task: Task) {
    setDrafting(true);
    try {
      const result = await createAiReplyDraft(task.id, locale === 'it' ? 'it' : 'en');
      if (!result.ok) {
        const key =
          result.error === 'openai_not_configured'
            ? 'aiErrorOpenaiNotConfigured'
            : result.error === 'gmail_not_connected'
              ? 'aiErrorGmailNotConnected'
              : result.error === 'gmail_reconnect_required'
                ? 'aiErrorGmailReconnect'
                : 'aiErrorDraft';
        toast({ variant: 'danger', title: t('aiDraftErrorTitle'), description: t(key) });
        return;
      }
      setRows((previous) =>
        previous?.map((row) => (row.id === task.id ? { ...row, status: 'in_progress' } : row)) ?? previous,
      );
      setSelectedTask((current) =>
        current?.id === task.id ? { ...current, status: 'in_progress' } : current,
      );
      toast({ variant: 'success', title: t('aiDraftCreatedTitle'), description: t('aiDraftCreatedDescription') });
      window.open(result.gmailUrl, '_blank', 'noopener,noreferrer');
    } catch {
      toast({ variant: 'danger', title: t('aiDraftErrorTitle'), description: t('aiErrorDraft') });
    } finally {
      setDrafting(false);
    }
  }

  /* ── table columns ── */
  const columns: Column<Task>[] = [
    {
      key: 'done',
      header: '',
      className: 'w-10',
      cell: (task) => (
        <span onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
          <Checkbox
            checked={task.status === 'done'}
            disabled={!canEditTasks}
            aria-label={task.status === 'done' ? t('reopenTaskAria') : t('completeTaskAria')}
            onCheckedChange={(c) => (c ? completeTask(task) : reopenTask(task))}
          />
        </span>
      ),
    },
    {
      key: 'title',
      header: t('colTitle'),
      sortValue: (t) => t.title,
      cell: (t) => (
        <span
          className={cn(
            'block max-w-md truncate text-sm font-medium text-foreground transition-all',
            t.status === 'done' && 'text-muted-foreground line-through',
          )}
          title={t.title}
        >
          {t.title}
        </span>
      ),
    },
    {
      key: 'type',
      header: t('colType'),
      sortValue: (t) => getLabel('taskType', t.type),
      cell: (t) => <StatusBadge kind="taskType" value={t.type} />,
      hideable: true,
    },
    {
      key: 'company',
      header: t('colCompany'),
      sortValue: (t) => companyName(t.companyId),
      cell: (t) => {
        const c = t.companyId ? companies.get(t.companyId) : undefined;
        if (!c) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push('/admin/companies/' + c.id);
            }}
            className="flex items-center gap-2 text-left hover:underline"
          >
            <span className="text-base leading-none">{flagEmoji(c.countryCode)}</span>
            <span className="truncate text-sm font-medium text-foreground" title={c.tradingName || c.legalName}>
              {c.tradingName || c.legalName}
            </span>
          </button>
        );
      },
      hideable: true,
    },
    {
      key: 'priority',
      header: t('colPriority'),
      sortValue: (t) => PRIORITIES.indexOf(t.priority),
      cell: (t) => <PriorityBadge value={t.priority} />,
      hideable: true,
    },
    {
      key: 'due',
      header: t('colDue'),
      align: 'right',
      sortable: true,
      sortValue: (t) => (t.dueDate ? new Date(t.dueDate).getTime() : Number.MAX_SAFE_INTEGER),
      cell: (t) => {
        if (!t.dueDate) return <span className="text-sm text-muted-foreground">—</span>;
        const overdue = isActive(t) && isOverdue(t.dueDate, now);
        return (
          <span
            className={cn(
              'whitespace-nowrap text-sm',
              overdue ? 'font-semibold text-danger' : 'text-muted-foreground',
            )}
          >
            {formatDate(t.dueDate, locale)}
          </span>
        );
      },
      hideable: true,
    },
    {
      key: 'status',
      header: t('colStatus'),
      sortValue: (t) => getLabel('taskStatus', t.status),
      cell: (t) => <StatusBadge kind="taskStatus" value={t.status} />,
    },
    {
      key: 'assignee',
      header: t('colAssignee'),
      sortValue: (task) => nameOf(task.ownerId, t('unassigned')),
      cell: (task) => {
        const name = nameOf(task.ownerId, t('unassigned'));
        return (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy/10 text-2xs font-semibold text-brand-navy">
              {initials(name)}
            </span>
            <span className="text-sm">{name}</span>
          </span>
        );
      },
      hideable: true,
    },
  ];

  /* ── row actions ── */
  function rowActions(task: Task) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('rowActionsAria')}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {task.companyId ? (
            <>
              <DropdownMenuItem onSelect={() => router.push('/admin/companies/' + task.companyId)}>
                <ArrowRight />
                {t('openCompany')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {canEditTasks ? (
            <>
              <DropdownMenuLabel>{t('moveTo')}</DropdownMenuLabel>
              {BOARD_LANES.map((lane) => (
                <DropdownMenuItem key={lane} disabled={lane === task.status} onSelect={() => moveTo(task, lane)}>
                  {getLabel('taskStatus', lane)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-danger focus:bg-danger/10 focus:text-danger [&_svg]:!text-danger"
                onSelect={() => requestDelete(task)}
              >
                <Trash2 />
                {t('deleteTask')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  /* ── mobile card ── */
  function mobileCard(task: Task) {
    const overdue = isActive(task) && !!task.dueDate && isOverdue(task.dueDate, now);
    return (
      <Card className="p-3">
        <div className="flex items-start gap-2">
          <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
            <Checkbox
              checked={task.status === 'done'}
              disabled={!canEditTasks}
              aria-label={t('completeTaskAria')}
              onCheckedChange={(c) => (c ? completeTask(task) : reopenTask(task))}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'text-sm font-medium text-foreground',
                task.status === 'done' && 'text-muted-foreground line-through',
              )}
            >
              {task.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">{companyName(task.companyId)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge kind="taskStatus" value={task.status} />
              <StatusBadge kind="taskType" value={task.type} />
              <PriorityBadge value={task.priority} />
              {task.dueDate ? (
                <span className={cn('text-2xs', overdue ? 'font-semibold text-danger' : 'text-muted-foreground')}>
                  {formatDate(task.dueDate, locale)}
                </span>
              ) : null}
            </div>
          </div>
          <span onClick={(event) => event.stopPropagation()}>{rowActions(task)}</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('pageTitle')}
        subtitle={t('pageSubtitle')}
        actions={
          <>
            <div className="inline-flex items-center rounded-lg border bg-card p-0.5">
              <Button
                variant={view === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('table')}
                className="gap-1.5"
              >
                <Table2 className="h-4 w-4" />
                {t('viewList')}
              </Button>
              <Button
                variant={view === 'board' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('board')}
                className="gap-1.5"
              >
                <LayoutGrid className="h-4 w-4" />
                {t('viewBoard')}
              </Button>
            </div>
            {canEditTasks ? (
              <>
                <Button variant="outline" onClick={generateTodayTasks} disabled={aiGenerating}>
                  {aiGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {aiGenerating ? t('aiGenerating') : t('aiGenerateToday')}
                </Button>
                <Button variant="gold" onClick={() => setCreateOpen(true)}>
                  <Plus />
                  {t('newTask')}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label={t('statOpen')} value={stats?.open ?? 0} icon={ListTodo} tone="info" />
        <StatCard label={t('statOverdue')} value={stats?.overdue ?? 0} icon={AlertTriangle} tone="danger" delay={0.05} />
        <StatCard label={t('statDueToday')} value={stats?.dueToday ?? 0} icon={CalendarClock} tone="warning" delay={0.1} />
        <StatCard label={t('statCompleted')} value={stats?.completed ?? 0} icon={CheckCircle2} tone="success" delay={0.15} />
        <StatCard
          label={t('statCompletionRate')}
          value={stats?.completionRate ?? '—'}
          icon={Gauge}
          tone="gold"
          format={(n) => `${n}%`}
          delay={0.2}
        />
      </div>

      {/* Stalled conversations. Sits above the task list because it is work the
          task list cannot show you: nobody creates a task for silence. */}
      <FollowUpPanel />

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS(t).map((f) => {
          const active = filter === f.key;
          return (
            <Button
              key={f.key}
              variant={active ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.key)}
              className="gap-1.5"
            >
              {f.label}
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-2xs font-semibold tabular',
                  active ? 'bg-brand-navy/10 text-brand-navy' : 'bg-muted text-muted-foreground',
                )}
              >
                {filterCount(f.key)}
              </span>
            </Button>
          );
        })}
        {filter !== 'team' ? (
          <Button variant="ghost" size="sm" onClick={() => setFilter('team')}>
            <X />
            {t('reset')}
          </Button>
        ) : null}
      </div>

      {/* List / Board */}
      {view === 'table' ? (
        <DataTable<Task>
          data={filtered}
          columns={columns}
          getRowId={(t) => t.id}
          loading={rows === null}
          searchable
          searchPlaceholder={t('searchPlaceholder')}
          searchValue={(task) => [task.title, task.description, companyName(task.companyId), nameOf(task.ownerId, t('unassigned'))].filter(Boolean).join(' ')}
          pageSize={12}
          rowActions={rowActions}
          onRowClick={setSelectedTask}
          mobileCard={mobileCard}
          enableColumnVisibility
          enableDensityToggle
          emptyTitle={t('emptyTitle')}
          emptyDescription={t('emptyDescription')}
          exportFilename="tasks"
          storageKey="tasks-table"
        />
      ) : (
        <TaskBoard
          rows={filtered}
          loading={rows === null}
          locale={locale}
          companyName={companyName}
          canEditTasks={canEditTasks}
          onMove={moveTo}
          onDelete={requestDelete}
        />
      )}

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companies={[...companies.values()]}
        defaultOwnerId={account?.id ?? ''}
        onCreated={handleCreate}
      />

      <Dialog open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-w-xl">
          {selectedTask ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTask.title}</DialogTitle>
                <DialogDescription>{t('detailsDescription')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t('colStatus')}</p>
                    <div className="mt-1"><StatusBadge kind="taskStatus" value={selectedTask.status} /></div>
                  </div>
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t('colPriority')}</p>
                    <div className="mt-1"><PriorityBadge value={selectedTask.priority} /></div>
                  </div>
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t('colType')}</p>
                    <div className="mt-1"><StatusBadge kind="taskType" value={selectedTask.type} /></div>
                  </div>
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t('colDue')}</p>
                    <p className="mt-1 text-sm font-medium">{selectedTask.dueDate ? formatDate(selectedTask.dueDate, locale) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t('colCompany')}</p>
                    <p className="mt-1 truncate text-sm font-medium">{companyName(selectedTask.companyId)}</p>
                  </div>
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t('colAssignee')}</p>
                    <p className="mt-1 truncate text-sm font-medium">{nameOf(selectedTask.ownerId, t('unassigned'))}</p>
                  </div>
                </div>
                <div>
                  <Label>{t('detailsBody')}</Label>
                  <p className="mt-1.5 whitespace-pre-wrap rounded-lg border bg-card p-3 text-sm leading-relaxed text-muted-foreground">
                    {selectedTask.description || t('detailsNoDescription')}
                  </p>
                </div>
                {selectedTask.relatedType === 'email_message' ? (
                  <div className="flex items-start gap-2 rounded-lg border border-brand-gold/30 bg-brand-gold/5 p-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t('aiEmailSourceTitle')}</p>
                      <p className="text-xs text-muted-foreground">{t('aiEmailSourceDescription')}</p>
                    </div>
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                {canEditTasks ? (
                  <Button variant="destructive" onClick={() => requestDelete(selectedTask)}>
                    <Trash2 />
                    {t('deleteTask')}
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => setSelectedTask(null)}>{t('close')}</Button>
                {canEditTasks && selectedTask.relatedType === 'email_message' ? (
                  <Button variant="gold" onClick={() => draftReply(selectedTask)} disabled={drafting}>
                    {drafting ? <Loader2 className="animate-spin" /> : <MailPlus />}
                    {drafting ? t('aiDrafting') : t('aiDraftReply')}
                    {!drafting ? <ExternalLink className="h-3.5 w-3.5" /> : null}
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('deleteDialogTitle')}</DialogTitle>
            <DialogDescription>
              {deleteTarget ? t('deleteDialogDescription', { title: deleteTarget.title }) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {deleting ? t('deletingTask') : t('confirmDeleteTask')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ────────────────────────────── Board view ────────────────────────────── */

function TaskBoard({
  rows,
  loading,
  locale,
  companyName,
  canEditTasks,
  onMove,
  onDelete,
}: {
  rows: Task[];
  loading: boolean;
  locale: Locale;
  companyName: (id?: string) => string;
  canEditTasks: boolean;
  onMove: (t: Task, status: TaskStatus) => void;
  onDelete: (t: Task) => void;
}) {
  const t = useTranslations('AdminTasks');
  // Native HTML5 drag-and-drop rather than a drag library: a four-lane board
  // moving whole cards needs no collision detection or sort ordering, and the
  // dropdown "Move to" below stays the keyboard-accessible path, so nothing is
  // reachable only by pointer.
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [draggingStatus, setDraggingStatus] = React.useState<TaskStatus | null>(null);
  const [dragOverLane, setDragOverLane] = React.useState<TaskStatus | null>(null);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-64 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const lanes = BOARD_LANES.map((status) => ({
    status,
    items: rows.filter((t) => t.status === status),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {lanes.map(({ status, items }) => (
        <div
          key={status}
          className={cn(
            'flex w-72 shrink-0 flex-col rounded-lg border bg-muted/40 transition-colors',
            // Only the lanes a drop would actually change light up, so dragging
            // back to where the card came from reads as the no-op it is.
            dragOverLane === status && draggingStatus !== status && 'border-brand-gold bg-brand-gold/10',
          )}
          onDragOver={(event) => {
            if (!canEditTasks || !draggingId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDragOverLane(status);
          }}
          onDragLeave={(event) => {
            // Ignore the leave events fired while crossing child elements.
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setDragOverLane((current) => (current === status ? null : current));
          }}
          onDrop={(event) => {
            event.preventDefault();
            const id = event.dataTransfer.getData('text/plain') || draggingId;
            const task = id ? rows.find((row) => row.id === id) : undefined;
            setDraggingId(null);
            setDragOverLane(null);
            if (task && task.status !== status) onMove(task, status);
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <StatusBadge kind="taskStatus" value={status} />
            <span className="text-xs font-semibold tabular text-muted-foreground">{items.length}</span>
          </div>
          <div className="flex flex-col gap-2 p-2">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                {dragOverLane === status ? t('dropHere') : t('noTasks')}
              </p>
            ) : (
              items.map((task) => {
                const overdue =
                  task.status !== 'done' && task.status !== 'cancelled' && !!task.dueDate && isOverdue(task.dueDate, new Date());
                return (
                  <div
                    key={task.id}
                    draggable={canEditTasks}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', task.id);
                      event.dataTransfer.effectAllowed = 'move';
                      setDraggingId(task.id);
                      setDraggingStatus(task.status);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDraggingStatus(null);
                      setDragOverLane(null);
                    }}
                    className={cn(
                      'rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md',
                      canEditTasks && 'cursor-grab active:cursor-grabbing',
                      draggingId === task.id && 'opacity-40',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'text-sm font-medium text-foreground',
                          task.status === 'done' && 'text-muted-foreground line-through',
                        )}
                      >
                        {task.title}
                      </p>
                      {canEditTasks ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={t('moveTaskAria')}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('moveTo')}</DropdownMenuLabel>
                            {BOARD_LANES.map((lane) => (
                              <DropdownMenuItem
                                key={lane}
                                disabled={lane === task.status}
                                onSelect={() => onMove(task, lane)}
                              >
                                {getLabel('taskStatus', lane)}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-danger focus:bg-danger/10 focus:text-danger [&_svg]:!text-danger"
                              onSelect={() => onDelete(task)}
                            >
                              <Trash2 />
                              {t('deleteTask')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{companyName(task.companyId)}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <PriorityBadge value={task.priority} />
                      {task.dueDate ? (
                        <span
                          className={cn(
                            'text-2xs',
                            overdue ? 'font-semibold text-danger' : 'text-muted-foreground',
                          )}
                        >
                          {formatDate(task.dueDate, locale)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────── Create dialog ────────────────────────────── */

function CreateTaskDialog({
  open,
  onOpenChange,
  companies,
  defaultOwnerId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  defaultOwnerId: string;
  onCreated: (t: Task) => void;
}) {
  const t = useTranslations('AdminTasks');
  const NONE = '__none__';
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState<TaskType>('follow_up');
  const [companyId, setCompanyId] = React.useState<string>(NONE);
  const [priority, setPriority] = React.useState<Priority>('medium');
  const [dueDate, setDueDate] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const sortedCompanies = React.useMemo(
    () =>
      [...companies].sort((a, b) =>
        (a.tradingName || a.legalName).localeCompare(b.tradingName || b.legalName),
      ),
    [companies],
  );

  function reset() {
    setTitle('');
    setType('follow_up');
    setCompanyId(NONE);
    setPriority('medium');
    setDueDate('');
  }

  const valid = title.trim().length > 0;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));

    const task: Task = {
      id: uid('task'),
      title: title.trim(),
      type,
      companyId: companyId === NONE ? undefined : companyId,
      ownerId: defaultOwnerId,
      priority,
      dueDate: dueDate || undefined,
      status: 'open',
      createdAt: todayStamp(),
    };

    try {
      await taskService.create(task);
      onCreated(task);
      toast({
        variant: 'success',
        title: t('toastCreatedTitle'),
        description: t('toastCreatedDescription', { title: task.title }),
      });
      reset();
      onOpenChange(false);
    } catch {
      toast({ variant: 'danger', title: 'Action failed', description: 'The task could not be created. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="task-title">{t('labelTitle')}</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('labelType')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {getLabel('taskType', t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('labelPriority')}</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {getLabel('priority', p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('labelCompany')}</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder={t('noCompany')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t('noCompany')}</SelectItem>
                {sortedCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {flagEmoji(c.countryCode)} {c.tradingName || c.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-due">{t('labelDueDate')}</Label>
            <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button variant="gold" onClick={submit} disabled={!valid || submitting}>
            {submitting ? t('creating') : t('createTask')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
