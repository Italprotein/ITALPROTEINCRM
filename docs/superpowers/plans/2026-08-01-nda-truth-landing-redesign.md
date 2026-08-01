# NDA Count Truth + Scarica Dati Cleanup + Landing Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every NDA count in the CRM derive from the NDA register so `Aziende` and the NDA page can never disagree, strip two useless cards off Scarica dati, and rebuild the public landing page as an editorial-premium page with framer-motion off its critical path.

**Architecture:** One pure tally module (`lib/nda-stats.ts`) and one server-only reduction module (`lib/backend/nda-current-status.ts`) become the single path every count flows through, in both the Prisma services and the mock services. The already-tested-but-unused `reconcileNdaStatus()` is wired into `syncCompanyNdaStatus()` so background auto-filing can never regress a company's cached status. The landing page becomes a server component with three small client islands.

**Tech Stack:** Next.js 15 App Router · TypeScript · Prisma 7 (driver adapter) · Tailwind · next-intl · vitest (node environment)

## Global Constraints

- Tests live in `tests/*.test.ts`, run in vitest's **node** environment with **no database and no browser** (`vitest.config.ts`). Only pure modules get unit tests. Never write a test that needs Prisma.
- `@/` resolves to the repo root (`vitest.config.ts` alias + `tsconfig.json` paths).
- `lib/backend/*` is Node-only. Never import it from Edge code (`middleware.ts`, `auth.config.ts`).
- Modules marked `"use server"` export server actions. Shared helpers that are *not* actions must live in a plain module (no `"use server"` directive).
- Local Postgres is **down** on this machine (`ECONNREFUSED` on 5432). No task may require a live database. The landing page needs no database, so `npm run dev` + `/` works for visual verification.
- Brand palette is preserved everywhere: `brand-navy` `#0a1628`, `brand-gold`, `brand-goldDark`, `brand-teal`, `brand-cream`.
- Playfair Display is already wired as `font-display` (`app/[locale]/layout.tsx:23`, `tailwind.config.ts:121`). Use `font-display` for display type; do not add a font.
- Every user-visible string on the landing page goes through `next-intl` under the `Landing` namespace, in **both** `messages/it.json` and `messages/en.json`. No hardcoded copy.
- The footer credit `Creato Da : Amine , con <3` stays byte-for-byte unchanged.
- No production data is rewritten. No reconcile or backfill script.

---

## File Structure

**Created**
- `lib/nda-stats.ts` — pure tallies over current-per-company NDA statuses. No I/O, no Prisma types.
- `lib/backend/nda-current-status.ts` — server-only Prisma reduction to one current NDA row per company, plus the shared NDA scope predicate.
- `tests/nda-stats.test.ts` — unit tests for the pure tallies.
- `components/landing/reveal.tsx` — IntersectionObserver + CSS scroll-reveal client island, replaces framer's `FadeUp`/`AnimatedTitle`.

**Modified**
- `lib/backend/nda-status-sync.ts` — `syncCompanyNdaStatus` gains `neverRegress`.
- `lib/services/nda.actions.ts` — `ndaStatistics()` counts the register; local `scopeWhere` replaced by the shared one.
- `lib/services/company.actions.ts` — `companyStatistics().ndaSigned` counts the register.
- `lib/services/analytics.actions.ts` — `ndaFunnel()` counts the register.
- `lib/mock-services/ndaService.ts`, `lib/mock-services/companyService.ts`, `lib/mock-services/analyticsService.ts` — same helpers over fixtures.
- `lib/backend/gmail-sync.ts` — stops hand-writing `Company.ndaStatus`.
- `app/api/documents/upload/route.ts` — same.
- `app/[locale]/admin/import-export/page.tsx` — two cards removed.
- `components/landing/partner-marquee.tsx` — CSS animation instead of framer.
- `components/landing/access-menu.tsx` — dead framer import removed.
- `tailwind.config.ts` — `marquee` keyframes + animation.
- `messages/it.json`, `messages/en.json` — landing stats strip copy.
- `app/[locale]/page.tsx` — rewritten as a server component.

---

## PART A — NDA counts

### Task 1: Pure NDA tally helpers

**Files:**
- Create: `lib/nda-stats.ts`
- Test: `tests/nda-stats.test.ts`

**Interfaces:**
- Consumes: `NDAStatus` from `@/lib/types`.
- Produces: `NDA_AWAITING_STATUSES: NDAStatus[]`, `ndaStatusTallies(statuses: Iterable<NDAStatus>): NdaTallies`, `ndaFunnelCounts(statuses: Iterable<NDAStatus>): { prepared: number; sent: number; signed: number }`, and the `NdaTallies` interface. Tasks 2-5 all import from here.

- [ ] **Step 1: Write the failing test**

