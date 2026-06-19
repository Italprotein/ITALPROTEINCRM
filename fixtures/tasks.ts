import type { Task } from '@/lib/types';

/**
 * Mock tasks across staff. dueDate spread relative to today (2026-06-17):
 * some overdue, some due today, some upcoming. Several completed with completedAt.
 * companyId references valid companies; many tasks mirror company.nextAction.
 */
export const TASKS: Task[] = [
  /* ───────── Overdue (before 2026-06-17) ───────── */
  { id: 'tsk_001', title: 'Resolve Fabbri NDA redlines', type: 'prepare_nda', companyId: 'c_fabbri', relatedId: 'nda_fabbri', relatedType: 'nda', ownerId: 'u_giuseppe', priority: 'high', dueDate: '2026-06-16', status: 'in_progress', createdAt: '2026-06-05' },
  { id: 'tsk_002', title: 'Track ABS Food 200g shipment', type: 'logistics', companyId: 'c_absfood', relatedId: 'shp_absfood_1', relatedType: 'shipment', ownerId: 'u_marco', priority: 'medium', dueDate: '2026-06-16', status: 'in_progress', createdAt: '2026-06-07' },
  { id: 'tsk_003', title: "Request Nick's delivery confirmation", type: 'follow_up', companyId: 'c_nicks', relatedId: 'sr_nicks_1', relatedType: 'sample', ownerId: 'u_ludwig', priority: 'medium', dueDate: '2026-06-16', status: 'open', createdAt: '2026-06-05' },
  { id: 'tsk_004', title: 'Chase Al Ain Farms counter-signature', type: 'follow_up', companyId: 'c_alainfarms', relatedId: 'nda_alainfarms', relatedType: 'nda', ownerId: 'u_ludwig', priority: 'high', dueDate: '2026-06-15', status: 'open', createdAt: '2026-06-02' },
  { id: 'tsk_005', title: 'Send Funky Fat intro deck', type: 'email', companyId: 'c_funkyfat', ownerId: 'u_ludwig', priority: 'low', dueDate: '2026-06-12', status: 'open', createdAt: '2026-05-15' },
  { id: 'tsk_006', title: 'Re-engagement email to Crave Eatables', type: 'email', companyId: 'c_crave', ownerId: 'u_ludwig', priority: 'low', dueDate: '2026-06-10', status: 'blocked', createdAt: '2026-05-20', description: 'Blocked: no live contact email confirmed.' },
  { id: 'tsk_007', title: 'Invoice INV-2026-0008 overdue — chase payment', type: 'finance', companyId: 'c_eurosup', relatedId: 'fin_inv_eurosup_2', relatedType: 'invoice', ownerId: 'u_elena', priority: 'high', dueDate: '2026-06-14', status: 'in_progress', createdAt: '2026-06-01' },
  { id: 'tsk_008', title: 'Follow up Funky Veggie NDA', type: 'follow_up', companyId: 'c_funkyveggie', relatedId: 'nda_funkyveggie', relatedType: 'nda', ownerId: 'u_ludwig', priority: 'low', dueDate: '2026-06-19', status: 'open', createdAt: '2026-05-21' },

  /* ───────── Due today (2026-06-17) ───────── */
  { id: 'tsk_010', title: 'Ship 1kg to Barilla Parma R&D', type: 'prepare_sample', companyId: 'c_barilla', relatedId: 'sr_barilla_1', relatedType: 'sample', ownerId: 'u_marco', collaboratorIds: ['u_giuseppe'], priority: 'high', dueDate: '2026-06-17', status: 'in_progress', createdAt: '2026-06-13' },
  { id: 'tsk_011', title: 'Track Groupe Bel 15kg shipment', type: 'logistics', companyId: 'c_bel', relatedId: 'shp_bel_1', relatedType: 'shipment', ownerId: 'u_marco', priority: 'high', dueDate: '2026-06-17', status: 'in_progress', createdAt: '2026-06-11' },
  { id: 'tsk_012', title: 'Request Vegamore tasting feedback', type: 'follow_up', companyId: 'c_vegamore', relatedId: 'sr_vegamore_1', relatedType: 'sample', ownerId: 'u_giuseppe', priority: 'medium', dueDate: '2026-06-17', status: 'open', createdAt: '2026-06-07' },
  { id: 'tsk_013', title: 'Review Galbusera sample quantity', type: 'rnd_review', companyId: 'c_galbusera', relatedId: 'sr_galbusera_1', relatedType: 'sample', ownerId: 'u_ahmed', priority: 'medium', dueDate: '2026-06-17', status: 'open', createdAt: '2026-06-01' },

  /* ───────── Upcoming ───────── */
  { id: 'tsk_020', title: 'Confirm Venchi 6kg delivery', type: 'follow_up', companyId: 'c_venchi', relatedId: 'shp_venchi_1', relatedType: 'shipment', ownerId: 'u_giuseppe', priority: 'high', dueDate: '2026-06-18', status: 'open', createdAt: '2026-06-08' },
  { id: 'tsk_021', title: 'Lab ON to confirm NaturaSì 500g receipt', type: 'follow_up', companyId: 'c_naturasi', relatedId: 'sr_naturasi_1', relatedType: 'sample', ownerId: 'u_ludwig', priority: 'medium', dueDate: '2026-06-18', status: 'open', createdAt: '2026-06-04' },
  { id: 'tsk_022', title: 'Obtain Ehrmann shipping address', type: 'follow_up', companyId: 'c_ehrmann', relatedId: 'sr_ehrmann_1', relatedType: 'sample', ownerId: 'u_ludwig', priority: 'high', dueDate: '2026-06-18', status: 'open', createdAt: '2026-06-01' },
  { id: 'tsk_023', title: 'Redeliver Icedog 500g sample', type: 'logistics', companyId: 'c_icedog', relatedId: 'shp_icedog_2', relatedType: 'shipment', ownerId: 'u_marco', priority: 'medium', dueDate: '2026-06-18', status: 'open', createdAt: '2026-06-13' },
  { id: 'tsk_024', title: 'Follow up Foodness NDA signature', type: 'follow_up', companyId: 'c_foodness', relatedId: 'nda_foodness', relatedType: 'nda', ownerId: 'u_giuseppe', priority: 'low', dueDate: '2026-06-20', status: 'open', createdAt: '2026-05-22' },
  { id: 'tsk_025', title: 'Send 1kg follow-up sample to The Protein Works', type: 'prepare_sample', companyId: 'c_proteinworks', relatedId: 'sr_pw_3', relatedType: 'sample', ownerId: 'u_marco', collaboratorIds: ['u_ludwig', 'u_ahmed'], priority: 'high', dueDate: '2026-06-20', status: 'in_progress', createdAt: '2026-06-12' },
  { id: 'tsk_026', title: 'Prepare NDA for Layenberger', type: 'prepare_nda', companyId: 'c_layenberger', relatedId: 'nda_layenberger', relatedType: 'nda', ownerId: 'u_ludwig', priority: 'low', dueDate: '2026-06-21', status: 'open', createdAt: '2026-05-27' },
  { id: 'tsk_027', title: 'Prepare Casillo 500g sample', type: 'prepare_sample', companyId: 'c_casillo', relatedId: 'sr_casillo_1', relatedType: 'sample', ownerId: 'u_marco', priority: 'medium', dueDate: '2026-06-21', status: 'open', createdAt: '2026-06-02' },
  { id: 'tsk_028', title: 'Send NDA draft to Yoplait', type: 'prepare_nda', companyId: 'c_yoplait', relatedId: 'nda_yoplait', relatedType: 'nda', ownerId: 'u_ludwig', priority: 'medium', dueDate: '2026-06-21', status: 'open', createdAt: '2026-05-24' },
  { id: 'tsk_029', title: 'Send draft NDA to Gimoka', type: 'prepare_nda', companyId: 'c_gimoka', relatedId: 'nda_gimoka', relatedType: 'nda', ownerId: 'u_giuseppe', priority: 'low', dueDate: '2026-06-22', status: 'open', createdAt: '2026-05-18' },
  { id: 'tsk_030', title: 'Chase Ascom Gum NDA', type: 'follow_up', companyId: 'c_ascomgum', relatedId: 'nda_ascomgum', relatedType: 'nda', ownerId: 'u_ludwig', priority: 'low', dueDate: '2026-06-22', status: 'open', createdAt: '2026-05-19' },
  { id: 'tsk_031', title: 'Schedule Nutrimuscle technical call', type: 'meeting', companyId: 'c_nutrimuscle', relatedId: 'opp_nutrimuscle_1', relatedType: 'opportunity', ownerId: 'u_ahmed', collaboratorIds: ['u_ludwig'], priority: 'medium', dueDate: '2026-06-22', status: 'open', createdAt: '2026-05-29' },
  { id: 'tsk_032', title: 'Prepare mutual NDA for Colussi', type: 'prepare_nda', companyId: 'c_colussi', relatedId: 'nda_colussi', relatedType: 'nda', ownerId: 'u_giuseppe', priority: 'medium', dueDate: '2026-06-23', status: 'open', createdAt: '2026-05-26' },
  { id: 'tsk_033', title: 'Prepare NÖM 10kg sample', type: 'prepare_sample', companyId: 'c_nom', relatedId: 'sr_nom_1', relatedType: 'sample', ownerId: 'u_marco', priority: 'high', dueDate: '2026-06-23', status: 'in_progress', createdAt: '2026-06-10' },
  { id: 'tsk_034', title: 'Schedule Icedog technical call', type: 'meeting', companyId: 'c_icedog', relatedId: 'opp_icedog_1', relatedType: 'opportunity', ownerId: 'u_ahmed', priority: 'medium', dueDate: '2026-06-20', status: 'open', createdAt: '2026-06-03' },
  { id: 'tsk_035', title: 'Define Almarai sample scope', type: 'follow_up', companyId: 'c_almarai', relatedId: 'opp_almarai_1', relatedType: 'opportunity', ownerId: 'u_ludwig', priority: 'high', dueDate: '2026-06-25', status: 'open', createdAt: '2026-05-28' },
  { id: 'tsk_036', title: 'Issue Eurosup Q3 reorder quote', type: 'finance', companyId: 'c_eurosup', relatedId: 'opp_eurosup_1', relatedType: 'opportunity', ownerId: 'u_elena', collaboratorIds: ['u_giuseppe'], priority: 'high', dueDate: '2026-06-25', status: 'open', createdAt: '2026-06-12' },
  { id: 'tsk_037', title: 'Send Südzucker co-development proposal', type: 'follow_up', companyId: 'c_sudzucker', relatedId: 'opp_sudzucker_1', relatedType: 'opportunity', ownerId: 'u_ludwig', priority: 'high', dueDate: '2026-06-26', status: 'open', createdAt: '2026-06-13' },
  { id: 'tsk_038', title: 'Prepare NDA for Milaf', type: 'prepare_nda', companyId: 'c_milaf', ownerId: 'u_ludwig', priority: 'low', dueDate: '2026-06-26', status: 'open', createdAt: '2026-05-12' },
  { id: 'tsk_039', title: 'Draft Disproquima distribution terms', type: 'follow_up', companyId: 'c_disproquima', relatedId: 'opp_disproquima_1', relatedType: 'opportunity', ownerId: 'u_ludwig', priority: 'high', dueDate: '2026-06-28', status: 'open', createdAt: '2026-06-12' },
  { id: 'tsk_040', title: 'Collect Emmi lab results', type: 'rnd_review', companyId: 'c_emmi', relatedId: 'sr_emmi_1', relatedType: 'sample', ownerId: 'u_ahmed', priority: 'medium', dueDate: '2026-06-27', status: 'open', createdAt: '2026-06-09' },
  { id: 'tsk_041', title: 'Confirm Suntory London sample address', type: 'follow_up', companyId: 'c_suntory', relatedId: 'sr_suntory_1', relatedType: 'sample', ownerId: 'u_ludwig', priority: 'high', dueDate: '2026-06-20', status: 'open', createdAt: '2026-06-08' },
  { id: 'tsk_042', title: 'Discovery call with Prontofoods', type: 'call', companyId: 'c_prontofoods', ownerId: 'u_giuseppe', priority: 'low', dueDate: '2026-06-24', status: 'open', createdAt: '2026-05-28' },

  /* ───────── Completed ───────── */
  { id: 'tsk_050', title: 'Send Venchi 6kg sample', type: 'prepare_sample', companyId: 'c_venchi', relatedId: 'sr_venchi_1', relatedType: 'sample', ownerId: 'u_marco', priority: 'high', dueDate: '2026-06-08', status: 'done', completedAt: '2026-06-08', createdAt: '2026-05-24', comments: [{ byUserId: 'u_marco', body: 'Picked up by GLS; tracking shared with client.', at: '2026-06-08' }] },
  { id: 'tsk_051', title: 'Approve Casillo flour blend sample', type: 'rnd_review', companyId: 'c_casillo', relatedId: 'sr_casillo_1', relatedType: 'sample', ownerId: 'u_ahmed', priority: 'medium', dueDate: '2026-06-02', status: 'done', completedAt: '2026-06-02', createdAt: '2026-05-27' },
  { id: 'tsk_052', title: 'Log NÖM 10kg approval', type: 'rnd_review', companyId: 'c_nom', relatedId: 'sr_nom_1', relatedType: 'sample', ownerId: 'u_ahmed', priority: 'medium', dueDate: '2026-06-05', status: 'done', completedAt: '2026-06-05', createdAt: '2026-05-25' },
  { id: 'tsk_053', title: 'Confirm Emmi delivery & start testing', type: 'rnd_review', companyId: 'c_emmi', relatedId: 'sr_emmi_1', relatedType: 'sample', ownerId: 'u_ahmed', priority: 'high', dueDate: '2026-06-01', status: 'done', completedAt: '2026-06-01', createdAt: '2026-05-20' },
  { id: 'tsk_054', title: 'Sign The Protein Works NDA', type: 'prepare_nda', companyId: 'c_proteinworks', relatedId: 'nda_proteinworks', relatedType: 'nda', ownerId: 'u_giuseppe', priority: 'high', dueDate: '2025-12-10', status: 'done', completedAt: '2025-12-10', createdAt: '2025-11-25' },
  { id: 'tsk_055', title: 'Deliver Panettieri pastry cream sample', type: 'prepare_sample', companyId: 'c_panettieri', relatedId: 'sr_panettieri_1', relatedType: 'sample', ownerId: 'u_marco', priority: 'low', dueDate: '2026-06-02', status: 'done', completedAt: '2026-06-02', createdAt: '2026-05-15' },
  { id: 'tsk_056', title: 'Process Eurosup repeat order ORD-2026-0006', type: 'finance', companyId: 'c_eurosup', relatedId: 'fin_ord_eurosup_1', relatedType: 'order', ownerId: 'u_elena', priority: 'high', dueDate: '2026-03-22', status: 'done', completedAt: '2026-03-22', createdAt: '2026-03-18' },
  { id: 'tsk_057', title: 'Cancel duplicate Innofoods sample', type: 'other', companyId: 'c_innofoods', relatedId: 'sr_innofoods_2', relatedType: 'sample', ownerId: 'u_ludwig', priority: 'low', dueDate: '2026-04-18', status: 'cancelled', createdAt: '2026-04-16' },
  { id: 'tsk_058', title: 'Onboard Disproquima as distributor lead', type: 'follow_up', companyId: 'c_disproquima', ownerId: 'u_ludwig', priority: 'medium', dueDate: '2026-02-20', status: 'done', completedAt: '2026-02-20', createdAt: '2026-02-01' },
  { id: 'tsk_059', title: 'Confirm Nutrimuscle sample delivery', type: 'follow_up', companyId: 'c_nutrimuscle', relatedId: 'sr_nutrimuscle_1', relatedType: 'sample', ownerId: 'u_marco', priority: 'medium', dueDate: '2026-05-30', status: 'done', completedAt: '2026-05-31', createdAt: '2026-05-21' },
  { id: 'tsk_060', title: 'Review TPW RTD shake feedback', type: 'rnd_review', companyId: 'c_proteinworks', relatedId: 'fb_pw_1', relatedType: 'feedback', ownerId: 'u_ahmed', priority: 'high', dueDate: '2026-06-11', status: 'done', completedAt: '2026-06-11', createdAt: '2026-06-09' },
  { id: 'tsk_061', title: 'Verify Disproquima evaluation pack receipt', type: 'follow_up', companyId: 'c_disproquima', relatedId: 'sr_disproquima_1', relatedType: 'sample', ownerId: 'u_marco', priority: 'medium', dueDate: '2026-04-08', status: 'done', completedAt: '2026-04-08', createdAt: '2026-04-05' },
];

export function getTasks(): Task[] {
  return TASKS;
}
