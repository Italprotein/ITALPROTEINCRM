'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Trophy, XCircle, PauseCircle } from 'lucide-react';

import type { Company, RelationshipStage } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';

/*
 * The commercial pipeline, first contact → won.
 *
 * A funnel rather than a bar chart: the point of a pipeline is where deals fall
 * out, so each step shows both how many companies reached it and what share of
 * the previous step survived. Won / Lost / Dormant are terminal outcomes and sit
 * apart from the flow rather than pretending to be steps in it.
 */

/** The forward path. Order defines the funnel; terminal states are excluded. */
const FUNNEL: RelationshipStage[] = [
  'lead',
  'contacted',
  'interested',
  'qualified',
  'nda_in_progress',
  'nda_signed',
  'sampling',
  'testing',
  'commercial_discussion',
  'customer',
];

/** Warm red at the top of the funnel through to green at the close. */
const STEP_COLOR = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#a3b110',
  '#84cc16', '#4ade80', '#22c55e', '#16a34a', '#15803d',
];

const TERMINAL: { stage: RelationshipStage; icon: typeof Trophy; tone: string }[] = [
  { stage: 'customer', icon: Trophy, tone: 'text-success-foreground bg-success-subtle border-success/40' },
  { stage: 'lost', icon: XCircle, tone: 'text-danger bg-danger-subtle border-danger/40' },
  { stage: 'dormant', icon: PauseCircle, tone: 'text-warning-foreground bg-warning-subtle border-warning/40' },
];

export function PipelineFunnel({ companies }: { companies: Company[] }) {
  const counts = React.useMemo(() => {
    const map = new Map<RelationshipStage, number>();
    for (const c of companies) {
      map.set(c.relationshipStage, (map.get(c.relationshipStage) ?? 0) + 1);
    }
    return map;
  }, [companies]);

  // "Reached" is cumulative: a company at `sampling` has necessarily passed
  // every earlier step, so counting only its current stage would understate the
  // funnel badly. Repeat customers count as customers.
  const reached = React.useMemo(() => {
    const atOrBeyond = (i: number) =>
      FUNNEL.slice(i).reduce((sum, s) => sum + (counts.get(s) ?? 0), 0) +
      (i <= FUNNEL.indexOf('customer') ? counts.get('repeat_customer') ?? 0 : 0);
    return FUNNEL.map((stage, i) => ({ stage, count: atOrBeyond(i) }));
  }, [counts]);

  const top = reached[0]?.count || 1;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        {reached.map(({ stage, count }, i) => {
          const widthPct = Math.max((count / top) * 100, count > 0 ? 8 : 3);
          const prev = i === 0 ? count : reached[i - 1].count;
          const stepRate = prev > 0 ? Math.round((count / prev) * 100) : 0;
          const overallRate = top > 0 ? ((count / top) * 100).toFixed(1) : '0';

          return (
            <div key={stage} className="flex items-center gap-3">
              <span className="w-44 shrink-0 truncate text-right text-sm font-medium">
                {getLabel('relationshipStage', stage)}
              </span>

              <div className="relative h-9 flex-1">
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: `${widthPct}%`, opacity: 1 }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  className="flex h-full items-center rounded-md px-3 text-sm font-semibold text-white shadow-sm"
                  style={{ backgroundColor: STEP_COLOR[i] ?? STEP_COLOR[STEP_COLOR.length - 1] }}
                  title={`${count} ${count === 1 ? 'company' : 'companies'} reached ${getLabel('relationshipStage', stage)}`}
                >
                  <span className="tabular">{count}</span>
                </motion.div>
              </div>

              <span className="w-28 shrink-0 text-xs text-muted-foreground tabular">
                {overallRate}%
                {i > 0 && (
                  <span className={cn('ml-1.5', stepRate < 50 ? 'text-danger' : 'text-muted-foreground/70')}>
                    ({stepRate}%)
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        First figure: share of all companies that reached the step. In brackets: share that carried
        over from the step above — the drop-off worth acting on.
      </p>

      {/* Terminal outcomes sit outside the funnel: they are results, not steps. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {TERMINAL.map(({ stage, icon: Icon, tone }) => {
          const count =
            stage === 'customer'
              ? (counts.get('customer') ?? 0) + (counts.get('repeat_customer') ?? 0)
              : counts.get(stage) ?? 0;
          return (
            <div key={stage} className={cn('flex items-center gap-3 rounded-lg border p-4', tone)}>
              <Icon className="h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular leading-none">{count}</p>
                <p className="mt-1 truncate text-xs">{getLabel('relationshipStage', stage)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