Create `tests/nda-stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { ndaFunnelCounts, ndaStatusTallies } from "@/lib/nda-stats";

describe("NDA status tallies", () => {
  it("counts one entry per company across the lifecycle buckets", () => {
    const tallies = ndaStatusTallies([
      "fully_signed",
      "fully_signed",
      "sent",
      "under_review",
      "to_prepare",
      "draft",
    ]);

    expect(tallies.total).toBe(6);
    expect(tallies.signed).toBe(2);
    expect(tallies.awaitingSignature).toBe(2);
    expect(tallies.toPrepare).toBe(2);
    expect(tallies.byStatus.fully_signed).toBe(2);
  });

  it("ignores companies that need no NDA", () => {
    const tallies = ndaStatusTallies(["not_required", "not_required", "fully_signed"]);

    expect(tallies.total).toBe(1);
    expect(tallies.signed).toBe(1);
    expect(tallies.byStatus.not_required).toBe(0);
  });

  it("returns zeroes for an empty register", () => {
    const tallies = ndaStatusTallies([]);

    expect(tallies.total).toBe(0);
    expect(tallies.signed).toBe(0);
    expect(tallies.awaitingSignature).toBe(0);
    expect(tallies.toPrepare).toBe(0);
  });

  it("builds a funnel where every signed NDA also counts as sent and prepared", () => {
    expect(ndaFunnelCounts(["fully_signed", "sent", "to_prepare", "not_required"])).toEqual({
      prepared: 3,
      sent: 2,
      signed: 1,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/nda-stats.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/nda-stats"`.

- [ ] **Step 3: Write the implementation**

Create `lib/nda-stats.ts`:

```ts
import type { NDAStatus } from "@/lib/types";

/**
 * Every NDA count in the CRM is derived here, from the *current* register row
 * per company. `Company.ndaStatus` is a cache for row rendering and the portal
 * access gate; counting it separately is what let the Aziende strip and the NDA
 * register disagree.
 */

/** The paper is out with a counterparty and nobody has countersigned yet. */
export const NDA_AWAITING_STATUSES: NDAStatus[] = [
  "sent",
  "under_review",
  "changes_requested",
  "approved",
  "awaiting_italprotein_signature",
  "awaiting_counterparty_signature",
  "partially_signed",
];

/** Reached "there is a signature on file", so the funnel counts it as sent too. */
const SENT_STATUSES: NDAStatus[] = [...NDA_AWAITING_STATUSES, "fully_signed"];

export interface NdaTallies {
  total: number;
  byStatus: Record<NDAStatus, number>;
  awaitingSignature: number;
  signed: number;
  toPrepare: number;
}

/**
 * `statuses` must already be reduced to one entry per company (see
 * `selectCurrentNdasWithFile` in `lib/nda-current.ts`). `not_required` means the
 * company has no agreement in flight, so it is excluded from every bucket.
 */
export function ndaStatusTallies(statuses: Iterable<NDAStatus>): NdaTallies {
  const byStatus = {} as Record<NDAStatus, number>;
  let total = 0;
  let awaitingSignature = 0;
  let signed = 0;
  let toPrepare = 0;

  for (const status of statuses) {
    if (status === "not_required") continue;
    total += 1;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (NDA_AWAITING_STATUSES.includes(status)) awaitingSignature += 1;
    if (status === "fully_signed") signed += 1;
    if (status === "to_prepare" || status === "draft") toPrepare += 1;
  }

  return { total, byStatus, awaitingSignature, signed, toPrepare };
}

/** Prepared → Sent → Signed, each stage a superset of the next. */
export function ndaFunnelCounts(statuses: Iterable<NDAStatus>): {
  prepared: number;
  sent: number;
  signed: number;
} {
  let prepared = 0;
  let sent = 0;
  let signed = 0;

  for (const status of statuses) {
    if (status === "not_required") continue;
    prepared += 1;
    if (SENT_STATUSES.includes(status)) sent += 1;
    if (status === "fully_signed") signed += 1;
  }

  return { prepared, sent, signed };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/nda-stats.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/nda-stats.ts tests/nda-stats.test.ts
git commit -m "Add one pure tally helper for NDA register counts"
```

---

### Task 2: Shared server reduction, and `ndaStatistics()` counts the register

**Files:**
- Create: `lib/backend/nda-current-status.ts`
- Modify: `lib/services/nda.actions.ts` (delete local `scopeWhere` at lines 18-23; rewrite `ndaStatistics()` at lines 160-209)

**Interfaces:**
- Consumes: `ndaStatusTallies`, `NDA_AWAITING_STATUSES` from Task 1.
- Produces: `ndaScopeWhere(): Promise<Prisma.NDAWhereInput>` and `currentNdaByCompany(where: Prisma.NDAWhereInput): Promise<Map<string, CurrentNda>>` where `CurrentNda = { status: NDAStatus; expiryDate: Date | null }`. Tasks 3 and 4 import both.

- [ ] **Step 1: Create the shared reduction module**

Create `lib/backend/nda-current-status.ts`:

```ts
import type { Prisma, NDAStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";

// Plain module, deliberately NOT "use server": these are shared helpers, not
// server actions, and both nda.actions.ts and company.actions.ts import them.

/** Same ordering `listNdas` uses, so "current" means the same row everywhere. */
const CURRENT_ORDER: Prisma.NDAOrderByWithRelationInput[] = [
  { updatedAt: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
];

export interface CurrentNda {
  status: NDAStatus;
  expiryDate: Date | null;
}

/** External users see only their own company's NDAs; internal users see all. */
export async function ndaScopeWhere(): Promise<Prisma.NDAWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

/** One current register row per company — the only thing any count reads. */
export async function currentNdaByCompany(
  where: Prisma.NDAWhereInput,
): Promise<Map<string, CurrentNda>> {
  const rows = await prisma.nDA.findMany({
    where,
    orderBy: CURRENT_ORDER,
    select: { companyId: true, status: true, expiryDate: true },
  });
  const current = new Map<string, CurrentNda>();
  for (const row of rows) {
    if (current.has(row.companyId)) continue;
    current.set(row.companyId, { status: row.status, expiryDate: row.expiryDate });
  }
  return current;
}
```

- [ ] **Step 2: Replace the local scope helper in `nda.actions.ts`**

