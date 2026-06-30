import type {
  Quote as PrismaQuote,
  QuoteLineItem as PrismaQuoteLineItem,
  Order as PrismaOrder,
  OrderLineItem as PrismaOrderLineItem,
  Invoice as PrismaInvoice,
  InvoiceLineItem as PrismaInvoiceLineItem,
  CreditNote as PrismaCreditNote,
} from "@/lib/generated/prisma/client";
import type {
  FinanceDocument,
  FinanceDocKind,
  LineItem,
  Currency,
  PaymentStatus,
  QuantityUnit,
} from "@/lib/types";

// Prisma rows <-> unified FinanceDocument DTO. The mock service exposes ONE
// polymorphic document type discriminated by `kind`, but the schema splits it
// across four physical tables (Quote / Order / Invoice / CreditNote), each with
// its own nested line items. Because the four tables have independent id spaces,
// the DTO id is a composite "<kind>:<rowId>" so get/update/remove can route to
// the right table. Key transforms: *Minor-style Int <-> currency units (÷/×100),
// Decimal <-> Number, DateTime <-> ISO string, FK renames (quoteId/orderId ->
// relatedQuoteId/relatedOrderId).

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);

const fromMinor = (v: number): number => v / 100;
const toMinor = (v: number): number => Math.round(v * 100);
const fromMinorOpt = (v: number | null): number | undefined => (v == null ? undefined : v / 100);
const toMinorOpt = (v: number | null | undefined): number | null =>
  v == null ? null : Math.round(v * 100);

// ── Composite id helpers (kind:rowId) ────────────────────────────────────────
export function makeId(kind: FinanceDocKind, rowId: string): string {
  return `${kind}:${rowId}`;
}

export function parseId(id: string): { kind: FinanceDocKind; rowId: string } | undefined {
  const idx = id.indexOf(":");
  if (idx === -1) return undefined;
  const kind = id.slice(0, idx) as FinanceDocKind;
  const rowId = id.slice(idx + 1);
  if (!["quote", "order", "invoice", "credit_note"].includes(kind)) return undefined;
  return { kind, rowId };
}

// ── Line items (shared shape across Quote/Order/Invoice line item tables) ─────
type AnyLineItemRow =
  | PrismaQuoteLineItem
  | PrismaOrderLineItem
  | PrismaInvoiceLineItem;

function lineItemToDTO(li: AnyLineItemRow): LineItem {
  return {
    id: li.id,
    productName: li.productName,
    quantity: Number(li.quantity),
    unit: li.unit as QuantityUnit,
    pricePerUnit: fromMinor(li.pricePerUnit),
    pricePerKg: li.pricePerKg == null ? undefined : fromMinor(li.pricePerKg),
    discountPct: li.discountPct == null ? undefined : Number(li.discountPct),
    vatPct: li.vatPct == null ? undefined : Number(li.vatPct),
  };
}

/** LineItem DTO -> nested create payload for a *LineItem table. Decimal columns
 * accept a plain number on write (Prisma coerces). */
export function lineItemWriteData(li: LineItem) {
  return {
    productName: li.productName,
    quantity: li.quantity,
    unit: li.unit,
    pricePerUnit: toMinor(li.pricePerUnit),
    pricePerKg: li.pricePerKg == null ? null : toMinor(li.pricePerKg),
    discountPct: li.discountPct ?? null,
    vatPct: li.vatPct ?? null,
  };
}

// ── Quote ────────────────────────────────────────────────────────────────────
type QuoteWithItems = PrismaQuote & { lineItems: PrismaQuoteLineItem[] };

export function quoteToDTO(q: QuoteWithItems): FinanceDocument {
  return {
    id: makeId("quote", q.id),
    kind: "quote",
    reference: q.reference,
    companyId: q.companyId,
    currency: q.currency as Currency,
    issueDate: q.issueDate.toISOString(),
    dueDate: q.validUntil?.toISOString(),
    lineItems: q.lineItems.map(lineItemToDTO),
    subtotal: fromMinor(q.subtotal),
    discountTotal: fromMinorOpt(q.discountTotal),
    vatTotal: fromMinorOpt(q.vatTotal),
    shippingCost: fromMinorOpt(q.shippingCost),
    total: fromMinor(q.total),
    paymentTerms: undef(q.paymentTerms),
    // Quotes have no paymentStatus column; surface a sensible default.
    paymentStatus: "draft",
    relatedQuoteId: undefined,
    relatedOrderId: undefined,
    notes: undef(q.notes),
    createdAt: q.createdAt.toISOString(),
  };
}

export function quoteWriteData(input: FinanceDocument, actorId: string | null) {
  return {
    reference: input.reference,
    companyId: input.companyId,
    currency: input.currency,
    issueDate: new Date(input.issueDate),
    validUntil: input.dueDate ? new Date(input.dueDate) : null,
    subtotal: toMinor(input.subtotal),
    discountTotal: toMinorOpt(input.discountTotal),
    vatTotal: toMinorOpt(input.vatTotal),
    shippingCost: toMinorOpt(input.shippingCost),
    total: toMinor(input.total),
    paymentTerms: input.paymentTerms ?? null,
    notes: input.notes ?? null,
    updatedById: actorId,
  };
}

// ── Order ──────────────────────────────────────────────────────────────────—
type OrderWithItems = PrismaOrder & { lineItems: PrismaOrderLineItem[] };

