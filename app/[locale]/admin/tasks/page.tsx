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

/* ────────────────────────────── Constants ────────────────────────────── */

const NOW = new Date();
const TODAY = NOW.toISOString().slice(0, 10);

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

  /* ── filtering ── */
  const filtered = React.useMemo(() => {
    const data = rows ?? [];
    switch (filter) {
      case 'mine':
        return data.filter((t) => t.ownerId === account?.id);
      case 'overdue':
        return data.filter((t) => isActive(t) && !!t.dueDate && isOverdue(t.dueDate, NOW));
      case 'due_today':
        return data.filter((t) => isActive(t) && !!t.dueDate && sameDay(new Date(t.dueDate), NOW));
      case 'upcoming':
        return data.filter(
          (t) =>
            isActive(t) &&
            !!t.dueDate &&
            new Date(t.dueDate) > NOW &&
            !sameDay(new Date(t.dueDate), NOW),
        );
      case 'completed':
        return data.filter((t) => t.status === 'done');
      case 'team':
      default:
        return data;
    }
  }, [rows, filter, account?.id]);

  const filterCount = React.useCallback(
    (key: FilterKey): number => {
      const data = rows ?? [];
      switch (key) {
        case 'mine':
          return data.filter((t) => t.ownerId === account?.id).length;
        case 'overdue':
          return data.filter((t) => isActive(t) && !!t.dueDate && isOverdue(t.dueDate, NOW)).length;
        case 'due_today':
          return data.filter((t) => isActive(t) && !!t.dueDate && sameDay(new Date(t.dueDate), NOW))
            .length;
        case 'upcoming':
          return data.filter(
            (t) =>
              isActive(t) &&
              !!t.dueDate &&
              new Date(t.dueDate) > NOW &&
              !sameDay(new Date(t.dueDate), NOW),
          ).length;
        case 'completed':
          return data.filter((t) => t.status === 'done').length;
        case 'team':
        default:
          return data.length;
      }
    },
    [rows, account?.id],
  );

  /* ── mutations (mock) ── */
  function toastActionFailed() {
    toast({ variant: 'danger', title: 'Action failed', description: 'The task could not be updated. Please try again.' });
  }

  async function completeTask(task: Task) {
    const snapshot = rows;
    setRows((prev) =>
      prev ? prev.map((x) => (x.id === task.id ? { ...x, status: 'done', completedAt: TODAY } : x)) : prev,
    );
    try {
      await taskService.update(task.id, { status: 'done', completedAt: TODAY });
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
                  completedAt: status === 'done' ? TODAY : undefined,
                }
              : x,
          )
        : prev,
    );
    try {
      await taskService.update(task.id, {
        status,
        completedAt: status === 'done' ? TODAY : undefined,
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
            'text-sm font-medium text-foreground transition-all',
            t.status === 'done' && 'text-muted-foreground line-through',
          )}
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
            <span className="truncate text-sm font-medium text-foreground">
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
        const overdue = isActive(t) && isOverdue(t.dueDate, NOW);
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
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  /* ── mobile card ── */
  function mobileCard(task: Task) {
    const overdue = isActive(task) && !!task.dueDate && isOverdue(task.dueDate, NOW);
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
              <Button variant="gold" onClick={() => setCreateOpen(true)}>
                <Plus />
                {t('newTask')}
              </Button>
            ) : null}
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label={t('statOpen')} value={stats?.open ?? 0} icon={ListTodo} tone="info" />
        <StatCard label={t('statOverdue')} value={stats?.overdue ?? 0} icon={AlertTriangle} tone="danger" delay={0.05} />
        <StatCard label={t('statDueToday')} value={stats?.dueToday ?? 0} icon={CalendarClock} tone="warning" delay={0.1} />
        <StatCard label={t('statCompleted')} value={stats?.completed ?? 0} icon={CheckCircle2} tone="success" delay={0.15} />
        <StatCard
          label={t('statCompletionRate')}
          value={stats?.completionRate ?? 0}
          icon={Gauge}
          tone="gold"
          format={(n) => `${n}%`}
          delay={0.2}
        />
      </div>

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
        />
      )}

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companies={[...companies.values()]}
        defaultOwnerId={account?.id ?? ''}
        onCreated={handleCreate}
      />
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
}: {
  rows: Task[];
  loading: boolean;
  locale: Locale;
  companyName: (id?: string) => string;
  canEditTasks: boolean;
  onMove: (t: Task, status: TaskStatus) => void;
}) {
  const t = useTranslations('AdminTasks');
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
        <div key={status} className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/40">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <StatusBadge kind="taskStatus" value={status} />
            <span className="text-xs font-semibold tabular text-muted-foreground">{items.length}</span>
          </div>
          <div className="flex flex-col gap-2 p-2">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">{t('noTasks')}</p>
            ) : (
              items.map((task) => {
                const overdue =
                  task.status !== 'done' && task.status !== 'cancelled' && !!task.dueDate && isOverdue(task.dueDate, NOW);
                return (
                  <div
                    key={task.id}
                    className="rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
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
      createdAt: TODAY,
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

        <div className="grid gap-4 sm:grid-cols-2">
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
