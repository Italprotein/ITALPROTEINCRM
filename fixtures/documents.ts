import type { DocumentRecord } from '@/lib/types';

/**
 * Mock document library. accessLevel drives portal visibility:
 * public/portal_general/pre_nda are broadly visible; post_nda/company_specific
 * require a signed NDA; internal is staff-only. companyId is set for
 * company-specific and post-NDA documents. c_proteinworks has several.
 */
export const DOCUMENTS: DocumentRecord[] = [
  /* ───────── Public / general marketing & technical ───────── */
  { id: 'doc_001', name: 'Proamina® — Company Overview.pdf', category: 'presentation', accessLevel: 'public', fileType: 'pdf', sizeKb: 3200, version: 'v4', uploadedAt: '2026-01-10', uploadedByUserId: 'u_giuseppe', description: 'Public corporate deck.', downloadCount: 312 },
  { id: 'doc_002', name: 'Proamina® — The Protein Sweetener (brochure).pdf', category: 'marketing', accessLevel: 'public', fileType: 'pdf', sizeKb: 2100, version: 'v3', uploadedAt: '2026-02-01', uploadedByUserId: 'u_giuseppe', downloadCount: 540 },
  { id: 'doc_003', name: 'Proamina® product range overview.png', category: 'photo', accessLevel: 'public', fileType: 'png', sizeKb: 880, uploadedAt: '2026-02-15', uploadedByUserId: 'u_giuseppe', downloadCount: 201 },
  { id: 'doc_004', name: 'Sugar reduction with Proamina® (white paper).pdf', category: 'marketing', accessLevel: 'public', fileType: 'pdf', sizeKb: 1600, version: 'v2', uploadedAt: '2026-03-05', uploadedByUserId: 'u_ahmed', downloadCount: 178 },

  /* ───────── Portal general (logged-in, pre-NDA) ───────── */
  { id: 'doc_010', name: 'Proamina TDS v3.pdf', category: 'technical_data_sheet', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 420, version: 'v3', uploadedAt: '2026-01-20', uploadedByUserId: 'u_ahmed', description: 'Technical data sheet — general grade.', downloadCount: 264 },
  { id: 'doc_011', name: 'Proamina Safety Data Sheet.pdf', category: 'safety_data_sheet', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 380, version: 'v2', uploadedAt: '2026-01-20', uploadedByUserId: 'u_ahmed', downloadCount: 240 },
  { id: 'doc_012', name: 'Application Guide — Chocolate.pdf', category: 'application_guide', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 1100, version: 'v1', uploadedAt: '2026-02-10', uploadedByUserId: 'u_ahmed', downloadCount: 96 },
  { id: 'doc_013', name: 'Application Guide — Bakery & Biscuits.pdf', category: 'application_guide', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 1180, version: 'v1', uploadedAt: '2026-02-10', uploadedByUserId: 'u_ahmed', downloadCount: 88 },
  { id: 'doc_014', name: 'Application Guide — Dairy & Yogurt.pdf', category: 'application_guide', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 1240, version: 'v1', uploadedAt: '2026-02-12', uploadedByUserId: 'u_ahmed', downloadCount: 110 },
  { id: 'doc_015', name: 'Application Guide — Ice Cream.pdf', category: 'application_guide', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 960, version: 'v1', uploadedAt: '2026-02-14', uploadedByUserId: 'u_ahmed', downloadCount: 54 },
  { id: 'doc_016', name: 'Application Guide — Beverages.pdf', category: 'application_guide', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 1010, version: 'v1', uploadedAt: '2026-02-16', uploadedByUserId: 'u_ahmed', downloadCount: 61 },
  { id: 'doc_017', name: 'Proamina FAQ for formulators.docx', category: 'other', accessLevel: 'portal_general', fileType: 'docx', sizeKb: 95, uploadedAt: '2026-03-01', uploadedByUserId: 'u_ahmed', downloadCount: 47 },

  /* ───────── Pre-NDA (qualified leads) ───────── */
  { id: 'doc_020', name: 'Proamina — Technical Overview (deck).pptx', category: 'presentation', accessLevel: 'pre_nda', fileType: 'pptx', sizeKb: 5400, version: 'v2', uploadedAt: '2026-02-20', uploadedByUserId: 'u_ahmed', downloadCount: 38 },
  { id: 'doc_021', name: 'Dosage & usage recommendations.pdf', category: 'application_guide', accessLevel: 'pre_nda', fileType: 'pdf', sizeKb: 640, version: 'v2', uploadedAt: '2026-02-22', uploadedByUserId: 'u_ahmed', downloadCount: 29 },
  { id: 'doc_022', name: 'Indicative price list 2026 (pre-NDA).pdf', category: 'price_list', accessLevel: 'pre_nda', fileType: 'pdf', sizeKb: 220, version: '2026.1', uploadedAt: '2026-01-15', uploadedByUserId: 'u_elena', downloadCount: 71 },

  /* ───────── Certificates & regulatory ───────── */
  { id: 'doc_030', name: 'Halal Certificate.pdf', category: 'certificate', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 310, version: '2026', uploadedAt: '2026-01-05', uploadedByUserId: 'u_ahmed', downloadCount: 132 },
  { id: 'doc_031', name: 'Kosher Certificate.pdf', category: 'certificate', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 290, version: '2026', uploadedAt: '2026-01-05', uploadedByUserId: 'u_ahmed', downloadCount: 88 },
  { id: 'doc_032', name: 'ISO 22000 Certificate.pdf', category: 'certificate', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 340, version: '2026', uploadedAt: '2026-01-08', uploadedByUserId: 'u_ahmed', downloadCount: 64 },
  { id: 'doc_033', name: 'Non-GMO Statement.pdf', category: 'regulatory', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 180, version: 'v1', uploadedAt: '2026-01-12', uploadedByUserId: 'u_ahmed', downloadCount: 73 },
  { id: 'doc_034', name: 'Allergen Statement.pdf', category: 'regulatory', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 160, version: 'v1', uploadedAt: '2026-01-12', uploadedByUserId: 'u_ahmed', downloadCount: 90 },
  { id: 'doc_035', name: 'Vegan Suitability Statement.pdf', category: 'regulatory', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 150, version: 'v1', uploadedAt: '2026-01-15', uploadedByUserId: 'u_ahmed', downloadCount: 58 },
  { id: 'doc_036', name: 'Certificate of Analysis — template.pdf', category: 'certificate', accessLevel: 'post_nda', fileType: 'pdf', sizeKb: 200, version: 'v2', uploadedAt: '2026-02-01', uploadedByUserId: 'u_ahmed', downloadCount: 41 },

  /* ───────── Post-NDA (advanced technical) ───────── */
  { id: 'doc_040', name: 'Proamina — Full specification sheet (post-NDA).pdf', category: 'technical_data_sheet', accessLevel: 'post_nda', fileType: 'pdf', sizeKb: 720, version: 'v3', uploadedAt: '2026-02-05', uploadedByUserId: 'u_ahmed', downloadCount: 33 },
  { id: 'doc_041', name: 'Manufacturing process overview (confidential).pdf', category: 'technical_data_sheet', accessLevel: 'post_nda', fileType: 'pdf', sizeKb: 540, version: 'v1', uploadedAt: '2026-02-08', uploadedByUserId: 'u_ahmed', downloadCount: 19 },
  { id: 'doc_042', name: 'Stability & shelf-life study summary.pdf', category: 'technical_data_sheet', accessLevel: 'post_nda', fileType: 'pdf', sizeKb: 610, version: 'v1', uploadedAt: '2026-03-10', uploadedByUserId: 'u_ahmed', downloadCount: 24 },

  /* ───────── The Protein Works — company-specific & post-NDA ───────── */
  { id: 'doc_pw_1', name: 'Proamina x The Protein Works NDA (signed).pdf', category: 'nda', accessLevel: 'company_specific', companyId: 'c_proteinworks', fileType: 'pdf', sizeKb: 240, uploadedAt: '2025-12-10', uploadedByUserId: 'u_giuseppe', downloadCount: 12 },
  { id: 'doc_pw_2', name: 'TPW — 100g pilot COA (PRO-2025-A14).pdf', category: 'certificate', accessLevel: 'company_specific', companyId: 'c_proteinworks', fileType: 'pdf', sizeKb: 190, uploadedAt: '2026-04-15', uploadedByUserId: 'u_ahmed', downloadCount: 8 },
  { id: 'doc_pw_3', name: 'TPW — reduced-sugar bar trial report.pdf', category: 'technical_data_sheet', accessLevel: 'post_nda', companyId: 'c_proteinworks', fileType: 'pdf', sizeKb: 480, version: 'v1', uploadedAt: '2026-05-30', uploadedByUserId: 'u_ahmed', downloadCount: 6 },
  { id: 'doc_pw_4', name: 'TPW — RTD shake sweetness mapping.xlsx', category: 'other', accessLevel: 'company_specific', companyId: 'c_proteinworks', fileType: 'xlsx', sizeKb: 120, uploadedAt: '2026-06-09', uploadedByUserId: 'u_ahmed', downloadCount: 4 },
  { id: 'doc_pw_5', name: 'TPW — custom dosage recommendation.pdf', category: 'application_guide', accessLevel: 'post_nda', companyId: 'c_proteinworks', fileType: 'pdf', sizeKb: 260, uploadedAt: '2026-05-12', uploadedByUserId: 'u_ahmed', downloadCount: 7 },

  /* ───────── Other company-specific NDAs / reports ───────── */
  { id: 'doc_venchi_1', name: 'Proamina x Venchi NDA (signed).pdf', category: 'nda', accessLevel: 'company_specific', companyId: 'c_venchi', fileType: 'pdf', sizeKb: 228, uploadedAt: '2026-03-20', uploadedByUserId: 'u_giuseppe', downloadCount: 9 },
  { id: 'doc_venchi_2', name: 'Reduced-sugar pralines — test report.pdf', category: 'technical_data_sheet', accessLevel: 'post_nda', companyId: 'c_venchi', fileType: 'pdf', sizeKb: 430, uploadedAt: '2026-05-18', uploadedByUserId: 'u_ahmed', downloadCount: 5 },
  { id: 'doc_venchi_3', name: 'Venchi — 6kg praline COA.pdf', category: 'certificate', accessLevel: 'company_specific', companyId: 'c_venchi', fileType: 'pdf', sizeKb: 175, uploadedAt: '2026-06-08', uploadedByUserId: 'u_ahmed', downloadCount: 2 },
  { id: 'doc_barilla_1', name: 'Barilla — protein biscuit pre-trial brief.pdf', category: 'application_guide', accessLevel: 'company_specific', companyId: 'c_barilla', fileType: 'pdf', sizeKb: 280, uploadedAt: '2026-06-04', uploadedByUserId: 'u_ahmed', downloadCount: 3 },
  { id: 'doc_galbusera_1', name: 'Proamina x Galbusera NDA (signed).pdf', category: 'nda', accessLevel: 'company_specific', companyId: 'c_galbusera', fileType: 'pdf', sizeKb: 210, uploadedAt: '2026-05-15', uploadedByUserId: 'u_giuseppe', downloadCount: 4 },
  { id: 'doc_eurosup_1', name: 'Eurosup — bar reformulation report.pdf', category: 'technical_data_sheet', accessLevel: 'post_nda', companyId: 'c_eurosup', fileType: 'pdf', sizeKb: 510, uploadedAt: '2026-03-05', uploadedByUserId: 'u_ahmed', downloadCount: 11 },
  { id: 'doc_eurosup_2', name: 'Eurosup — Q2 commercial price list.pdf', category: 'price_list', accessLevel: 'company_specific', companyId: 'c_eurosup', fileType: 'pdf', sizeKb: 140, version: '2026.2', uploadedAt: '2026-03-20', uploadedByUserId: 'u_elena', downloadCount: 9 },
  { id: 'doc_sudzucker_1', name: 'Proamina x Südzucker NDA (signed).pdf', category: 'nda', accessLevel: 'company_specific', companyId: 'c_sudzucker', fileType: 'pdf', sizeKb: 256, uploadedAt: '2026-01-10', uploadedByUserId: 'u_ludwig', downloadCount: 8 },
  { id: 'doc_sudzucker_2', name: 'Südzucker — co-development feasibility report.pdf', category: 'technical_data_sheet', accessLevel: 'post_nda', companyId: 'c_sudzucker', fileType: 'pdf', sizeKb: 690, uploadedAt: '2026-05-15', uploadedByUserId: 'u_ahmed', downloadCount: 6 },
  { id: 'doc_emmi_1', name: 'Proamina x Emmi NDA (signed).pdf', category: 'nda', accessLevel: 'company_specific', companyId: 'c_emmi', fileType: 'pdf', sizeKb: 232, uploadedAt: '2026-02-10', uploadedByUserId: 'u_ludwig', downloadCount: 5 },
  { id: 'doc_emmi_2', name: 'Emmi — protein coffee drink trial brief.pdf', category: 'application_guide', accessLevel: 'post_nda', companyId: 'c_emmi', fileType: 'pdf', sizeKb: 300, uploadedAt: '2026-06-01', uploadedByUserId: 'u_ahmed', downloadCount: 3 },
  { id: 'doc_bel_1', name: 'Proamina x Groupe Bel NDA (signed).pdf', category: 'nda', accessLevel: 'company_specific', companyId: 'c_bel', fileType: 'pdf', sizeKb: 248, uploadedAt: '2026-02-01', uploadedByUserId: 'u_ludwig', downloadCount: 7 },
  { id: 'doc_bel_2', name: 'Bel — 2kg feasibility report.pdf', category: 'technical_data_sheet', accessLevel: 'post_nda', companyId: 'c_bel', fileType: 'pdf', sizeKb: 420, uploadedAt: '2026-04-20', uploadedByUserId: 'u_ahmed', downloadCount: 4 },
  { id: 'doc_disproquima_1', name: 'Proamina x Disproquima NDA (signed).pdf', category: 'nda', accessLevel: 'company_specific', companyId: 'c_disproquima', fileType: 'pdf', sizeKb: 220, uploadedAt: '2026-02-20', uploadedByUserId: 'u_ludwig', downloadCount: 6 },
  { id: 'doc_disproquima_2', name: 'Disproquima — distribution terms (draft).docx', category: 'other', accessLevel: 'company_specific', companyId: 'c_disproquima', fileType: 'docx', sizeKb: 88, uploadedAt: '2026-06-12', uploadedByUserId: 'u_ludwig', downloadCount: 2 },
  { id: 'doc_nicks_1', name: "Nick's — low-sugar ice cream COA.pdf", category: 'certificate', accessLevel: 'company_specific', companyId: 'c_nicks', fileType: 'pdf', sizeKb: 165, uploadedAt: '2026-05-29', uploadedByUserId: 'u_ahmed', downloadCount: 3 },
  { id: 'doc_icedog_1', name: 'Icedog — gelato base trial report.pdf', category: 'technical_data_sheet', accessLevel: 'post_nda', companyId: 'c_icedog', fileType: 'pdf', sizeKb: 380, uploadedAt: '2026-05-28', uploadedByUserId: 'u_ahmed', downloadCount: 2 },
  { id: 'doc_almarai_1', name: 'Proamina x Almarai NDA (signed).pdf', category: 'nda', accessLevel: 'company_specific', companyId: 'c_almarai', fileType: 'pdf', sizeKb: 264, uploadedAt: '2026-05-12', uploadedByUserId: 'u_ludwig', downloadCount: 4 },
  { id: 'doc_almarai_2', name: 'Almarai — Halal Certificate (countersigned).pdf', category: 'certificate', accessLevel: 'company_specific', companyId: 'c_almarai', fileType: 'pdf', sizeKb: 320, uploadedAt: '2026-05-20', uploadedByUserId: 'u_ahmed', downloadCount: 3 },

  /* ───────── Internal (staff-only) ───────── */
  { id: 'doc_int_1', name: 'Proamina cost model 2026.xlsx', category: 'other', accessLevel: 'internal', fileType: 'xlsx', sizeKb: 260, version: '2026.2', uploadedAt: '2026-01-30', uploadedByUserId: 'u_elena', downloadCount: 22 },
  { id: 'doc_int_2', name: 'Master price list (internal) 2026.xlsx', category: 'price_list', accessLevel: 'internal', fileType: 'xlsx', sizeKb: 180, version: '2026.2', uploadedAt: '2026-02-02', uploadedByUserId: 'u_elena', downloadCount: 31 },
  { id: 'doc_int_3', name: 'Sample policy & quantities (SOP).pdf', category: 'other', accessLevel: 'internal', fileType: 'pdf', sizeKb: 210, version: 'v2', uploadedAt: '2026-01-18', uploadedByUserId: 'u_marco', downloadCount: 18 },
  { id: 'doc_int_4', name: 'Export & customs checklist.pdf', category: 'regulatory', accessLevel: 'internal', fileType: 'pdf', sizeKb: 240, version: 'v1', uploadedAt: '2026-02-25', uploadedByUserId: 'u_marco', downloadCount: 14 },
  { id: 'doc_int_5', name: 'NDA template (mutual) ITP-NDA-v3.docx', category: 'nda', accessLevel: 'internal', fileType: 'docx', sizeKb: 110, version: 'v3', uploadedAt: '2026-01-10', uploadedByUserId: 'u_giuseppe', downloadCount: 27 },
  { id: 'doc_int_6', name: 'Pipeline review — Q2 2026.pptx', category: 'presentation', accessLevel: 'internal', fileType: 'pptx', sizeKb: 4200, uploadedAt: '2026-04-05', uploadedByUserId: 'u_davide', downloadCount: 16 },
  { id: 'doc_int_7', name: 'Lead scoring methodology.pdf', category: 'other', accessLevel: 'internal', fileType: 'pdf', sizeKb: 130, uploadedAt: '2026-03-12', uploadedByUserId: 'u_medamine', downloadCount: 9 },
  { id: 'doc_int_8', name: 'Courier rate card 2026.xlsx', category: 'other', accessLevel: 'internal', fileType: 'xlsx', sizeKb: 95, uploadedAt: '2026-01-22', uploadedByUserId: 'u_marco', downloadCount: 11 },

  /* ───────── Extra marketing & photos ───────── */
  { id: 'doc_mk_1', name: 'Proamina — application photos (chocolate).png', category: 'photo', accessLevel: 'public', fileType: 'png', sizeKb: 1400, uploadedAt: '2026-03-20', uploadedByUserId: 'u_giuseppe', downloadCount: 67 },
  { id: 'doc_mk_2', name: 'Proamina — application photos (bakery).png', category: 'photo', accessLevel: 'public', fileType: 'png', sizeKb: 1320, uploadedAt: '2026-03-20', uploadedByUserId: 'u_giuseppe', downloadCount: 52 },
  { id: 'doc_mk_3', name: 'Proamina — trade show one-pager.pdf', category: 'marketing', accessLevel: 'public', fileType: 'pdf', sizeKb: 640, version: 'v2', uploadedAt: '2026-02-28', uploadedByUserId: 'u_giuseppe', downloadCount: 143 },
  { id: 'doc_mk_4', name: 'Proamina — nutrition & labelling guide.pdf', category: 'regulatory', accessLevel: 'portal_general', fileType: 'pdf', sizeKb: 380, version: 'v1', uploadedAt: '2026-03-15', uploadedByUserId: 'u_ahmed', downloadCount: 49 },
  { id: 'doc_mk_5', name: 'Proamina — sustainability statement.pdf', category: 'marketing', accessLevel: 'public', fileType: 'pdf', sizeKb: 420, version: 'v1', uploadedAt: '2026-04-01', uploadedByUserId: 'u_giuseppe', downloadCount: 38 },
  { id: 'doc_mk_6', name: 'Proamina — sports nutrition application note.pdf', category: 'application_guide', accessLevel: 'pre_nda', fileType: 'pdf', sizeKb: 560, version: 'v1', uploadedAt: '2026-03-22', uploadedByUserId: 'u_ahmed', downloadCount: 27 },
  { id: 'doc_mk_7', name: 'Proamina — plant-based application note.pdf', category: 'application_guide', accessLevel: 'pre_nda', fileType: 'pdf', sizeKb: 540, version: 'v1', uploadedAt: '2026-03-24', uploadedByUserId: 'u_ahmed', downloadCount: 21 },
  { id: 'doc_mk_8', name: 'Proamina — coffee & functional drinks note.pdf', category: 'application_guide', accessLevel: 'pre_nda', fileType: 'pdf', sizeKb: 520, version: 'v1', uploadedAt: '2026-03-26', uploadedByUserId: 'u_ahmed', downloadCount: 18 },
];

export function getDocuments(): DocumentRecord[] {
  return DOCUMENTS;
}
