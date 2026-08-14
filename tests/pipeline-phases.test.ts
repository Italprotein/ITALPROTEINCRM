import { describe, it, expect } from 'vitest';

import {
  PIPELINE_PHASES,
  PHASED_STAGES,
  phasesCoverAllStages,
  tallyPipelinePhases,
} from '@/lib/pipeline-phases';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/types';
import { OPPORTUNITIES } from '@/fixtures';

/*
 * The home dashboard draws the pipeline as one segmented bar. Twenty stages
 * would be twenty slivers, so the bar folds them into six fixed phases.
 *
 * The rejected alternative was "keep the top six stages by volume, lump the
 * rest into Other". These tests pin the two properties that made fixed phases
 * the right answer instead:
 *
 *   1. Membership is total and static — every stage lands in exactly one band,
 *      so no stage can silently disappear when the numbers move.
 *   2. Every band is a named phase of the pipeline. There is no "Other" bucket,
 *      so nothing actionable can be swallowed by one: on the seeded book the
 *      rejected rule buried a signed NDA, a returned verdict and a repeat
 *      customer in a band called "Other stages".
 */

describe('PIPELINE_PHASES', () => {
  it('partitions PIPELINE_STAGES exactly — no stage missing, none counted twice', () => {
    expect(phasesCoverAllStages()).toBe(true);
    expect([...PHASED_STAGES].sort()).toEqual([...PIPELINE_STAGES].sort());
    expect(new Set(PHASED_STAGES).size).toBe(PIPELINE_STAGES.length);
  });

  it('keeps each phase in PIPELINE_STAGES order, and the phases themselves in flow order', () => {
    const positions = PHASED_STAGES.map((s) => PIPELINE_STAGES.indexOf(s));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('gives every phase a distinct key and a distinct Overview label key', () => {
    expect(new Set(PIPELINE_PHASES.map((p) => p.key)).size).toBe(PIPELINE_PHASES.length);
    expect(new Set(PIPELINE_PHASES.map((p) => p.labelKey)).size).toBe(PIPELINE_PHASES.length);
  });
});

describe('tallyPipelinePhases', () => {
  it('sums each phase and preserves phase order', () => {
    const tally = tallyPipelinePhases([
      { stage: 'lead', count: 2 },
      { stage: 'qualified', count: 3 },
      { stage: 'nda_signed', count: 4 },
      { stage: 'customer', count: 1 },
    ]);
    expect(tally.map((p) => [p.key, p.count])).toEqual([
      ['prospecting', 5],
      ['nda', 4],
      ['customer', 1],
    ]);
  });

  it('drops empty phases so no zero band claims its minimum width', () => {
    const tally = tallyPipelinePhases([{ stage: 'technical_call', count: 1 }]);
    expect(tally).toHaveLength(1);
    expect(tally[0].key).toBe('calls');
  });

  it('ignores terminal stages — lost deals are an outcome, not live pipeline', () => {
    const tally = tallyPipelinePhases([
      { stage: 'lead', count: 1 },
      { stage: 'lost', count: 99 },
      { stage: 'inactive', count: 99 },
      { stage: 'disqualified', count: 99 },
    ]);
    expect(tally).toHaveLength(1);
    expect(tally[0]).toMatchObject({ key: 'prospecting', count: 1 });
  });

  it('returns nothing for an empty book', () => {
    expect(tallyPipelinePhases([])).toEqual([]);
  });
});

describe('the seeded book', () => {
  // Exactly what the dashboard feeds the bar: opportunityService.getStatistics()
  // builds byStage by mapping over PIPELINE_STAGES, in both mock and api mode.
  const byStage = PIPELINE_STAGES.map((stage: PipelineStage) => ({
    stage,
    count: OPPORTUNITIES.filter((o) => o.stage === stage).length,
  }));
  const tally = tallyPipelinePhases(byStage);
  const total = tally.reduce((s, p) => s + p.count, 0);

  it('accounts for every live opportunity', () => {
    const live = OPPORTUNITIES.filter((o) => PIPELINE_STAGES.includes(o.stage)).length;
    expect(total).toBe(live);
    // 30 seeded opportunities, one of them at a terminal stage.
    expect(OPPORTUNITIES).toHaveLength(30);
    expect(total).toBe(29);
  });

  it('draws named bands only — there is no catch-all', () => {
    expect(tally.map((p) => p.key)).toEqual([
      'prospecting',
      'nda',
      'calls',
      'sampling',
      'commercial',
      'customer',
    ]);
    expect(tally.every((p) => PIPELINE_PHASES.some((f) => f.key === p.key))).toBe(true);
  });

  it('keeps band membership fixed when the numbers move', () => {
    // This is the property top-N-by-volume could not offer: it picked its bands
    // by count, so a stage could own a band today and be swallowed by "Other"
    // tomorrow. Skew one stage twentyfold and the bands are identical — only
    // the counts change.
    const skewed = byStage.map((r) =>
      r.stage === 'sample_requested' ? { ...r, count: r.count * 20 } : r,
    );
    expect(tallyPipelinePhases(skewed).map((p) => p.key)).toEqual(tally.map((p) => p.key));
  });

  it('never folds an actionable stage out of sight', () => {
    // On this very book, top-six-by-volume pushed these into "Other": a signed
    // NDA, a returned verdict and a repeat customer — three of the stages a rep
    // most wants to see. Each now belongs to a named, non-empty band.
    const buried: PipelineStage[] = ['nda_signed', 'feedback_received', 'repeat_customer'];
    for (const stage of buried) {
      const owner = tally.find((p) => p.stages.includes(stage));
      expect(owner, `no band owns ${stage}`).toBeDefined();
      expect(owner!.count).toBeGreaterThan(0);
    }
  });
});