In `lib/services/nda.actions.ts`, delete lines 17-23 (the comment and the local `scopeWhere` function) and delete the now-unused `companyScopeWhere` at lines 25-30. Add to the import block:

```ts
import { currentNdaByCompany, ndaScopeWhere } from "@/lib/backend/nda-current-status";
import { ndaStatusTallies, NDA_AWAITING_STATUSES } from "@/lib/nda-stats";
```

Then replace every call to `scopeWhere()` in this file with `ndaScopeWhere()` — there are three, in `listNdas` (line 65), `getNda` (line 83) and `ndasByCompany` (line 153).

`getCurrentUser` is now unused in this file if nothing else references it; remove it from the `@/lib/backend/session` import if `npm run lint` reports it unused.

- [ ] **Step 3: Rewrite `ndaStatistics()`**

Replace the whole body of `ndaStatistics()` (lines 160-209) with:

```ts
export async function ndaStatistics() {
  // Every count comes from the register, reduced to one current row per company.
  // Company.ndaStatus is a cache and is deliberately not counted here.
  await requireUser();
  const now = new Date();
  const current = await currentNdaByCompany(await ndaScopeWhere());
  const rows = [...current.values()];
  const tallies = ndaStatusTallies(rows.map((row) => row.status));
  const expiringSoon = rows.filter((row) => {
    if (!row.expiryDate || row.status !== "fully_signed") return false;
    const days = (row.expiryDate.getTime() - now.getTime()) / 86400000;
    return days >= 0 && days <= 60;
  }).length;
  return { ...tallies, expiringSoon };
}
```

The `NDAStatus` type import and the local `AWAITING` array are now unused in this file. Delete the `AWAITING` array. Keep the `NDAStatus` import — `NOTIFY_STATUSES` and `SIGNATURE_STATUSES` still use it. `NDA_AWAITING_STATUSES` is imported for use by Task 4; if lint flags it as unused at the end of this task, leave the import out and add it in Task 4 instead.

- [ ] **Step 4: Verify types and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass with no errors. The returned shape is unchanged (`total`, `byStatus`, `awaitingSignature`, `signed`, `toPrepare`, `expiringSoon`), so `app/[locale]/admin/ndas/page.tsx` needs no edit.

- [ ] **Step 5: Commit**

```bash
git add lib/backend/nda-current-status.ts lib/services/nda.actions.ts
git commit -m "Count NDA statistics from the register, not the company cache"
```

---

### Task 3: `companyStatistics().ndaSigned` counts the register

**Files:**
- Modify: `lib/services/company.actions.ts:195-223`

**Interfaces:**
- Consumes: `currentNdaByCompany`, `ndaScopeWhere` from Task 2.
- Produces: nothing new. `companyStatistics()` keeps its exact return shape, so `app/[locale]/admin/companies/page.tsx` needs no edit.

- [ ] **Step 1: Add the import**

In `lib/services/company.actions.ts`, add below the existing `@/lib/backend/nda-status-sync` import:

```ts
import { currentNdaByCompany, ndaScopeWhere } from "@/lib/backend/nda-current-status";
```

- [ ] **Step 2: Read the register alongside the companies**

Replace lines 197-206 (the single `prisma.company.findMany`) with a parallel read:

```ts
  const [rows, currentNdas] = await Promise.all([
    prisma.company.findMany({
      where: await scopeWhere(),
      select: {
        relationshipStage: true,
        priority: true,
        opportunityValueMinor: true,
        estimatedAnnualPotentialMinor: true,
      },
    }),
    currentNdaByCompany(await ndaScopeWhere()),
  ]);
```

Note `ndaStatus: true` is dropped from the select — nothing in this function reads the cache any more.

- [ ] **Step 3: Count signed NDAs from the register**

Replace line 214 (`ndaSigned: rows.filter((r) => r.ndaStatus === "fully_signed").length,`) with:

```ts
    // Counted from the NDA register so this agrees with the NDA page by
    // construction; Company.ndaStatus is a cache and can lag it.
    ndaSigned: [...currentNdas.values()].filter((n) => n.status === "fully_signed").length,
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both pass. If TypeScript complains that `ndaStatus` is missing on `rows`, confirm no other line in `companyStatistics` still reads it.

- [ ] **Step 5: Commit**

```bash
git add lib/services/company.actions.ts
git commit -m "Count signed NDAs on Aziende from the register"
```

---

### Task 4: Both NDA funnels count the register

**Files:**
- Modify: `lib/services/analytics.actions.ts:97-116`
- Modify: `lib/mock-services/analyticsService.ts:60-69`

**Interfaces:**
- Consumes: `ndaFunnelCounts` from Task 1, `currentNdaByCompany` from Task 2, `selectCurrentNdasWithFile` from `@/lib/nda-current`.
- Produces: nothing new. Both keep returning `{ name: string; value: number }[]`.

- [ ] **Step 1: Rewrite the server funnel**

In `lib/services/analytics.actions.ts`, add to the imports:

```ts
import { currentNdaByCompany } from "@/lib/backend/nda-current-status";
import { ndaFunnelCounts } from "@/lib/nda-stats";
```

Replace the body of `ndaFunnel()` (lines 98-115) with:

```ts
  await requireSection("analytics");
  // Analytics is an internal section, so the funnel spans every company.
  const current = await currentNdaByCompany({});
  const { prepared, sent, signed } = ndaFunnelCounts(
    [...current.values()].map((row) => row.status),
  );
  return [
    { name: "Prepared", value: prepared },
    { name: "Sent", value: sent },
    { name: "Signed", value: signed },
  ];
