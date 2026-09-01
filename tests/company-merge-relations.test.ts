import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  COMPANY_MERGE_RELATIONS,
  COMPANY_ID_COLUMNS_WITHOUT_RELATIONS,
  MERGE_BLOCKING_RELATIONS,
} from '@/lib/reconcile/company-merge';
import { repointCompanyRelations, type RepointableDelegate } from '@/lib/reconcile/merge-runner';

/*
 * mergeCompanies() must repoint EVERY row that names the source company before
 * it deletes it. A missed relation is not a cosmetic bug: the delete either
 * fails on a foreign-key constraint, or — for a nullable column — succeeds and
 * silently orphans real records.
 *
 * "I enumerated them all" is only true on the day it is written, so this test
 * re-derives the list from prisma/schema.prisma on every run. Add a relation to
 * `model Company` without teaching the merge about it and this fails, naming
 * the field.
 */

const SCHEMA = fs.readFileSync(
  path.resolve(__dirname, '..', 'prisma', 'schema.prisma'),
  'utf8',
);

/** Every `model X {` name in the schema — used to tell relations from scalars. */
function modelNames(): Set<string> {
  return new Set([...SCHEMA.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]));
}

function companyModelBody(): string {
  const start = SCHEMA.search(/^model\s+Company\s*\{/m);
  expect(start, 'model Company not found in schema.prisma').toBeGreaterThan(-1);
  const open = SCHEMA.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < SCHEMA.length; i += 1) {
    if (SCHEMA[i] === '{') depth += 1;
    else if (SCHEMA[i] === '}') {
      depth -= 1;
      if (depth === 0) return SCHEMA.slice(open + 1, i);
    }
  }
  throw new Error('model Company is not brace-balanced');
}

interface SchemaRelation {
  field: string;
  model: string;
  forward: boolean;
}

/**
 * Relation fields declared on `model Company`.
 *
 * A field is a relation when its base type (with `[]`/`?` stripped) is itself a
 * model — that catches implicit relations such as `contacts Contact[]`, which
 * carry no `@relation` attribute at all. A relation is FORWARD (the id lives on
 * Company) when its `@relation(...)` names `fields:`; those are not rows
 * pointing at the company and the merge does not move them.
 */
function companyRelations(): SchemaRelation[] {
  const models = modelNames();
  const relations: SchemaRelation[] = [];
  for (const rawLine of companyModelBody().split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
    const match = /^(\w+)\s+(\w+)(\[\]|\?)?/.exec(line);
    if (!match) continue;
    const [, field, type] = match;
    if (!models.has(type)) continue;
    relations.push({ field, model: type, forward: /@relation\([^)]*fields\s*:/.test(line) });
  }
  return relations;
}

