import type { FinanceDocument } from '@/lib/types';

/**
 * Mock finance documents (QT-/ORD-/INV-2026-####). Line items use Proamina
 * products. subtotal/vatTotal/total are coherent. paymentStatus varied incl.
 * overdue. Currencies follow the company's preferredCurrency.
 */
export const FINANCE_DOCS: FinanceDocument[] = [
  /* ───────── Eurosup (customer with full quote→order→invoice chain) ───────── */
  {
    id: 'fin_qt_eurosup_1', kind: 'quote', reference: 'QT-2026-0001', companyId: 'c_eurosup', currency: 'EUR',
    issueDate: '2026-03-12', dueDate: '2026-03-26',
    lineItems: [{ id: 'li_1', productName: 'Proamina® 100% Protein Sweetener', quantity: 200, unit: 'kg', pricePerUnit: 42, pricePerKg: 42, vatPct: 22 }],
    subtotal: 8400, vatTotal: 1848, total: 10248, paymentTerms: '30 days net', paymentStatus: 'draft',
    notes: 'Q1 bar reformulation quote.', createdAt: '2026-03-12',
  },
  {
    id: 'fin_ord_eurosup_1', kind: 'order', reference: 'ORD-2026-0001', companyId: 'c_eurosup', currency: 'EUR',
    issueDate: '2026-03-20', relatedQuoteId: 'fin_qt_eurosup_1',
    lineItems: [{ id: 'li_2', productName: 'Proamina® 100% Protein Sweetener', quantity: 200, unit: 'kg', pricePerUnit: 42, pricePerKg: 42, vatPct: 22 }],
    subtotal: 8400, vatTotal: 1848, shippingCost: 120, total: 10368, paymentTerms: '30 days net', paymentStatus: 'paid',
    notes: 'Confirmed repeat order.', createdAt: '2026-03-20',
  },
  {
    id: 'fin_inv_eurosup_1', kind: 'invoice', reference: 'INV-2026-0001', companyId: 'c_eurosup', currency: 'EUR',
    issueDate: '2026-02-15', dueDate: '2026-03-17', relatedOrderId: 'fin_ord_eurosup_1',
    lineItems: [{ id: 'li_3', productName: 'Proamina® 100% Protein Sweetener', quantity: 150, unit: 'kg', pricePerUnit: 43, pricePerKg: 43, vatPct: 22 }],
    subtotal: 6450, vatTotal: 1419, total: 7869, paymentTerms: '30 days net', paymentStatus: 'paid', paidAmount: 7869, outstandingAmount: 0,
    notes: 'Q4 2025 order invoice — paid.', createdAt: '2026-02-15',
  },
  {
    id: 'fin_inv_eurosup_2', kind: 'invoice', reference: 'INV-2026-0008', companyId: 'c_eurosup', currency: 'EUR',
    issueDate: '2026-04-02', dueDate: '2026-05-02', relatedOrderId: 'fin_ord_eurosup_1',
    lineItems: [{ id: 'li_4', productName: 'Proamina® 100% Protein Sweetener', quantity: 200, unit: 'kg', pricePerUnit: 42, pricePerKg: 42, vatPct: 22 }],
    subtotal: 8400, vatTotal: 1848, shippingCost: 120, total: 10368, paymentTerms: '30 days net', paymentStatus: 'overdue',
    paidAmount: 0, outstandingAmount: 10368, overdueAmount: 10368,
    notes: 'Past due — finance chasing.', createdAt: '2026-04-02',
  },
  {
    id: 'fin_qt_eurosup_2', kind: 'quote', reference: 'QT-2026-0009', companyId: 'c_eurosup', currency: 'EUR',
    issueDate: '2026-06-13', dueDate: '2026-06-30',
    lineItems: [{ id: 'li_5', productName: 'Proamina® 100% Protein Sweetener', quantity: 300, unit: 'kg', pricePerUnit: 41, pricePerKg: 41, discountPct: 3, vatPct: 22 }],
    subtotal: 12300, discountTotal: 369, vatTotal: 2624.82, total: 14555.82, paymentTerms: '30 days net', paymentStatus: 'pending',
    notes: 'Q3 reorder quote (in preparation).', createdAt: '2026-06-13',
  },

  /* ───────── The Protein Works ───────── */
  {
    id: 'fin_qt_pw_1', kind: 'quote', reference: 'QT-2026-0002', companyId: 'c_proteinworks', currency: 'GBP',
    issueDate: '2026-05-30', dueDate: '2026-06-20',
    lineItems: [{ id: 'li_pw_1', productName: 'Proamina® 100% Protein Sweetener', quantity: 100, unit: 'kg', pricePerUnit: 38, pricePerKg: 38, vatPct: 0 }],
    subtotal: 3800, vatTotal: 0, total: 3800, paymentTerms: '30 days net', paymentStatus: 'pending',
    notes: 'Indicative pre-industrial quote (export, zero-rated).', createdAt: '2026-05-30',
  },
  {
    id: 'fin_inv_pw_1', kind: 'invoice', reference: 'INV-2026-0009', companyId: 'c_proteinworks', currency: 'GBP',
    issueDate: '2026-04-15', dueDate: '2026-05-15',
    lineItems: [{ id: 'li_pw_2', productName: 'Sample handling & courier (100g pilot)', quantity: 1, unit: 'units', pricePerUnit: 60, vatPct: 0 }],
    subtotal: 60, vatTotal: 0, total: 60, paymentTerms: '30 days net', paymentStatus: 'paid', paidAmount: 60, outstandingAmount: 0,
    notes: 'Sample logistics recharge — paid.', createdAt: '2026-04-15',
  },

  /* ───────── Disproquima ───────── */
  {
    id: 'fin_inv_disproquima_1', kind: 'invoice', reference: 'INV-2026-0010', companyId: 'c_disproquima', currency: 'EUR',
    issueDate: '2026-06-12', dueDate: '2026-07-12',
    lineItems: [{ id: 'li_dq_1', productName: 'Proamina® 100% Protein Sweetener (demo kit)', quantity: 2, unit: 'kg', pricePerUnit: 45, pricePerKg: 45, vatPct: 0 }],
    subtotal: 90, vatTotal: 0, shippingCost: 38, total: 128, paymentTerms: '30 days net', paymentStatus: 'pending', outstandingAmount: 128,
    notes: 'Pro-forma for distributor demo kit (intra-EU, reverse charge).', createdAt: '2026-06-12',
  },
  {
    id: 'fin_qt_disproquima_1', kind: 'quote', reference: 'QT-2026-0011', companyId: 'c_disproquima', currency: 'EUR',
    issueDate: '2026-06-12', dueDate: '2026-07-01',
    lineItems: [
      { id: 'li_dq_2', productName: 'Proamina® 100% Protein Sweetener (distributor tier 1)', quantity: 1000, unit: 'kg', pricePerUnit: 36, pricePerKg: 36, discountPct: 10, vatPct: 0 },
    ],
    subtotal: 36000, discountTotal: 3600, vatTotal: 0, total: 32400, paymentTerms: '45 days net', paymentStatus: 'draft',
    notes: 'Indicative distribution pricing (Iberia).', createdAt: '2026-06-12',
  },

  /* ───────── Südzucker ───────── */
  {
    id: 'fin_qt_sudzucker_1', kind: 'quote', reference: 'QT-2026-0012', companyId: 'c_sudzucker', currency: 'EUR',
    issueDate: '2026-06-02', dueDate: '2026-06-26',
    lineItems: [{ id: 'li_sz_1', productName: 'Proamina® co-development programme (phase 1)', quantity: 1, unit: 'units', pricePerUnit: 25000, vatPct: 0 }],
    subtotal: 25000, vatTotal: 0, total: 25000, paymentTerms: 'On milestone', paymentStatus: 'draft',
    notes: 'Co-development proposal value (indicative).', createdAt: '2026-06-02',
  },

  /* ───────── Venchi ───────── */
  {
    id: 'fin_inv_venchi_1', kind: 'invoice', reference: 'INV-2026-0011', companyId: 'c_venchi', currency: 'EUR',
    issueDate: '2026-06-08', dueDate: '2026-07-08',
    lineItems: [{ id: 'li_ve_1', productName: 'Proamina® 100% Protein Sweetener (6kg sample)', quantity: 6, unit: 'kg', pricePerUnit: 44, pricePerKg: 44, vatPct: 22 }],
    subtotal: 264, vatTotal: 58.08, shippingCost: 22, total: 344.08, paymentTerms: '30 days net', paymentStatus: 'pending', outstandingAmount: 344.08,
    notes: 'Paid sample (above free-sample threshold).', createdAt: '2026-06-08',
  },
  {
    id: 'fin_qt_venchi_1', kind: 'quote', reference: 'QT-2026-0013', companyId: 'c_venchi', currency: 'EUR',
    issueDate: '2026-06-09', dueDate: '2026-07-09',
    lineItems: [{ id: 'li_ve_2', productName: 'Proamina® 100% Protein Sweetener (pilot batch)', quantity: 100, unit: 'kg', pricePerUnit: 43, pricePerKg: 43, vatPct: 22 }],
    subtotal: 4300, vatTotal: 946, total: 5246, paymentTerms: '30 days net', paymentStatus: 'draft',
    notes: 'Praline pilot batch quote (pending feedback).', createdAt: '2026-06-09',
  },

  /* ───────── Emmi ───────── */
  {
    id: 'fin_inv_emmi_1', kind: 'invoice', reference: 'INV-2026-0012', companyId: 'c_emmi', currency: 'CHF',
    issueDate: '2026-05-10', dueDate: '2026-06-09',
    lineItems: [{ id: 'li_em_1', productName: 'Proamina® sample + CH customs handling', quantity: 1, unit: 'units', pricePerUnit: 95, vatPct: 0 }],
    subtotal: 95, vatTotal: 0, total: 95, paymentTerms: '30 days net', paymentStatus: 'paid', paidAmount: 95, outstandingAmount: 0,
    notes: 'Sample logistics recharge — paid.', createdAt: '2026-05-10',
  },

  /* ───────── Nick's ───────── */
  {
    id: 'fin_inv_nicks_1', kind: 'invoice', reference: 'INV-2026-0013', companyId: 'c_nicks', currency: 'EUR',
    issueDate: '2026-05-29', dueDate: '2026-06-28',
    lineItems: [{ id: 'li_nk_1', productName: 'Sample courier (UPS, Sweden)', quantity: 1, unit: 'units', pricePerUnit: 44, vatPct: 0 }],
    subtotal: 44, vatTotal: 0, total: 44, paymentTerms: '30 days net', paymentStatus: 'pending', outstandingAmount: 44,
    notes: 'Courier recharge.', createdAt: '2026-05-29',
  },

  /* ───────── Bel ───────── */
  {
    id: 'fin_inv_bel_1', kind: 'invoice', reference: 'INV-2026-0014', companyId: 'c_bel', currency: 'EUR',
    issueDate: '2026-06-11', dueDate: '2026-07-11',
    lineItems: [{ id: 'li_bl_1', productName: 'Proamina® 100% Protein Sweetener (15kg R&D sample)', quantity: 15, unit: 'kg', pricePerUnit: 40, pricePerKg: 40, vatPct: 0 }],
    subtotal: 600, vatTotal: 0, shippingCost: 72, total: 672, paymentTerms: '30 days net', paymentStatus: 'pending', outstandingAmount: 672,
    notes: 'Chargeable R&D sample (intra-EU, reverse charge).', createdAt: '2026-06-11',
  },

  /* ───────── NÖM (quote) ───────── */
  {
    id: 'fin_qt_nom_1', kind: 'quote', reference: 'QT-2026-0015', companyId: 'c_nom', currency: 'EUR',
    issueDate: '2026-06-10', dueDate: '2026-07-10',
    lineItems: [{ id: 'li_nm_1', productName: 'Proamina® 100% Protein Sweetener (10kg trial)', quantity: 10, unit: 'kg', pricePerUnit: 41, pricePerKg: 41, vatPct: 0 }],
    subtotal: 410, vatTotal: 0, shippingCost: 30, total: 440, paymentTerms: '30 days net', paymentStatus: 'draft',
    notes: 'Trial-quantity quote.', createdAt: '2026-06-10',
  },

  /* ───────── Casillo ───────── */
  {
    id: 'fin_inv_casillo_1', kind: 'invoice', reference: 'INV-2026-0015', companyId: 'c_casillo', currency: 'EUR',
    issueDate: '2026-03-15', dueDate: '2026-04-14',
    lineItems: [{ id: 'li_ca_1', productName: 'Sample courier (GLS)', quantity: 1, unit: 'units', pricePerUnit: 11, vatPct: 22 }],
    subtotal: 11, vatTotal: 2.42, total: 13.42, paymentTerms: '30 days net', paymentStatus: 'paid', paidAmount: 13.42, outstandingAmount: 0,
    createdAt: '2026-03-15',
  },

  /* ───────── Innofoods (partially paid) ───────── */
  {
    id: 'fin_inv_innofoods_1', kind: 'invoice', reference: 'INV-2026-0016', companyId: 'c_innofoods', currency: 'EUR',
    issueDate: '2026-04-05', dueDate: '2026-05-05',
    lineItems: [{ id: 'li_if_1', productName: 'Proamina® 100% Protein Sweetener (trial)', quantity: 5, unit: 'kg', pricePerUnit: 44, pricePerKg: 44, vatPct: 0 }],
    subtotal: 220, vatTotal: 0, shippingCost: 18, total: 238, paymentTerms: '30 days net', paymentStatus: 'partially_paid', paidAmount: 120, outstandingAmount: 118,
    notes: 'Partial payment received.', createdAt: '2026-04-05',
  },

  /* ───────── Nutrimuscle ───────── */
  {
    id: 'fin_inv_nutrimuscle_1', kind: 'invoice', reference: 'INV-2026-0017', companyId: 'c_nutrimuscle', currency: 'EUR',
    issueDate: '2026-05-21', dueDate: '2026-06-20',
    lineItems: [{ id: 'li_nu_1', productName: 'Sample courier (DHL, Brussels)', quantity: 1, unit: 'units', pricePerUnit: 30, vatPct: 0 }],
    subtotal: 30, vatTotal: 0, total: 30, paymentTerms: '30 days net', paymentStatus: 'pending', outstandingAmount: 30,
    createdAt: '2026-05-21',
  },

  /* ───────── ABS Food ───────── */
  {
    id: 'fin_inv_absfood_1', kind: 'invoice', reference: 'INV-2026-0018', companyId: 'c_absfood', currency: 'EUR',
    issueDate: '2026-06-07', dueDate: '2026-07-07',
    lineItems: [{ id: 'li_ab_1', productName: 'Sample courier (TNT)', quantity: 1, unit: 'units', pricePerUnit: 12, vatPct: 22 }],
    subtotal: 12, vatTotal: 2.64, total: 14.64, paymentTerms: '30 days net', paymentStatus: 'pending', outstandingAmount: 14.64,
    createdAt: '2026-06-07',
  },

  /* ───────── Galbusera (quote) ───────── */
  {
    id: 'fin_qt_galbusera_1', kind: 'quote', reference: 'QT-2026-0019', companyId: 'c_galbusera', currency: 'EUR',
    issueDate: '2026-06-01', dueDate: '2026-06-30',
    lineItems: [{ id: 'li_ga_1', productName: 'Proamina® 100% Protein Sweetener (bench trial)', quantity: 25, unit: 'kg', pricePerUnit: 43, pricePerKg: 43, vatPct: 22 }],
    subtotal: 1075, vatTotal: 236.5, total: 1311.5, paymentTerms: '30 days net', paymentStatus: 'draft',
    notes: 'Bench-trial quantity quote (pending sample confirmation).', createdAt: '2026-06-01',
  },

  /* ───────── Almarai (order) ───────── */
  {
    id: 'fin_ord_almarai_1', kind: 'order', reference: 'ORD-2026-0020', companyId: 'c_almarai', currency: 'USD',
    issueDate: '2026-06-01',
    lineItems: [{ id: 'li_al_1', productName: 'Proamina® 100% Protein Sweetener (scoping sample)', quantity: 2, unit: 'kg', pricePerUnit: 50, pricePerKg: 50, vatPct: 0 }],
    subtotal: 100, vatTotal: 0, shippingCost: 85, total: 185, paymentTerms: 'Prepaid', paymentStatus: 'pending', outstandingAmount: 185,
    notes: 'Scoping sample order (GCC export).', createdAt: '2026-06-01',
  },

  /* ───────── Panettieri (paid micro) ───────── */
  {
    id: 'fin_inv_panettieri_1', kind: 'invoice', reference: 'INV-2026-0021', companyId: 'c_panettieri', currency: 'EUR',
    issueDate: '2026-05-26', dueDate: '2026-06-25',
    lineItems: [{ id: 'li_pa_1', productName: 'Proamina® 100% Protein Sweetener (300g sample)', quantity: 300, unit: 'g', pricePerUnit: 0.05, vatPct: 22 }],
    subtotal: 15, vatTotal: 3.3, shippingCost: 15, total: 33.3, paymentTerms: '30 days net', paymentStatus: 'paid', paidAmount: 33.3, outstandingAmount: 0,
    createdAt: '2026-05-26',
  },

  /* ───────── Eurosup credit note ───────── */
  {
    id: 'fin_cn_eurosup_1', kind: 'credit_note', reference: 'CN-2026-0001', companyId: 'c_eurosup', currency: 'EUR',
    issueDate: '2026-03-25', relatedOrderId: 'fin_ord_eurosup_1',
    lineItems: [{ id: 'li_cn_1', productName: 'Goodwill adjustment — delayed shipment', quantity: 1, unit: 'units', pricePerUnit: -100, vatPct: 22 }],
    subtotal: -100, vatTotal: -22, total: -122, paymentStatus: 'refunded', notes: 'Credit for late delivery on ORD-2026-0001.', createdAt: '2026-03-25',
  },

  /* ───────── Suntory (draft quote) ───────── */
  {
    id: 'fin_qt_suntory_1', kind: 'quote', reference: 'QT-2026-0022', companyId: 'c_suntory', currency: 'GBP',
    issueDate: '2026-06-08', dueDate: '2026-07-08',
    lineItems: [{ id: 'li_su_1', productName: 'Proamina® 100% Protein Sweetener (concept sample)', quantity: 500, unit: 'g', pricePerUnit: 0.04, vatPct: 0 }],
    subtotal: 20, vatTotal: 0, shippingCost: 0, total: 20, paymentTerms: 'Sample (no charge)', paymentStatus: 'draft',
    notes: 'Concept sample — no charge pending address.', createdAt: '2026-06-08',
  },
];

export function getFinanceDocs(): FinanceDocument[] {
  return FINANCE_DOCS;
}