```

The local `sentStatuses` array is now unused — delete it.

- [ ] **Step 2: Rewrite the mock funnel**

In `lib/mock-services/analyticsService.ts`, add to the imports:

```ts
import { selectCurrentNdasWithFile } from '@/lib/nda-current';
import { ndaFunnelCounts } from '@/lib/nda-stats';
```

Replace the body of `ndaFunnel()` (lines 61-68) with:

```ts
    // Same reduction as the Prisma path: newest row per company, then tally.
    const ordered = [...NDAS].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const current = selectCurrentNdasWithFile(
      ordered,
      (n) => n.companyId,
      () => false,
      () => 0,
    ).map((entry) => entry.current);
    const { prepared, sent, signed } = ndaFunnelCounts(current.map((n) => n.status));
    return [
      { name: 'Prepared', value: prepared },
      { name: 'Sent', value: sent },
      { name: 'Signed', value: signed },
    ];
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add lib/services/analytics.actions.ts lib/mock-services/analyticsService.ts
git commit -m "Count the NDA funnel from the register in both data modes"
```

---

### Task 5: Mock services use the same tallies

**Files:**
- Modify: `lib/mock-services/ndaService.ts:25-42`
- Modify: `lib/mock-services/companyService.ts:69-83`

**Interfaces:**
- Consumes: `ndaStatusTallies` from Task 1, `selectCurrentNdasWithFile` from `@/lib/nda-current`.
- Produces: nothing new. Both `getStatistics()` return shapes are unchanged.

Today the mock NDA service counts **raw rows** while the mock company service counts the **company cache** — a third and fourth answer to the same question. This makes mock mode match api mode.

- [ ] **Step 1: Add a shared reduction to the mock NDA service**

In `lib/mock-services/ndaService.ts`, replace the imports at lines 1-3 with:

```ts
import type { NDA, NDAStatus } from '@/lib/types';
import { NDAS } from '@/fixtures';
import { selectCurrentNdasWithFile } from '@/lib/nda-current';
import { ndaStatusTallies } from '@/lib/nda-stats';
import { createRepository } from './repository';
```

Below the `NOW` constant, add the shared reduction and delete the local `AWAITING` array (lines 8-11):

```ts
/** Newest row per company, matching the Prisma `currentNdaByCompany` ordering. */
export function currentNdasOf(all: readonly NDA[]): NDA[] {
  const ordered = [...all].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return selectCurrentNdasWithFile(
    ordered,
    (n) => n.companyId,
    () => false,
    () => 0,
  ).map((entry) => entry.current);
}
```

- [ ] **Step 2: Rewrite the mock `getStatistics`**

Replace the body of `getStatistics()` (lines 26-41) with:

```ts
    const current = currentNdasOf(await repo.list());
    const tallies = ndaStatusTallies(current.map((n) => n.status));
    const expiringSoon = current.filter((n) => {
      if (!n.expiryDate || n.status !== 'fully_signed') return false;
      const days = (new Date(n.expiryDate).getTime() - NOW.getTime()) / 86400000;
      return days >= 0 && days <= 60;
    }).length;
    return { ...tallies, expiringSoon };
```

The `NDAStatus` import is now only used by `currentNdasOf`'s inferred types; if lint flags it unused, remove it from the type import.

- [ ] **Step 3: Rewrite the mock company `ndaSigned`**

In `lib/mock-services/companyService.ts`, add to the imports at line 2:

```ts
import { COMPANIES, AGENCY_COMPANIES, NDAS } from '@/fixtures';
import { currentNdasOf } from './ndaService';
```

Replace line 77 (`ndaSigned: all.filter((c) => c.ndaStatus === 'fully_signed').length,`) with:

```ts
      // From the register, so this matches the NDA page — see lib/nda-stats.ts.
      ndaSigned: currentNdasOf(NDAS).filter((n) => n.status === 'fully_signed').length,
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all pass. If a circular import warning appears between `companyService` and `ndaService`, move `currentNdasOf` into `lib/nda-stats.ts` instead (it is pure) and import it from there in both files.

- [ ] **Step 5: Commit**

```bash
git add lib/mock-services/ndaService.ts lib/mock-services/companyService.ts
git commit -m "Match mock-mode NDA counts to the register reduction"
```

---

### Task 6: Stop the cache writers from drifting

**Files:**
- Modify: `lib/backend/nda-status-sync.ts:12-24`
- Modify: `lib/backend/gmail-sync.ts:190` and `lib/backend/gmail-sync.ts:274-300`
- Modify: `app/api/documents/upload/route.ts:184-199`

**Interfaces:**
- Consumes: `reconcileNdaStatus` from `@/lib/nda-status` (already exists, already tested in `tests/nda-status.test.ts`, currently used nowhere).
- Produces: `syncCompanyNdaStatus(tx, companyId, opts?: { neverRegress?: boolean }): Promise<NDAStatus>`. Existing two-argument callers are unaffected — the option defaults to `false`.

- [ ] **Step 1: Add the `neverRegress` option to the sync helper**

In `lib/backend/nda-status-sync.ts`, add the import below line 3:

```ts
import { reconcileNdaStatus } from "@/lib/nda-status";
```

Replace `syncCompanyNdaStatus` (lines 11-24) with:

