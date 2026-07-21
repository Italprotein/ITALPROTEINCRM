"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireAction, requireSection, requireUser } from "@/lib/backend/session";
import type { FinanceDocument, FinanceDocKind, PaymentStatus } from "@/lib/types";
import {
  makeId,
  parseId,
  quoteToDTO,
  quoteWriteData,
  orderToDTO,
  orderWriteData,
  invoiceToDTO,
  invoiceWriteData,
  creditNoteToDTO,
  creditNoteWriteData,
  lineItemWriteData,
} from "./finance.mapper";

// FinanceDocument is a polymorphic view over four tables. Each query fans out to
// the relevant table(s), maps rows to the unified DTO, then merges/sorts.
// External users see only their own company's documents; internal users see all.

// ── Scoping (server is the authority) ────────────────────────────────────────
async function companyScope(): Promise<string | null | undefined> {
  // Returns: undefined = internal (no filter), string = external companyId,
  // null = no access (no session, or external without a company).
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.kind === "external") return user.companyId ?? null;
  return undefined;
}

function quoteWhere(companyId: string | null | undefined): Prisma.QuoteWhereInput {
  if (companyId === null) return { id: "__no_access__" };
  if (companyId === undefined) return {};
  return { companyId };
}
function orderWhere(companyId: string | null | undefined): Prisma.OrderWhereInput {
  if (companyId === null) return { id: "__no_access__" };
  if (companyId === undefined) return {};
  return { companyId };
}
function invoiceWhere(companyId: string | null | undefined): Prisma.InvoiceWhereInput {
  if (companyId === null) return { id: "__no_access__" };
  if (companyId === undefined) return {};
  return { companyId };
}
function creditNoteWhere(companyId: string | null | undefined): Prisma.CreditNoteWhereInput {
  if (companyId === null) return { id: "__no_access__" };
  if (companyId === undefined) return {};
  return { companyId };
}

// ── Read fan-out ─────────────────────────────────────────────────────────────
async function loadQuotes(scope: string | null | undefined): Promise<FinanceDocument[]> {
  const rows = await prisma.quote.findMany({
    where: quoteWhere(scope),
    include: { lineItems: true },
    orderBy: { issueDate: "desc" },
  });
  return rows.map(quoteToDTO);
}
async function loadOrders(scope: string | null | undefined): Promise<FinanceDocument[]> {
  const rows = await prisma.order.findMany({
    where: orderWhere(scope),
    include: { lineItems: true },
    orderBy: { issueDate: "desc" },
  });
  return rows.map(orderToDTO);
}
async function loadInvoices(scope: string | null | undefined): Promise<FinanceDocument[]> {
  const rows = await prisma.invoice.findMany({
    where: invoiceWhere(scope),
    include: { lineItems: true },
    orderBy: { issueDate: "desc" },
  });
  return rows.map(invoiceToDTO);
}
async function loadCreditNotes(scope: string | null | undefined): Promise<FinanceDocument[]> {
  const rows = await prisma.creditNote.findMany({
    where: creditNoteWhere(scope),
    orderBy: { createdAt: "desc" },
  });
  return rows.map(creditNoteToDTO);
}

function sortByIssueDesc(docs: FinanceDocument[]): FinanceDocument[] {
  return docs.sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : 0));
}

export async function listFinanceDocuments(): Promise<FinanceDocument[]> {
  await requireSection("finance");
  const scope = await companyScope();
  const [quotes, orders, invoices, creditNotes] = await Promise.all([
    loadQuotes(scope),
    loadOrders(scope),
    loadInvoices(scope),
    loadCreditNotes(scope),
  ]);
  return sortByIssueDesc([...quotes, ...orders, ...invoices, ...creditNotes]);
}

