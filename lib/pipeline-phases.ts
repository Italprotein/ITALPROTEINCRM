/**
 * The twenty pipeline stages, folded into the six phases the taxonomy already
 * groups them into.
 *
 * `PIPELINE_STAGES` in lib/types.ts is written across six lines, and those line
 * breaks are not cosmetic — they are the phases a deal actually moves through:
 * prospecting, NDA, calls, sampling, commercial, customer. This module makes
 * that grouping explicit and countable.
 *
 * It exists for the home dashboard's pipeline bar, where twenty segments would
 * be twenty unreadable slivers and twenty legend chips would be exactly the
 * noise the redesign removes. The alternative — keeping the largest N stages and
 * lumping the rest into "other" — was rejected: membership would change with the
 * data, so a stage could own a band one day and silently vanish the next, and on
 * the current book it buried 43% of the pipeline (including `quotation` and
 * `commercial_discussion`, the stages a rep actually acts on) in the "other"
 * bucket. Fixed buckets, stable membership, same "no twenty chips" outcome.
 *
 * `labelKey` is a key inside the `Overview` next-intl namespace, so the label
 * text itself never lives in this module and both locales stay in messages/.
 */
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/types';

export interface PipelinePhase {
  key: string;
  /** Key within the `Overview` messages namespace. */
  labelKey: string;
  /** In `PIPELINE_STAGES` order. Every stage belongs to exactly one phase. */
  stages: PipelineStage[];
}

export const PIPELINE_PHASES: PipelinePhase[] = [
  {
    key: 'prospecting',
    labelKey: 'phaseProspecting',
    stages: ['lead', 'contacted', 'interested', 'qualified'],
  },
  {
    key: 'nda',
    labelKey: 'phaseNda',
    stages: ['nda_to_prepare', 'nda_sent', 'nda_negotiation', 'nda_signed'],
  },
  {
    key: 'calls',
    labelKey: 'phaseCalls',
    stages: ['introductory_call', 'technical_call'],
  },
  {
    key: 'sampling',
    labelKey: 'phaseSampling',
    stages: ['sample_requested', 'sample_approved', 'sample_shipped', 'sample_delivered'],
  },
  {
    key: 'commercial',
    labelKey: 'phaseCommercial',
    stages: ['application_testing', 'feedback_received', 'commercial_discussion', 'quotation'],
  },
  {
    key: 'customer',
    labelKey: 'phaseCustomer',
    stages: ['customer', 'repeat_customer'],
  },
];

/** A phase plus how many opportunities are sitting in it. */
export interface PipelinePhaseTally extends PipelinePhase {
  count: number;
}

/**
 * Rolls a per-stage count list (`opportunityService.getStatistics().byStage`,
 * identical in mock and api mode) up into the six phases.
 *
 * Stages outside `PIPELINE_STAGES` — the terminal `lost` / `inactive` family —
 * are ignored rather than silently absorbed: they are outcomes, not places a
 * deal is currently sitting, and the bar is a picture of live pipeline.
 * Phases with no opportunities are dropped so an empty bucket never claims its
 * minimum band width.
 */
export function tallyPipelinePhases(
  byStage: readonly { stage: string; count: number }[],
): PipelinePhaseTally[] {
  const counts = new Map<string, number>();
  for (const row of byStage) counts.set(row.stage, (counts.get(row.stage) ?? 0) + row.count);

  return PIPELINE_PHASES.map((phase) => ({
    ...phase,
    count: phase.stages.reduce((sum, stage) => sum + (counts.get(stage) ?? 0), 0),
  })).filter((phase) => phase.count > 0);
}

/**
 * Every stage the phases cover, in phase order. Exported for the coverage test:
 * a stage added to `PIPELINE_STAGES` but not to a phase would vanish from the
 * bar without anyone noticing, which is precisely the failure mode fixed
 * buckets are here to prevent.
 */
export const PHASED_STAGES: PipelineStage[] = PIPELINE_PHASES.flatMap((p) => p.stages);

/** True when the phases partition `PIPELINE_STAGES` exactly — no gaps, no duplicates. */
export function phasesCoverAllStages(): boolean {
  return (
    PHASED_STAGES.length === PIPELINE_STAGES.length &&
    new Set(PHASED_STAGES).size === PHASED_STAGES.length &&
    PIPELINE_STAGES.every((s) => PHASED_STAGES.includes(s))
  );
}
