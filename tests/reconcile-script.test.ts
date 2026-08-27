import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/*
 * "Dry run writes nothing" is the entire safety promise of
 * scripts/reconcile-email-companies.ts, and it is a promise about a file that
 * cannot be imported by a test — it opens a database connection at module load
 * and runs `main()` on import.
 *
 * So it is checked structurally, the same technique tests/action-guards.test.ts
 * uses on the server-action layer: read the source, find every Prisma write, and
 * assert each one sits inside a function that calls requireApply() first. That
 * cannot be satisfied by accident and it fails the moment someone adds a write
 * to a planning function.
 */

const SCRIPT_PATH = path.resolve(__dirname, '..', 'scripts', 'reconcile-email-companies.ts');
const SOURCE = fs.readFileSync(SCRIPT_PATH, 'utf8');

/** Prisma methods that change data. `upsert` included — it writes either way. */
const WRITE_METHODS = ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'];
const WRITE_PATTERN = new RegExp(`\\.(${WRITE_METHODS.join('|')})\\(`, 'g');

interface Fn {
  name: string;
  body: string;
}

/** Slice out each `function name(...) { … }` body by matching braces. */
function functions(source: string): Fn[] {
  const found: Fn[] = [];
  const signature = /(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = signature.exec(source)) !== null) {
    const open = source.indexOf('{', signature.lastIndex);
    if (open === -1) continue;
    let depth = 0;
    let end = open;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    found.push({ name: match[1], body: source.slice(open, end + 1) });
    signature.lastIndex = end;
  }
  return found;
}

const FUNCTIONS = functions(SOURCE);

function writesIn(body: string): string[] {
  return [...body.matchAll(WRITE_PATTERN)].map((m) => m[1]);
}

describe('reconcile-email-companies dry-run safety', () => {
  it('parses the script into functions (guards against a silently empty test)', () => {
    expect(FUNCTIONS.length).toBeGreaterThan(8);
    expect(FUNCTIONS.map((f) => f.name)).toContain('requireApply');
    expect(FUNCTIONS.map((f) => f.name)).toContain('main');
  });

  it('finds Prisma writes to check (the test would be vacuous otherwise)', () => {
    const total = FUNCTIONS.flatMap((fn) => writesIn(fn.body)).length;
    expect(total).toBeGreaterThan(5);
  });

  it('gates every writing function behind requireApply()', () => {
    const ungated = FUNCTIONS.filter(
      (fn) => fn.name !== 'main' && writesIn(fn.body).length > 0 && !fn.body.includes('requireApply()'),
    ).map((fn) => `${fn.name} (${[...new Set(writesIn(fn.body))].join(', ')})`);

    expect(
      ungated,
      'These functions write to the database without calling requireApply() first,\n' +
        'so a dry run would mutate production data:\n  ' + ungated.join('\n  '),
    ).toEqual([]);
  });

  it('never writes from a planning function', () => {
    const planners = FUNCTIONS.filter((fn) => fn.name.startsWith('plan') || fn.name.startsWith('load'));
    expect(planners.length).toBeGreaterThan(3);
    for (const planner of planners) {
      expect(writesIn(planner.body), `${planner.name} must only read`).toEqual([]);
    }
  });

  it('calls every apply* function only under an APPLY check', () => {
    const main = FUNCTIONS.find((fn) => fn.name === 'main')!;
    const appliers = FUNCTIONS.filter((fn) => fn.name.startsWith('apply')).map((fn) => fn.name);
    expect(appliers.length).toBeGreaterThan(2);
    for (const applier of appliers) {
      const callIndex = main.body.indexOf(`${applier}(`);
      expect(callIndex, `${applier} is never called from main()`).toBeGreaterThan(-1);
      // The nearest `if (APPLY` before the call must be closer than any other
      // statement boundary that would put the call outside it.
      const before = main.body.slice(0, callIndex);
      const guardIndex = before.lastIndexOf('if (APPLY');
      expect(guardIndex, `${applier} is called without an APPLY guard above it`).toBeGreaterThan(-1);
    }
  });

  it('defaults to dry run: --apply must be opt-in', () => {
    expect(SOURCE).toContain('process.argv.includes("--apply")');
    expect(/const APPLY\s*=\s*process\.argv\.includes\("--apply"\)/.test(SOURCE)).toBe(true);
    // requireApply must actually stop the run, not just warn.
    const guard = FUNCTIONS.find((fn) => fn.name === 'requireApply')!;
    expect(guard.body).toMatch(/if\s*\(!APPLY\)\s*throw/);
  });

  it('is wired into package.json as a dry script and an explicit apply script', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts['reconcile:dry']).toBe('tsx scripts/reconcile-email-companies.ts');
    expect(pkg.scripts['reconcile:apply']).toContain('--apply');
    expect(pkg.scripts['reconcile:dry']).not.toContain('--apply');
  });

  it('prints greppable, privacy-safe report lines', () => {
    for (const marker of [
      'PROPOSE-DOMAIN',
      'PROPOSE-LINK',
      'PROPOSE-SUPPRESS',
      'PROPOSE-ALIAS-LINK',
      'PROPOSE-FALSE-COMPANY',
      'COLLISION',
      'UNCERTAIN',
      'MANUAL-DELETE',
    ]) {
      expect(SOURCE, `${marker} must appear in the report`).toContain(marker);
    }
    // Message bodies, snippets and subjects must never reach the log. The
    // report carries addresses, domains and counts only.
    expect(SOURCE).not.toMatch(/line\([^)]*\bbodyText\b/);
    expect(SOURCE).not.toMatch(/line\([^)]*\bsnippet\b/);
    expect(SOURCE).not.toMatch(/line\([^)]*\bsubject\b/);
  });

  it('never deletes a company row', () => {
    // The script folds duplicates onto a survivor and reports the rest for a
    // person to remove. Deleting a company on a script's own reading of the
    // evidence is the same mistake as creating one that way.
    expect(SOURCE).not.toMatch(/company\.delete\(/);
    expect(SOURCE).not.toMatch(/company\.deleteMany\(/);
  });
});