export function orderToDTO(o: OrderWithItems): FinanceDocument {
  return {
    id: makeId("order", o.id),
    kind: "order",
    reference: o.reference,
    companyId: o.companyId,
    currency: o.currency as Currency,
    issueDate: o.issueDate.toISOString(),
    dueDate: o.dueDate?.toISOString(),
    lineItems: o.lineItems.map(lineItemToDTO),
    subtotal: fromMinor(o.subtotal),
    discountTotal: fromMinorOpt(o.discountTotal),
    vatTotal: fromMinorOpt(o.vatTotal),
    shippingCost: fromMinorOpt(o.shippingCost),
    total: fromMinor(o.total),
    paymentTerms: undef(o.paymentTerms),
    // Orders have no paymentStatus column; surface a sensible default.
    paymentStatus: "pending",
    relatedQuoteId: o.quoteId ? makeId("quote", o.quoteId) : undefined,
    relatedOrderId: undefined,
    notes: undef(o.notes),
    createdAt: o.createdAt.toISOString(),
  };
}

export function orderWriteData(input: FinanceDocument, actorId: string | null) {
  const related = input.relatedQuoteId ? parseId(input.relatedQuoteId) : undefined;
  return {
    reference: input.reference,
    companyId: input.companyId,
    quoteId: related?.kind === "quote" ? related.rowId : null,
    currency: input.currency,
    issueDate: new Date(input.issueDate),
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    subtotal: toMinor(input.subtotal),
    discountTotal: toMinorOpt(input.discountTotal),
    vatTotal: toMinorOpt(input.vatTotal),
    shippingCost: toMinorOpt(input.shippingCost),
    total: toMinor(input.total),
    paymentTerms: input.paymentTerms ?? null,
    notes: input.notes ?? null,
    updatedById: actorId,
  };
}

// ── Invoice ───────────────────────────────────────────────────────────────—
type InvoiceWithItems = PrismaInvoice & { lineItems: PrismaInvoiceLineItem[] };

export function invoiceToDTO(i: InvoiceWithItems): FinanceDocument {
  return {
    id: makeId("invoice", i.id),
    kind: "invoice",
    reference: i.reference,
    companyId: i.companyId,
    currency: i.currency as Currency,
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate?.toISOString(),
    lineItems: i.lineItems.map(lineItemToDTO),
    subtotal: fromMinor(i.subtotal),
    discountTotal: fromMinorOpt(i.discountTotal),
    vatTotal: fromMinorOpt(i.vatTotal),
    shippingCost: fromMinorOpt(i.shippingCost),
    total: fromMinor(i.total),
    paymentTerms: undef(i.paymentTerms),
    paymentStatus: i.paymentStatus as PaymentStatus,
    paidAmount: fromMinor(i.paidAmount),
    outstandingAmount: fromMinorOpt(i.outstandingAmount),
    overdueAmount: fromMinorOpt(i.overdueAmount),
    relatedOrderId: i.orderId ? makeId("order", i.orderId) : undefined,
    relatedQuoteId: undefined,
    notes: undef(i.notes),
    createdAt: i.createdAt.toISOString(),
  };
}

export function invoiceWriteData(input: FinanceDocument, actorId: string | null) {
  const related = input.relatedOrderId ? parseId(input.relatedOrderId) : undefined;
  return {
    reference: input.reference,
    companyId: input.companyId,
    orderId: related?.kind === "order" ? related.rowId : null,
    paymentStatus: input.paymentStatus,
    currency: input.currency,
    issueDate: new Date(input.issueDate),
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    subtotal: toMinor(input.subtotal),
    discountTotal: toMinorOpt(input.discountTotal),
    vatTotal: toMinorOpt(input.vatTotal),
    shippingCost: toMinorOpt(input.shippingCost),
    total: toMinor(input.total),
    paidAmount: input.paidAmount == null ? 0 : toMinor(input.paidAmount),
    outstandingAmount: toMinorOpt(input.outstandingAmount),
    overdueAmount: toMinorOpt(input.overdueAmount),
    paymentTerms: input.paymentTerms ?? null,
    notes: input.notes ?? null,
    updatedById: actorId,
  };
}

// ── Credit note ──────────────────────────────────────────────────────────────
// CreditNote has no line items or order-level totals in the schema — it carries
// a single `amount`. We project that into the DTO's subtotal/total and emit no
// line items. On write, the DTO total is collapsed back into `amount`.
export function creditNoteToDTO(cn: PrismaCreditNote): FinanceDocument {
  const total = fromMinor(cn.amount);
  return {
    id: makeId("credit_note", cn.id),
    kind: "credit_note",
    reference: cn.reference,
    companyId: cn.companyId ?? "",
    currency: cn.currency as Currency,
    issueDate: (cn.issuedAt ?? cn.createdAt).toISOString(),
    dueDate: undefined,
    lineItems: [],
    subtotal: total,
    discountTotal: undefined,
    vatTotal: undefined,
    shippingCost: undefined,
    total,
    paymentTerms: undefined,
    paymentStatus: "refunded",
    relatedOrderId: undefined,
    relatedQuoteId: undefined,
    notes: undef(cn.notes ?? cn.reason),
    createdAt: cn.createdAt.toISOString(),
  };
}

export function creditNoteWriteData(
  input: FinanceDocument,
  invoiceId: string,
  actorId: string | null,
) {
  return {
    reference: input.reference,
    companyId: input.companyId || null,
    invoiceId,
    amount: toMinor(input.total),
    currency: input.currency,
    reason: input.notes ?? null,
    issuedAt: new Date(input.issueDate),
    notes: input.notes ?? null,
    updatedById: actorId,
  };
}