```ts
/**
 * Materialise the current register row on Company for fast lists and portal gates.
 *
 * `neverRegress` is for background auto-filing (Gmail, document upload): an
 * inbound email must never walk a company backwards out of a status a staff
 * member asserted, because this field gates portal document access. Explicit
 * register edits leave it off and mirror the register exactly.
 */
export async function syncCompanyNdaStatus(
  tx: Prisma.TransactionClient,
  companyId: string,
  opts: { neverRegress?: boolean } = {},
): Promise<NDAStatus> {
  const current = await tx.nDA.findFirst({
    where: { companyId },
    orderBy: CURRENT_ORDER,
    select: { status: true },
  });
  const registerStatus = current?.status ?? "not_required";
  let status = registerStatus;
  if (opts.neverRegress) {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { ndaStatus: true },
    });
    status = reconcileNdaStatus(company?.ndaStatus ?? null, registerStatus);
  }
  await tx.company.update({ where: { id: companyId }, data: { ndaStatus: status } });
  return status;
}
```

- [ ] **Step 2: Stop Gmail sync from inventing a status with no register row**

In `lib/backend/gmail-sync.ts`, delete line 190 (`ndaStatus: "under_review",`) from the `createCompanyFromEmail` data block. A company auto-created from an inbound email now starts with no cached status; the filing step that follows creates the register row and syncs from it, so no company is ever counted with zero NDAs.

- [ ] **Step 3: Route `advanceCompanyNdaStatus` through the sync helper**

In `lib/backend/gmail-sync.ts`, replace the body of `advanceCompanyNdaStatus` (the `prisma.$transaction` block at lines 279-299) with:

```ts
  await prisma.$transaction(async (tx) => {
    if (ndaId) {
      await tx.nDA.updateMany({
        where: { id: ndaId, status: { in: ["not_required", "to_prepare", "draft", "sent"] } },
        data: { status: "under_review" },
      });
    }
    await tx.company.update({ where: { id: companyId }, data: { lastActivityAt: emailDate } });
    await syncCompanyNdaStatus(tx, companyId, { neverRegress: true });
  }).catch(() => undefined);
```

Add `syncCompanyNdaStatus` to the existing `@/lib/backend/nda-status-sync` import if the file does not already import it; if the file imports nothing from that module yet, add:

```ts
import { syncCompanyNdaStatus } from "@/lib/backend/nda-status-sync";
```

- [ ] **Step 4: Route the upload endpoint through the sync helper**

In `app/api/documents/upload/route.ts`, replace the `prisma.$transaction([...])` array call at lines 184-199 with:

```ts
    await prisma.$transaction(async (tx) => {
      await tx.nDA.updateMany({
        where: { id: ndaId, status: { in: ["not_required", "to_prepare", "draft", "sent"] } },
        data: { status: "under_review", updatedById: user.id },
      });
      await syncCompanyNdaStatus(tx, companyId, { neverRegress: true });
    });
```

Add the import at the top of the file:

```ts
import { syncCompanyNdaStatus } from "@/lib/backend/nda-status-sync";
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all pass. `tests/nda-status.test.ts` already covers the `reconcileNdaStatus` semantics this task depends on (signature beats auto-filed review; register wins when further ahead; terminal statuses are authoritative) — it should stay green and is now testing live production behaviour rather than an orphan.

- [ ] **Step 6: Commit**

```bash
git add lib/backend/nda-status-sync.ts lib/backend/gmail-sync.ts app/api/documents/upload/route.ts
git commit -m "Route every NDA cache write through one guarded sync helper"
```

---

## PART B — Scarica dati

### Task 7: Remove the two stat cards

**Files:**
- Modify: `app/[locale]/admin/import-export/page.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing. Self-contained.

`Download format: CSV` restates the subtitle. `Available records` is worse — the effect at lines 53-56 loads all seven datasets on mount just to sum their lengths, so the page pays a full data load before the user clicks anything. Row counts still reach the user in the post-download toast at line 63.

- [ ] **Step 1: Delete the count state and its effect**

Remove lines 50 and 53-56:

```ts
  const [count, setCount] = React.useState(0);
```

```ts
  React.useEffect(() => {
    void Promise.all(DATASETS.map((dataset) => dataset.load()))
      .then((results) => setCount(results.reduce((total, rows) => total + rows.length, 0)));
  }, []);
```

- [ ] **Step 2: Delete the card grid**

Remove lines 72-75:

```tsx
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Available records" value={count} icon={Database} tone="gold" />
        <StatCard label="Download format" value="CSV" icon={Download} tone="success" delay={0.05} />
      </div>
```

- [ ] **Step 3: Drop the now-unused imports**

Line 4 becomes:

```ts
import { Download, FileDown, FileSpreadsheet } from 'lucide-react';
```

`Download` is still used by the card title at line 78, so it stays. Delete the `StatCard` import at line 11 entirely.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both pass, no unused-import warnings for `Database` or `StatCard`.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/admin/import-export/page.tsx"
git commit -m "Drop the Scarica dati stat cards and their eager dataset load"
```

---

## PART C — Landing page

### Task 8: The `Reveal` island and the CSS marquee keyframes

**Files:**
- Create: `components/landing/reveal.tsx`
- Modify: `tailwind.config.ts:136-203`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`.
- Produces: `<Reveal delay?: number; className?: string; as?: 'div' | 'section'>` — used throughout Task 11. Also the Tailwind utility `animate-marquee`, used in Task 9.

- [ ] **Step 1: Create the Reveal island**

Create `components/landing/reveal.tsx`:

