/**
 * Apply COMPANY_MERGE_RELATIONS to two company ids.
 *
 * Two callers need this and they must not diverge: `mergeCompanies()` in
 * lib/services/email-entity.actions.ts (which then deletes the source row) and
 * scripts/reconcile-email-companies.ts (which folds the duplicate rows the old
 * gmail-sync bug created onto one survivor, and deliberately does NOT delete
 * anything — a company row is only ever removed by a person).
 *
 * The Prisma client is passed in as a resolver rather than imported, for two
 * reasons: lib/backend/prisma.ts throws at module load without DATABASE_URL,
 * and the merge table is data that has to be reachable from a delegate NAME.
 * The cast lives at each call site, once.
 */

import { COMPANY_MERGE_RELATIONS } from './company-merge';

export interface RepointableDelegate {
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  findMany(args: {
    where: Record<string, unknown>;
    select: Record<string, boolean>;
  }): Promise<Record<string, unknown>[]>;
}

/** Hands back the delegate for a model name, e.g. `nDA` → `tx.nDA`. */
export type DelegateResolver = (name: string) => RepointableDelegate;

/**
 * Rows on the source that refuse a merge outright, counted before anything
 * moves. Returns [] when the merge may proceed.
 */
export async function blockingRelationCounts(
  resolve: DelegateResolver,
  sourceId: string,
): Promise<string[]> {
  const blocking: string[] = [];
  for (const relation of COMPANY_MERGE_RELATIONS) {
    if (relation.strategy !== 'block') continue;
    const count = await resolve(relation.delegate).count({ where: { [relation.foreignKey]: sourceId } });
    if (count) blocking.push(`${count} ${relation.relation}`);
  }
  return blocking;
}

/**
 * Repoint every relation from `sourceId` to `targetId`, returning the row count
 * per Company relation field. Does NOT delete the source company — that is the
 * caller's decision, and the reconciliation script never makes it.
 *
 * Must be called inside a transaction: a half-repointed company is worse than
 * either whole one.
 */
export async function repointCompanyRelations(
  resolve: DelegateResolver,
  sourceId: string,
  targetId: string,
): Promise<Record<string, number>> {
  const moved: Record<string, number> = {};

  for (const relation of COMPANY_MERGE_RELATIONS) {
    if (relation.strategy === 'block') continue;
    const delegate = resolve(relation.delegate);
    const where = { [relation.foreignKey]: sourceId };
    const data = { [relation.foreignKey]: targetId };

    if (relation.strategy === 'repoint_unique_company') {
      // The foreign key is UNIQUE per company, so the target may already hold a
      // row. Its own is the one a person maintained; the source's is dropped.
      const held = await delegate.count({ where: { [relation.foreignKey]: targetId } });
      const result = held ? await delegate.deleteMany({ where }) : await delegate.updateMany({ where, data });
      moved[relation.relation] = result.count;
      continue;
    }

    if (relation.strategy === 'repoint_unique_alias') {
      const taken = new Set(
        (await delegate.findMany({ where: { companyId: targetId }, select: { normalizedName: true } })).map(
          (row) => String(row.normalizedName),
        ),
      );
      const duplicates = (
        await delegate.findMany({
          where: { companyId: sourceId },
          select: { id: true, normalizedName: true },
        })
      )
        .filter((row) => taken.has(String(row.normalizedName)))
        .map((row) => String(row.id));
      if (duplicates.length) await delegate.deleteMany({ where: { id: { in: duplicates } } });
      const result = await delegate.updateMany({ where, data });
      moved[relation.relation] = result.count;
      continue;
    }

    const result = await delegate.updateMany({ where, data });
    moved[relation.relation] = result.count;
  }

  return moved;
}