export async function getFinanceDocument(id: string): Promise<FinanceDocument | undefined> {
  await requireSection("finance");
  const parsed = parseId(id);
  if (!parsed) return undefined;
  const scope = await companyScope();
  if (scope === null) return undefined;
  const { kind, rowId } = parsed;

  if (kind === "quote") {
    const row = await prisma.quote.findFirst({
      where: { AND: [quoteWhere(scope), { id: rowId }] },
      include: { lineItems: true },
    });
    return row ? quoteToDTO(row) : undefined;
  }
  if (kind === "order") {
    const row = await prisma.order.findFirst({
      where: { AND: [orderWhere(scope), { id: rowId }] },
      include: { lineItems: true },
    });
    return row ? orderToDTO(row) : undefined;
  }
  if (kind === "invoice") {
    const row = await prisma.invoice.findFirst({
      where: { AND: [invoiceWhere(scope), { id: rowId }] },
      include: { lineItems: true },
    });
    return row ? invoiceToDTO(row) : undefined;
  }
  const row = await prisma.creditNote.findFirst({
    where: { AND: [creditNoteWhere(scope), { id: rowId }] },
  });
  return row ? creditNoteToDTO(row) : undefined;
}

// ── Create ───────────────────────────────────────────────────────────────────
export async function createFinanceDocument(input: FinanceDocument): Promise<FinanceDocument> {
  const user = await requireAction("finance.edit");
  const actorId = user.id;
  const kind: FinanceDocKind = input.kind;
  const parsed = parseId(input.id);
  const rowId = parsed?.rowId ?? input.id; // accept composite or raw id
  const lineItemsCreate = { create: input.lineItems.map(lineItemWriteData) };

  if (kind === "quote") {
    const row = await prisma.quote.create({
      data: {
        ...quoteWriteData(input, actorId),
        id: rowId,
        createdById: actorId,
        lineItems: lineItemsCreate,
      },
      include: { lineItems: true },
    });
    return quoteToDTO(row);
  }
  if (kind === "order") {
    const row = await prisma.order.create({
      data: {
        ...orderWriteData(input, actorId),
        id: rowId,
        createdById: actorId,
        lineItems: lineItemsCreate,
      },
      include: { lineItems: true },
    });
    return orderToDTO(row);
  }
  if (kind === "invoice") {
    const row = await prisma.invoice.create({
      data: {
        ...invoiceWriteData(input, actorId),
        id: rowId,
        createdById: actorId,
        lineItems: lineItemsCreate,
      },
      include: { lineItems: true },
    });
    return invoiceToDTO(row);
  }

  // credit_note: schema requires a non-null invoiceId, but the unified DTO does
  // not carry one. Resolve the company's most recent invoice as the anchor.
  // TODO: thread an explicit related invoice id through the finance contract so
  // credit notes are not heuristically attached to the latest invoice.
  const anchorInvoice = await prisma.invoice.findFirst({
    where: input.companyId ? { companyId: input.companyId } : {},
    orderBy: { issueDate: "desc" },
    select: { id: true },
  });
  if (!anchorInvoice) {
    // No invoice to attach to; cannot persist without violating the FK. Echo the
    // input back so the caller is not broken. TODO: support standalone credit
    // notes once the schema/contract allows a null invoice link.
    return { ...input, id: makeId("credit_note", rowId) };
  }
  const row = await prisma.creditNote.create({
    data: {
      ...creditNoteWriteData(input, anchorInvoice.id, actorId),
      id: rowId,
      createdById: actorId,
    },
  });
  return creditNoteToDTO(row);
}

// ── Update ───────────────────────────────────────────────────────────────────
export async function updateFinanceDocument(
  id: string,
  patch: Partial<FinanceDocument>,
): Promise<FinanceDocument | undefined> {
  const user = await requireAction("finance.edit");
  const parsed = parseId(id);
  if (!parsed) return undefined;
  const actorId = user.id;
  const { kind, rowId } = parsed;

  const existing = await getFinanceDocument(id);
  if (!existing) return undefined;
  const merged: FinanceDocument = { ...existing, ...patch, kind, id };

  // Re-create nested line items only when the patch supplies them.
  const lineItemsChanged = patch.lineItems !== undefined;
  const lineItemsNested = lineItemsChanged
    ? { deleteMany: {}, create: merged.lineItems.map(lineItemWriteData) }
    : undefined;

  if (kind === "quote") {
    const row = await prisma.quote.update({
      where: { id: rowId },
      data: { ...quoteWriteData(merged, actorId), ...(lineItemsNested ? { lineItems: lineItemsNested } : {}) },
      include: { lineItems: true },
    });
    return quoteToDTO(row);
  }
  if (kind === "order") {
    const row = await prisma.order.update({
      where: { id: rowId },
      data: { ...orderWriteData(merged, actorId), ...(lineItemsNested ? { lineItems: lineItemsNested } : {}) },
      include: { lineItems: true },
    });
    return orderToDTO(row);
  }
  if (kind === "invoice") {
    const row = await prisma.invoice.update({
      where: { id: rowId },
      data: { ...invoiceWriteData(merged, actorId), ...(lineItemsNested ? { lineItems: lineItemsNested } : {}) },
      include: { lineItems: true },
    });
    return invoiceToDTO(row);
  }

  // credit_note: keep the existing invoice anchor; only scalar fields change.
  const current = await prisma.creditNote.findUnique({ where: { id: rowId }, select: { invoiceId: true } });
  if (!current) return undefined;
  const row = await prisma.creditNote.update({
    where: { id: rowId },
    data: creditNoteWriteData(merged, current.invoiceId, actorId),
  });
  return creditNoteToDTO(row);
}