```tsx
'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Scroll-entry reveal without framer-motion. One IntersectionObserver per
 * element, disconnected after it fires, and a plain CSS transition — so the
 * landing page ships no animation library and nothing keeps running after the
 * reveal. Honours `prefers-reduced-motion` by rendering visible immediately.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { rootMargin: '-64px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
        shown ? 'translate-y-0 opacity-100' : 'motion-safe:translate-y-6 motion-safe:opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Add the marquee keyframes**

In `tailwind.config.ts`, add to the `keyframes` object after `shimmer-gold` (line 188):

```ts
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
```

And to the `animation` object after `shimmer` (line 202):

```ts
        marquee: 'marquee 90s linear infinite',
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add components/landing/reveal.tsx tailwind.config.ts
git commit -m "Add a CSS scroll-reveal island and marquee keyframes"
```

---

### Task 9: Take framer-motion out of the landing islands

**Files:**
- Modify: `components/landing/partner-marquee.tsx:1-54`
- Modify: `components/landing/access-menu.tsx:1-3`

**Interfaces:**
- Consumes: the `animate-marquee` utility from Task 8.
- Produces: `PartnerMarquee` becomes a **server** component (no `'use client'`). `AccessMenu` keeps its signature `({ tone }: { tone?: 'light' | 'dark' })`.

`AccessMenu` imports `motion` at line 3 and never uses it — a dead import that pulls framer-motion into the landing bundle for nothing.

- [ ] **Step 1: Delete the dead framer import**

In `components/landing/access-menu.tsx`, delete line 3:

```ts
import { motion } from 'framer-motion';
```

- [ ] **Step 2: Convert the marquee to CSS**

In `components/landing/partner-marquee.tsx`, delete line 1 (`'use client';`) and line 4 (`import { motion } from 'framer-motion';`), then replace the `<motion.div>` wrapper (lines 32-36) and its closing tag (line 51) with:

```tsx
      <div className="flex w-max gap-5 motion-safe:animate-marquee">
```

```tsx
      </div>
```

The component now has no hooks and no client-only APIs, so dropping `'use client'` makes it render on the server. `motion-safe:` keeps it still for users who asked for reduced motion.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both pass.

- [ ] **Step 4: Verify visually**

Run: `npm run dev`, open `http://localhost:3000/it`, scroll to the partner strip.
Expected: the logo track scrolls left continuously and loops seamlessly, exactly as before.

- [ ] **Step 5: Commit**

```bash
git add components/landing/partner-marquee.tsx components/landing/access-menu.tsx
git commit -m "Drop framer-motion from the partner marquee and access menu"
```

---

### Task 10: Localise the landing stats strip

**Files:**
- Modify: `messages/it.json` (`Landing` namespace)
- Modify: `messages/en.json` (`Landing` namespace)

**Interfaces:**
- Produces: `Landing.stats` — an array of four `{ value, suffix, label }` objects, read with `t.raw('stats')` in Task 11. `value` is a **number**, `suffix` and `label` are strings.

The strip at `app/[locale]/page.tsx:300-303` is hardcoded English on a site whose default locale is Italian.

- [ ] **Step 1: Add the Italian copy**

In `messages/it.json`, inside the `Landing` object, add after `"partnersSubtitle"`:

```json
    "stats": [
      { "value": 36, "suffix": "+", "label": "Partner attivi" },
      { "value": 100, "suffix": "%", "label": "Dolcificante proteico" },
      { "value": 12, "suffix": "", "label": "Paesi raggiunti" },
      { "value": 28, "suffix": "", "label": "Moduli CRM" }
    ],
```

- [ ] **Step 2: Add the English copy**

In `messages/en.json`, inside the `Landing` object, at the matching position:

```json
    "stats": [
      { "value": 36, "suffix": "+", "label": "Active partners" },
      { "value": 100, "suffix": "%", "label": "Protein sweetener" },
      { "value": 12, "suffix": "", "label": "Countries reached" },
      { "value": 28, "suffix": "", "label": "CRM modules" }
    ],
```

- [ ] **Step 3: Verify both files still parse**

Run: `node -e "require('./messages/it.json'); require('./messages/en.json'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add messages/it.json messages/en.json
git commit -m "Localise the landing stats strip"
```

---

### Task 11: Rebuild the landing page

**Files:**
- Modify: `app/[locale]/page.tsx` (full rewrite, 481 lines → server component)

**Interfaces:**
- Consumes: `Reveal` from Task 8, `PartnerMarquee` (now a server component) from Task 9, `Landing.stats` from Task 10.
- Produces: the default-exported `LandingPage` server component.

**REQUIRED SUB-SKILL:** invoke `frontend-design:frontend-design` before writing this task's markup. Direction is fixed by the spec: **editorial premium** — ingredient-house confidence, not SaaS template.

- [ ] **Step 1: Delete the client directive and the framer machinery**

Remove line 1 (`'use client';`) and the whole animation-helpers block (lines 22-157): `ease`, `FadeUp`, `FloatOrb`, `Counter`, `AnimatedTitle`, `ICON_TONES`, `FeatureIcon`, `ProductCard`, `StatCard`. Remove the `framer-motion` import at line 5 and the `useRef, useEffect, useState` import at line 4.

Every one of these is either framer-based or exists only to drive framer. `Counter` in particular is a `setInterval` that runs on mount for four numbers.

- [ ] **Step 2: Delete every infinite animation**

These have no replacement — they are removed outright, and this is the substantive performance change. Confirm all of the following are gone from the file:

