'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ChevronUp,
  Download,
  Inbox,
  Rows3,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  cell?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headClassName?: string;
  hideable?: boolean;
  defaultHidden?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: (row: T) => string;
  pageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
  bulkActions?: (ids: string[], clear: () => void) => React.ReactNode;
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  expandedContent?: (row: T) => React.ReactNode;
  toolbar?: React.ReactNode;
  density?: 'compact' | 'comfortable';
  enableDensityToggle?: boolean;
  enableColumnVisibility?: boolean;
  mobileCard?: (row: T) => React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  exportFilename?: string;
  storageKey?: string;
  /** Column key + direction to sort by on first render (until the user clicks a header). */
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  className?: string;
}

type SortDir = 'asc' | 'desc' | null;

const alignClass: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

/** Best-effort plain-text extraction from a React node (for search + CSV). */
function nodeToText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join(' ');
  if (React.isValidElement(node)) {
    return nodeToText((node.props as { children?: React.ReactNode }).children);
  }
  return '';
}

/** Resolve a column's text value for a row (sortValue → cell → key lookup). */
function cellText<T>(col: Column<T>, row: T): string {
  if (col.sortValue) return String(col.sortValue(row));
  if (col.cell) return nodeToText(col.cell(row));
  const raw = (row as Record<string, unknown>)[col.key];
  return raw == null ? '' : String(raw);
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function DataTable<T>(props: DataTableProps<T>): React.JSX.Element {
  const {
    data,
    columns,
    getRowId,
    loading = false,
    error = null,
    onRetry,
    searchable = false,
    searchPlaceholder = 'Search…',
    searchValue,
    pageSize = 10,
    selectable = false,
    onSelectionChange,
    bulkActions,
    rowActions,
    onRowClick,
    expandedContent,
    toolbar,
    density: densityProp,
    enableDensityToggle = false,
    enableColumnVisibility = false,
    mobileCard,
    emptyTitle = 'Nothing here yet',
    emptyDescription,
    exportFilename,
    storageKey,
    defaultSortKey,
    defaultSortDir,
    className,
  } = props;

  // ── state ──────────────────────────────────────────────────────────────
  const [query, setQuery] = React.useState('');
  const [sortKey, setSortKey] = React.useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = React.useState<SortDir>(defaultSortDir ?? null);
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [density, setDensity] = React.useState<'compact' | 'comfortable'>(
    densityProp ?? 'comfortable',
  );
  const [hidden, setHidden] = React.useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const c of columns) if (c.defaultHidden) initial.add(c.key);
    return initial;
  });
  const [hydrated, setHydrated] = React.useState(false);

  // keep controlled density in sync if the prop changes
  React.useEffect(() => {
    if (densityProp) setDensity(densityProp);
  }, [densityProp]);

  // ── persist hidden columns to localStorage ─────────────────────────────
  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(`datatable:${storageKey}:hidden`);
      if (raw) setHidden(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, [storageKey]);

  React.useEffect(() => {
    if (!storageKey || !hydrated) return;
    try {
      window.localStorage.setItem(
        `datatable:${storageKey}:hidden`,
        JSON.stringify(Array.from(hidden)),
      );
    } catch {
      /* storage may be unavailable */
    }
  }, [hidden, storageKey, hydrated]);

  // ── derived: visible columns ───────────────────────────────────────────
  const visibleColumns = React.useMemo(
    () => columns.filter((c) => !hidden.has(c.key)),
    [columns, hidden],
  );
  const hideableColumns = React.useMemo(
    () => columns.filter((c) => c.hideable),
    [columns],
  );

  // ── derived: filtered rows ─────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) => {
      const haystack = searchValue
        ? searchValue(row)
        : columns.map((c) => cellText(c, row)).join(' ');
      return haystack.toLowerCase().includes(q);
    });
  }, [data, query, searchValue, columns]);

  // ── derived: sorted rows ───────────────────────────────────────────────
  const sorted = React.useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const getVal = (row: T): string | number =>
      col.sortValue ? col.sortValue(row) : cellText(col, row);
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
    });
  }, [filtered, sortKey, sortDir, columns]);

  // ── pagination ─────────────────────────────────────────────────────────
  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);

  React.useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  // reset to first page when the filter result set changes meaningfully
  React.useEffect(() => {
    setPage(0);
  }, [query, sortKey, sortDir]);

  const pageRows = React.useMemo(
    () => sorted.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [sorted, safePage, pageSize],
  );

  const rangeStart = total === 0 ? 0 : safePage * pageSize + 1;
  const rangeEnd = Math.min(total, safePage * pageSize + pageSize);

  // ── selection ──────────────────────────────────────────────────────────
  const pageIds = React.useMemo(() => pageRows.map(getRowId), [pageRows, getRowId]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  const emitSelection = React.useCallback(
    (next: Set<string>) => {
      setSelected(next);
      onSelectionChange?.(Array.from(next));
    },
    [onSelectionChange],
  );

  const toggleRow = React.useCallback(
    (id: string) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      emitSelection(next);
    },
    [selected, emitSelection],
  );

  const togglePage = React.useCallback(() => {
    const next = new Set(selected);
    if (allPageSelected) for (const id of pageIds) next.delete(id);
    else for (const id of pageIds) next.add(id);
    emitSelection(next);
  }, [selected, allPageSelected, pageIds, emitSelection]);

  const clearSelection = React.useCallback(() => emitSelection(new Set()), [emitSelection]);

  // ── sorting handler ────────────────────────────────────────────────────
  const handleSort = React.useCallback(
    (key: string) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDir('asc');
        return;
      }
      // cycle asc → desc → none
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') {
        setSortDir(null);
        setSortKey(null);
      } else setSortDir('asc');
    },
    [sortKey, sortDir],
  );

  // ── expansion ──────────────────────────────────────────────────────────
  const toggleExpand = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── CSV export (current filtered + sorted set) ─────────────────────────
  const handleExport = React.useCallback(() => {
    const cols = visibleColumns;
    const header = cols.map((c) => csvEscape(c.header)).join(',');
    const lines = sorted.map((row) =>
      cols.map((c) => csvEscape(cellText(c, row))).join(','),
    );
    const csv = [header, ...lines].join('\r\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFilename ?? 'export'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [visibleColumns, sorted, exportFilename]);

  // ── animation tuning ───────────────────────────────────────────────────
  const stagger = pageRows.length <= 40;

  // column counting for skeleton / colspans
  const leadCols = (selectable ? 1 : 0) + (expandedContent ? 1 : 0);
  const trailCols = rowActions ? 1 : 0;
  const colCount = leadCols + visibleColumns.length + trailCols;

  const showToolbar =
    searchable ||
    !!toolbar ||
    !!exportFilename ||
    (enableColumnVisibility && hideableColumns.length > 0) ||
    enableDensityToggle;

  const selectedCount = selected.size;

  // ── render: error ──────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={cn('w-full', className)}>
        <ErrorState description={error} onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      {/* ── toolbar ── */}
      {showToolbar ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            {searchable ? (
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 pl-9 pr-9"
                  aria-label="Search table"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
            {toolbar}
          </div>

          <div className="flex items-center gap-2">
            {enableDensityToggle ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact'))
                }
                aria-pressed={density === 'compact'}
                title={density === 'compact' ? 'Comfortable rows' : 'Compact rows'}
              >
                <Rows3 />
                <span className="hidden sm:inline">
                  {density === 'compact' ? 'Compact' : 'Comfortable'}
                </span>
              </Button>
            ) : null}

            {enableColumnVisibility && hideableColumns.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal />
                    <span className="hidden sm:inline">Columns</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[12rem]">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {hideableColumns.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.key}
                      checked={!hidden.has(c.key)}
                      onCheckedChange={(checked) =>
                        setHidden((prev) => {
                          const next = new Set(prev);
                          if (checked) next.delete(c.key);
                          else next.add(c.key);
                          return next;
                        })
                      }
                      onSelect={(e) => e.preventDefault()}
                    >
                      {c.header}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {exportFilename ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={loading || total === 0}
                title="Export visible rows to CSV"
              >
                <Download />
                <span className="hidden sm:inline">Export</span>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ── bulk actions bar ── */}
      <AnimatePresence initial={false}>
        {selectable && selectedCount > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-accent/60 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-foreground tabular">
                  {selectedCount}
                </span>
                <span className="text-muted-foreground">
                  {selectedCount === 1 ? 'row' : 'rows'} selected
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2">
                {bulkActions?.(Array.from(selected), clearSelection)}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── mobile cards ── */}
      {mobileCard ? (
        <div className="flex flex-col gap-3 md:hidden">
          {loading ? (
            Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
              <div key={i} className="skeleton h-24 w-full rounded-lg" />
            ))
          ) : pageRows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={query ? 'No matches' : emptyTitle}
              description={query ? 'Try a different search term.' : emptyDescription}
            />
          ) : (
            pageRows.map((row, i) => {
              const id = getRowId(row);
              return (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: stagger ? Math.min(i * 0.02, 0.2) : 0,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && 'cursor-pointer')}
                >
                  {mobileCard(row)}
                </motion.div>
              );
            })
          )}
        </div>
      ) : null}

      {/* ── table ── */}
      <div
        className={cn(
          density === 'compact' ? 'density-compact' : 'density-comfortable',
          mobileCard ? 'hidden md:block' : 'block',
        )}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectable ? (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                    onCheckedChange={togglePage}
                    aria-label="Select all rows on this page"
                    disabled={loading || pageIds.length === 0}
                  />
                </TableHead>
              ) : null}
              {expandedContent ? <TableHead className="w-10" /> : null}

              {visibleColumns.map((col) => {
                const isSorted = sortKey === col.key;
                const align = col.align ?? 'left';
                return (
                  <TableHead
                    key={col.key}
                    className={cn(alignClass[align], col.headClassName)}
                    aria-sort={
                      isSorted
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : sortDir === 'desc'
                            ? 'descending'
                            : 'none'
                        : undefined
                    }
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className={cn(
                          'group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-semibold uppercase tracking-wide transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          align === 'right' && 'flex-row-reverse',
                          align === 'center' && 'mx-auto',
                          isSorted ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        <span>{col.header}</span>
                        {isSorted && sortDir === 'asc' ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : isSorted && sortDir === 'desc' ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover/sort:opacity-70" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}

              {rowActions ? <TableHead className="w-px text-right" /> : null}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                  {Array.from({ length: colCount }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="skeleton h-4 w-full max-w-[140px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colCount} className="p-0">
                  <EmptyState
                    icon={Inbox}
                    title={query ? 'No matches' : emptyTitle}
                    description={
                      query ? 'Try a different search term.' : emptyDescription
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, i) => {
                const id = getRowId(row);
                const isSelected = selected.has(id);
                const isExpanded = expanded.has(id);
                return (
                  <React.Fragment key={id}>
                    <motion.tr
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: stagger ? Math.min(i * 0.015, 0.18) : 0,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      data-state={isSelected ? 'selected' : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        'group border-b border-border transition-colors hover:bg-muted/40 data-[state=selected]:bg-accent/60',
                        onRowClick && 'cursor-pointer',
                      )}
                    >
                      {selectable ? (
                        <TableCell
                          className="w-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(id)}
                            aria-label={`Select row ${id}`}
                          />
                        </TableCell>
                      ) : null}

                      {expandedContent ? (
                        <TableCell
                          className="w-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => toggleExpand(id)}
                            aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                            aria-expanded={isExpanded}
                            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <ChevronRight
                              className={cn(
                                'h-4 w-4 transition-transform duration-200',
                                isExpanded && 'rotate-90',
                              )}
                            />
                          </button>
                        </TableCell>
                      ) : null}

                      {visibleColumns.map((col) => {
                        const align = col.align ?? 'left';
                        return (
                          <TableCell
                            key={col.key}
                            className={cn(alignClass[align], col.className)}
                          >
                            {col.cell
                              ? col.cell(row)
                              : ((row as Record<string, unknown>)[col.key] as React.ReactNode) ??
                                '—'}
                          </TableCell>
                        );
                      })}

                      {rowActions ? (
                        <TableCell
                          className="w-px text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-end opacity-100 transition-opacity md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
                            {rowActions(row)}
                          </div>
                        </TableCell>
                      ) : null}
                    </motion.tr>

                    {expandedContent ? (
                      <tr className="border-0">
                        <td colSpan={colCount} className="p-0">
                          <AnimatePresence initial={false}>
                            {isExpanded ? (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden"
                              >
                                <div className="border-b border-border bg-muted/30 px-[var(--cell-padding-x)] py-3">
                                  {expandedContent(row)}
                                </div>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── pagination footer ── */}
      {!loading && total > 0 ? (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground tabular">
            <span className="font-medium text-foreground">{rangeStart}</span>
            {'–'}
            <span className="font-medium text-foreground">{rangeEnd}</span> of{' '}
            <span className="font-medium text-foreground">{total}</span>
          </p>
          {pageCount > 1 ? (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage(0)}
                disabled={safePage === 0}
                aria-label="First page"
              >
                <ChevronsLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <span className="px-2 text-sm text-muted-foreground tabular">
                Page <span className="font-medium text-foreground">{safePage + 1}</span> /{' '}
                {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                aria-label="Next page"
              >
                <ChevronRight />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage(pageCount - 1)}
                disabled={safePage >= pageCount - 1}
                aria-label="Last page"
              >
                <ChevronsRight />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