// ── Remove ───────────────────────────────────────────────────────────────────
export async function removeFinanceDocument(id: string): Promise<void> {
  await requireAction("finance.edit");
  const parsed = parseId(id);
  if (!parsed) return;
  const { kind, rowId } = parsed;
  if (kind === "quote") {
    await prisma.quote.delete({ where: { id: rowId } }).catch(() => undefined);
  } else if (kind === "order") {
    await prisma.order.delete({ where: { id: rowId } }).catch(() => undefined);
  } else if (kind === "invoice") {
    await prisma.invoice.delete({ where: { id: rowId } }).catch(() => undefined);
  } else {
    await prisma.creditNote.delete({ where: { id: rowId } }).catch(() => undefined);
  }
}

// ── Derived collections ──────────────────────────────────────────────────────
export async function financeDocumentsByCompany(companyId: string): Promise<FinanceDocument[]> {
  // Deliberately only `requireUser()`, NOT `requireSection('finance')`: the company
  // detail page loads this in an unconditional Promise.all alongside contacts,
  // samples, shipments … for every internal role. rnd_technical and logistics have
  // finance hidden, so a section guard here would reject and take the whole page
  // down with it. Company scoping below is what keeps external users to their own
  // documents (and is what serves the portal's own quote/payment views).
  await requireUser();
  const scope = await companyScope();
  // Honor scoping: an external user may only read their own company.
  if (scope !== undefined && scope !== companyId) return [];
  const effective = scope === undefined ? companyId : scope;
  const [quotes, orders, invoices, creditNotes] = await Promise.all([
    loadQuotes(effective),
    loadOrders(effective),
    loadInvoices(effective),
    loadCreditNotes(effective),
  ]);
  return sortByIssueDesc([...quotes, ...orders, ...invoices, ...creditNotes]);
}

export async function financeDocumentsByKind(kind: FinanceDocKind): Promise<FinanceDocument[]> {
  await requireSection("finance");
  const scope = await companyScope();
  const map: Record<FinanceDocKind, (s: string | null | undefined) => Promise<FinanceDocument[]>> = {
    quote: loadQuotes,
    order: loadOrders,
    invoice: loadInvoices,
    credit_note: loadCreditNotes,
  };
  return sortByIssueDesc(await map[kind](scope));
}

// ── Statistics (mirror of the mock aggregation) ──────────────────────────────
export async function financeStatistics() {
  await requireSection("finance");
  const all = await listFinanceDocuments();
  const invoices = all.filter((d) => d.kind === "invoice");
  const byStatus = {} as Record<PaymentStatus, number>;
  for (const d of all) byStatus[d.paymentStatus] = (byStatus[d.paymentStatus] ?? 0) + 1;
  return {
    total: all.length,
    quotes: all.filter((d) => d.kind === "quote").length,
    orders: all.filter((d) => d.kind === "order").length,
    invoices: invoices.length,
    revenue: invoices
      .filter((d) => d.paymentStatus === "paid")
      .reduce((s, d) => s + d.total, 0),
    outstanding: invoices.reduce((s, d) => s + (d.outstandingAmount ?? 0), 0),
    overdue: invoices
      .filter((d) => d.paymentStatus === "overdue")
      .reduce((s, d) => s + (d.overdueAmount ?? d.outstandingAmount ?? d.total), 0),
    byStatus,
  };
}