| Removed | Was at |
| --- | --- |
| 3 hero `FloatOrb`s | lines 191-193 |
| pulsing gradient overlay (`repeat: Infinity`) | lines 196-201 |
| 44s rotating dashed ring | lines 260-266 |
| bobbing bottle (`y: [0,-12,0]`, infinite) | lines 268-273 |
| bobbing seal (`y: [0,8,0]`, infinite) | lines 284-291 |
| 2 radar-band `FloatOrb`s | lines 310-311 |
| 2 CTA-band `FloatOrb`s | lines 411-412 |
| `TracingBeam` wrapper + import | lines 19, 344, 390 |

Replace the orbs with static CSS glow: a single absolutely-positioned `div` per dark band using `bg-[radial-gradient(...)]` or the existing `bg-grid` texture. No `animate-*` utility on any of them.

- [ ] **Step 3: Write the new hero**

The hero is asymmetric 7/5, display type at editorial scale, and the bottle is a hero photograph rather than a floating toy:

```tsx
      <section className="relative overflow-hidden bg-brand-navy text-white">
        <div className="absolute inset-0 bg-grid opacity-[0.055]" aria-hidden />
        <div
          className="pointer-events-none absolute -right-40 -top-32 h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle,theme(colors.brand.gold/0.16),transparent_68%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-32 top-1/2 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,theme(colors.brand.teal/0.14),transparent_70%)]"
          aria-hidden
        />

        <div className="container relative grid grid-cols-1 items-center gap-14 py-20 sm:py-28 lg:grid-cols-12 lg:py-36">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-brand-goldLight">
                {t('eyebrow')}
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-6 max-w-[15ch] font-display text-[2.75rem] font-bold leading-[1.04] tracking-[-0.02em] sm:text-6xl lg:text-7xl">
                {t('heroTitle')}
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-7 max-w-[54ch] text-lg leading-relaxed text-slate-300">
                {t('heroSubtitle')}
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Button asChild variant="gold" size="lg">
                  <Link href="/team-login">
                    {t('ctaInternal')} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white hover:bg-white/10"
                >
                  <Link href="/register">{t('ctaRegister')}</Link>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <p className="mt-8 max-w-[52ch] border-l border-white/15 pl-4 text-sm leading-relaxed text-slate-400">
                {t('platformNote')}
              </p>
            </Reveal>
          </div>

          <div className="relative mx-auto flex w-full max-w-sm items-center justify-center lg:col-span-5">
            <div
              className="absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,theme(colors.brand.gold/0.22),transparent_65%)] blur-2xl"
              aria-hidden
            />
            <Image
              src="/marketing/proamina-bottle.png"
              alt="Proamina®"
              width={380}
              height={380}
              priority
              sizes="(max-width: 1024px) 60vw, 22rem"
              className="relative z-10 h-auto w-[16rem] drop-shadow-2xl sm:w-[20rem]"
            />
            <Image
              src="/brand/proamina-seal.png"
              alt=""
              aria-hidden
              width={96}
              height={96}
              loading="lazy"
              className="absolute -bottom-3 -left-1 hidden h-24 w-24 rounded-2xl bg-white object-contain p-2 shadow-xl sm:block"
            />
          </div>
        </div>
      </section>
```

- [ ] **Step 4: Write the stats rule**

A hairline rule rather than a card, reading its copy from Task 10:

```tsx
      <section className="border-b bg-brand-cream/40">
        <div className="container py-14">
          <div className="grid grid-cols-2 divide-y divide-border/70 sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 70} className="px-4 py-5 text-center sm:py-0">
                <p className="font-display text-4xl font-bold tracking-tight text-brand-goldDark sm:text-5xl">
                  {stat.value}
                  {stat.suffix}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">{stat.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
```

Read it at the top of the component with:

```tsx
  const stats = t.raw('stats') as { value: number; suffix: string; label: string }[];
```

- [ ] **Step 5: Rewrite the remaining sections**

Keep every existing section's *content* and translation keys; change only the presentation. Each gets `Reveal` where the old code had `FadeUp`, and no section keeps a hover `motion.div`.

1. **Header** (was lines 173-186): drop `motion.header`, keep `sticky top-0 z-30 border-b border-white/10 bg-brand-navy/95 backdrop-blur` and the three children (`Logo`, `LanguageSwitcher`, `AccessMenu`) unchanged.
2. **Radar band** (was lines 309-336): keep the navy background, `bg-grid`, the two-column layout, `t('radarBadge')`/`t('radarTitle')`/`t('radarSubtitle')` and `<FeatureRadar />`. Replace the two orbs with one static radial-gradient div. Headline uses `font-display text-3xl sm:text-4xl lg:text-5xl tracking-[-0.02em]`.
3. **Product panels** (was lines 348-366): two large editorial panels replacing `ProductCard`. Each is a `<Link>` with `group relative flex h-full flex-col rounded-2xl border bg-card p-8 transition-shadow hover:shadow-lg sm:p-10`, an icon tile, `font-display text-2xl font-bold` title, description, and a CTA row whose arrow shifts on `group-hover:translate-x-1`. Keys unchanged: `internalTitle`/`internalDesc` → `/team-login`, `externalTitle`/`externalDesc` → `/login`.
4. **Features grid** (was lines 368-389): keep `t('featuresTitle')` and the six `t.raw('features')` entries with `FEATURE_ICONS`. Replace the card-per-feature with a hairline grid — `divide-x divide-y divide-border/70 border` on the wrapper, each cell `p-6` with no individual border or shadow. Keep `ICON_TONES` for the icon tiles (move the constant back in; it is plain data, not framer).
5. **Partner strip** (was lines 395-407): unchanged apart from `FadeUp` → `Reveal`.
6. **CTA band** (was lines 410-437): keep the navy background, `bg-grid`, `Globe2` icon, `t('ctaBannerTitle')`/`t('ctaBannerSubtitle')` and both buttons. Orbs → one static radial-gradient div.
7. **Footer** (was lines 440-478): unchanged, including `Creato Da : Amine , con <3` byte-for-byte.