describe('mergeCompanies relation coverage', () => {
  it('reads a plausible Company model out of the schema (guards an empty test)', () => {
    const relations = companyRelations();
    expect(relations.length).toBeGreaterThan(20);
    expect(relations.some((r) => r.field === 'contacts')).toBe(true);
    expect(relations.some((r) => r.field === 'owner' && r.forward)).toBe(true);
  });

  it('handles every back-relation declared on model Company', () => {
    const expected = companyRelations()
      .filter((r) => !r.forward)
      .map((r) => r.field)
      .sort();
    const handled = COMPANY_MERGE_RELATIONS.map((r) => r.relation).sort();

    const missing = expected.filter((field) => !handled.includes(field));
    expect(
      missing,
      'These Company relations are not handled by mergeCompanies.\n' +
        'Add each to COMPANY_MERGE_RELATIONS in lib/reconcile/company-merge.ts with\n' +
        'its delegate, foreign key and strategy — a merge that misses one either\n' +
        'fails on a foreign key or orphans the rows:\n  ' +
        missing.join('\n  '),
    ).toEqual([]);
  });

  it('keeps the handled list free of relations the schema no longer declares', () => {
    const declared = companyRelations().map((r) => r.field);
    const stale = COMPANY_MERGE_RELATIONS.map((r) => r.relation).filter((f) => !declared.includes(f));
    expect(stale, `No longer on model Company — remove: ${stale.join(', ')}`).toEqual([]);
  });

  it('never tries to move the forward owner relation', () => {
    const forward = companyRelations().filter((r) => r.forward).map((r) => r.field);
    const handled = COMPANY_MERGE_RELATIONS.map((r) => r.relation);
    for (const field of forward) expect(handled).not.toContain(field);
  });

  it('names a real column on the related model for every relation it moves', () => {
    const models = modelNames();
    for (const handling of COMPANY_MERGE_RELATIONS) {
      const relation = companyRelations().find((r) => r.field === handling.relation);
      expect(relation, `${handling.relation} is not a Company relation`).toBeDefined();
      expect(models.has(relation!.model)).toBe(true);
      // The FK column must exist on the model the relation points at.
      const modelStart = SCHEMA.search(new RegExp(`^model\\s+${relation!.model}\\s*\\{`, 'm'));
      const modelEnd = SCHEMA.indexOf('\n}', modelStart);
      const body = SCHEMA.slice(modelStart, modelEnd);
      expect(
        new RegExp(`^\\s+${handling.foreignKey}\\s+String`, 'm').test(body),
        `${relation!.model}.${handling.foreignKey} does not exist`,
      ).toBe(true);
    }
  });

  it('blocks exactly the financial relations, matching removeCompany', () => {
    expect(MERGE_BLOCKING_RELATIONS.map((r) => r.relation).sort()).toEqual([
      'invoices',
      'orders',
      'quotes',
    ]);
  });

  it('accounts for the company-id columns that carry no relation field', () => {
    // These two columns hold a company id with no FK, so the schema diff above
    // cannot see them. Both must still be a deliberate decision.
    const covered = COMPANY_ID_COLUMNS_WITHOUT_RELATIONS.map((c) => c.delegate).sort();
    expect(covered).toEqual(['auditEvent', 'emailLog']);
    expect(COMPANY_ID_COLUMNS_WITHOUT_RELATIONS.find((c) => c.delegate === 'auditEvent')?.strategy).toBe('keep');
  });

  it('actually moves the relation-less company-id columns as well', async () => {
    // Not a schema question — a behavioural one. The reconciliation fold used
    // to repoint relations with its own loop and skip these two columns, which
    // left every email_logs row pointing at a company the operator was then
    // told to delete by hand. Both callers now go through one runner, so this
    // asserts the runner itself does it.
    const calls: { delegate: string; where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
    const delegate = (name: string): RepointableDelegate => ({
      updateMany: async ({ where, data }) => {
        calls.push({ delegate: name, where, data });
        return { count: 1 };
      },
      deleteMany: async () => ({ count: 0 }),
      count: async () => 0,
      findMany: async () => [],
    });

    const moved = await repointCompanyRelations(delegate, 'source', 'target');

    expect(calls.some((c) => c.delegate === 'emailLog' && c.where.companyId === 'source')).toBe(true);
    expect(moved.emailLog).toBe(1);
    // Audit events keep pointing at the row that existed — rewriting them would
    // erase the fact that the source ever did.
    expect(calls.some((c) => c.delegate === 'auditEvent')).toBe(false);
    expect(moved.auditEvent).toBeUndefined();
    // And the financial relations are never touched by the runner at all.
    for (const blocked of MERGE_BLOCKING_RELATIONS) {
      expect(calls.some((c) => c.delegate === blocked.delegate)).toBe(false);
    }
  });

  it('uses the unique-aware strategies exactly where the schema is unique', () => {
    const uniqueCompanyId = COMPANY_MERGE_RELATIONS.filter(
      (r) => r.strategy === 'repoint_unique_company',
    ).map((r) => r.relation);
    expect(uniqueCompanyId).toEqual(['doNotContact', 'followUp']);
    // …and the schema must still declare that uniqueness. FollowUp's companyId
    // is nullable (the outreach freeze lists counterparties with no company
    // record), so `String?` is the shape to expect there — the unique index
    // still holds for every row that does name a company.
    expect(
      /companyId\s+String\s+@unique/.test(SCHEMA.slice(SCHEMA.indexOf('model DoNotContactEntry'))),
    ).toBe(true);
    expect(
      /companyId\s+String\?\s+@unique/.test(SCHEMA.slice(SCHEMA.indexOf('model FollowUp'))),
    ).toBe(true);

    const uniqueAlias = COMPANY_MERGE_RELATIONS.filter(
      (r) => r.strategy === 'repoint_unique_alias',
    ).map((r) => r.relation);
    expect(uniqueAlias).toEqual(['aliasEntries']);
    expect(SCHEMA).toContain('@@unique([companyId, normalizedName])');
  });
});