- [ ] **Step 6: Confirm the page is a server component**

The file must have **no** `'use client'` directive and **no** `framer-motion` import. Verify:

```bash
head -1 "app/[locale]/page.tsx"
grep -c "framer-motion" "app/[locale]/page.tsx" || true
```

Expected: the first line is an import, not `'use client';`, and the grep count is `0`.

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all pass. In the build output, the `/[locale]` route's First Load JS should be **lower** than before this task — record both numbers.

- [ ] **Step 8: Verify visually**

Run: `npm run dev`, then screenshot `http://localhost:3000/it` and `http://localhost:3000/en` at **1366×768** and **390×844**.
Expected: no horizontal scrollbar at either width; the hero headline does not wrap awkwardly at 390px; the stats rule stacks 2×2 on mobile; nothing animates after the reveal settles.

- [ ] **Step 9: Commit**

```bash
git add "app/[locale]/page.tsx"
git commit -m "Rebuild the landing page as an editorial server component"
```

---

## PART D — Verification

### Task 12: Full verification and code review

**Files:** none modified by default.

- [ ] **Step 1: Run the whole suite**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all three green. Record the vitest pass count.

- [ ] **Step 2: Confirm every count flows through the helper**

Run:

```bash
grep -rn "ndaStatus === \"fully_signed\"\|ndaStatus === 'fully_signed'" lib app --include=*.ts --include=*.tsx
```

Expected: **no hits in any statistics or funnel function.** Hits inside per-row rendering, portal access gates, or `nda-status-sync.ts` are correct and expected — those legitimately read the cache.

- [ ] **Step 3: Request code review**

**REQUIRED SUB-SKILL:** `superpowers:requesting-code-review`, scoped to the diff of this branch against `backend-phase-1`.

- [ ] **Step 4: Receive the review**

**REQUIRED SUB-SKILL:** `superpowers:receiving-code-review`. Verify each point technically before implementing it; push back on anything that does not hold up rather than agreeing performatively.

- [ ] **Step 5: Commit any review fixes**

```bash
git add -A
git commit -m "Apply code review fixes"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
| --- | --- |
| `lib/nda-stats.ts` pure tally helper | 1 |
| `lib/backend/nda-current-status.ts` plain module, `where` for scope | 2 |
| `ndaStatistics()` counts the register | 2 |
| `companyStatistics().ndaSigned` counts the register | 3 |
| Analytics NDA funnel, both modes | 4 |
| Mock services use the same helper | 5 |
| `syncCompanyNdaStatus` guard; gmail-sync + upload routed through it | 6 |
| gmail-sync stops hand-setting `ndaStatus` on auto-create | 6 |
| No reconcile/backfill script | absent by design |
| Both Scarica dati cards removed, eager load removed | 7 |
| Server component + client islands | 11 |
| All infinite animations deleted | 11 |
| `Reveal` replaces `FadeUp`/`AnimatedTitle` | 8, 11 |
| `PartnerMarquee` CSS keyframes | 8, 9 |
| `TracingBeam` dropped | 11 |
| `FeatureRadar` kept as an island | 11 |
| `prefers-reduced-motion` honoured | 8, 9 |
| Hero `sizes`, seal lazy | 11 |
| Stats strip localised | 10, 11 |
| Footer credit untouched | 11 constraint |
| typecheck / lint / test | 12 |
| Screenshots 1366 + 390 | 11 |
| Code review pass | 12 |

**Deviation from the spec, resolved inline:** the spec named the guard option `keepSignedState`. Implementation uses **`neverRegress`** and delegates to the existing tested `reconcileNdaStatus()` in `lib/nda-status.ts`, which was already written for exactly this and is currently used nowhere in production code. `reconcileNdaStatus` is strictly stronger — it refuses any backward move, not only out of signature states — and it correctly treats `expired`/`terminated` as authoritative rather than as low-progress. Reusing it beats adding a second, weaker rule. The spec's tests for the guard are therefore already written (`tests/nda-status.test.ts`); Task 6 wires them to live code.

**Placeholder scan:** no `TBD`, no "handle edge cases", no "similar to Task N". Task 11 Step 5 describes six section transformations rather than pasting ~250 lines of markup — each names its exact source lines, its translation keys, and its concrete class strings, and the distinctive sections (hero, stats rule) are given in full.

**Type consistency:** `ndaStatusTallies` / `ndaFunnelCounts` / `NdaTallies` / `NDA_AWAITING_STATUSES` (Task 1) are used under those exact names in Tasks 2-5. `currentNdaByCompany` / `ndaScopeWhere` / `CurrentNda` (Task 2) match their use in Tasks 3-4. `currentNdasOf` (Task 5) is used in both mock files. `syncCompanyNdaStatus(tx, companyId, { neverRegress })` (Task 6) matches every call site. `Reveal` (Task 8) matches Task 11. `Landing.stats` shape `{ value: number; suffix: string; label: string }` (Task 10) matches the `t.raw` cast in Task 11 Step 4.
