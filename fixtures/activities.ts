import type { Activity } from '@/lib/types';

/**
 * Mock activity feed (newest-ish first within each block). Titles describe real
 * actions and reference company names. c_proteinworks has ~8 entries, several
 * visibility:'client' so they surface in the external portal timeline.
 */
export const ACTIVITIES: Activity[] = [
  /* ───────── The Protein Works (portal-visible mix) ───────── */
  { id: 'act_pw_1', type: 'registration', companyId: 'c_proteinworks', byUserId: 'u_medamine', title: 'The Protein Works portal account approved', body: 'Sofia Wade granted company-owner access.', visibility: 'client', at: '2025-11-25T09:10:00Z' },
  { id: 'act_pw_2', type: 'nda_event', companyId: 'c_proteinworks', relatedId: 'nda_proteinworks', relatedType: 'nda', byUserId: 'u_giuseppe', title: 'NDA fully signed with The Protein Works', visibility: 'client', at: '2025-12-10T14:30:00Z' },
  { id: 'act_pw_3', type: 'sample_event', companyId: 'c_proteinworks', relatedId: 'sr_pw_1', relatedType: 'sample', byUserId: 'u_marco', title: 'Sent 100g sample to The Protein Works', body: 'DHL Express, DDP to Liverpool.', visibility: 'client', at: '2026-04-15T11:00:00Z' },
  { id: 'act_pw_4', type: 'shipment_event', companyId: 'c_proteinworks', relatedId: 'shp_pw_1', relatedType: 'shipment', byUserId: 'u_marco', title: '100g sample delivered to The Protein Works', visibility: 'client', at: '2026-04-22T13:20:00Z' },
  { id: 'act_pw_5', type: 'note', companyId: 'c_proteinworks', byUserId: 'u_ahmed', title: 'Pilot bake started on reduced-sugar bar matrix', at: '2026-05-05T10:00:00Z' },
  { id: 'act_pw_6', type: 'feedback', companyId: 'c_proteinworks', relatedId: 'fb_pw_1', relatedType: 'feedback', byContactId: 'ct_pw_2', title: 'The Protein Works submitted RTD shake feedback', visibility: 'client', at: '2026-06-09T15:45:00Z' },
  { id: 'act_pw_7', type: 'technical_reply', companyId: 'c_proteinworks', relatedId: 'fb_pw_1', relatedType: 'feedback', byUserId: 'u_ahmed', title: 'Technical reply sent on RTD clarity question', visibility: 'client', at: '2026-06-11T09:30:00Z' },
  { id: 'act_pw_8', type: 'sample_event', companyId: 'c_proteinworks', relatedId: 'sr_pw_3', relatedType: 'sample', byUserId: 'u_marco', title: 'Preparing 1kg follow-up sample for The Protein Works', visibility: 'client', at: '2026-06-14T08:15:00Z' },

  /* ───────── Venchi ───────── */
  { id: 'act_venchi_1', type: 'meeting', companyId: 'c_venchi', byUserId: 'u_giuseppe', title: 'Met Venchi R&D at SIGEP Rimini', at: '2026-02-12T10:00:00Z' },
  { id: 'act_venchi_2', type: 'nda_event', companyId: 'c_venchi', relatedId: 'nda_venchi', relatedType: 'nda', byUserId: 'u_giuseppe', title: 'NDA fully signed with Venchi', at: '2026-03-20T16:00:00Z' },
  { id: 'act_venchi_3', type: 'feedback', companyId: 'c_venchi', relatedId: 'fb_venchi_1', relatedType: 'feedback', byUserId: 'u_ahmed', title: 'Positive feedback on gianduia spread feasibility', at: '2026-05-18T11:20:00Z' },
  { id: 'act_venchi_4', type: 'sample_event', companyId: 'c_venchi', relatedId: 'sr_venchi_1', relatedType: 'sample', byUserId: 'u_marco', title: 'Shipped 6kg praline sample to Venchi', at: '2026-06-08T09:00:00Z' },

  /* ───────── Barilla ───────── */
  { id: 'act_barilla_1', type: 'call', companyId: 'c_barilla', byUserId: 'u_giuseppe', title: 'Logged intro call with Barilla R&D', body: 'Snacking innovation team; protein breakfast biscuit concept.', at: '2026-03-05T14:00:00Z' },
  { id: 'act_barilla_2', type: 'nda_event', companyId: 'c_barilla', relatedId: 'nda_barilla', relatedType: 'nda', byUserId: 'u_giuseppe', title: 'NDA sent to Barilla legal', at: '2026-04-28T10:30:00Z' },
  { id: 'act_barilla_3', type: 'sample_event', companyId: 'c_barilla', relatedId: 'sr_barilla_1', relatedType: 'sample', byUserId: 'u_ahmed', title: 'Barilla 1kg biscuit sample approved', at: '2026-06-09T11:00:00Z' },
  { id: 'act_barilla_4', type: 'note', companyId: 'c_barilla', byUserId: 'u_giuseppe', title: 'Sample ready to ship pending NDA sign-off', at: '2026-06-13T15:00:00Z' },

  /* ───────── Galbusera / Colussi / Fabbri ───────── */
  { id: 'act_galbusera_1', type: 'nda_event', companyId: 'c_galbusera', relatedId: 'nda_galbusera', relatedType: 'nda', byUserId: 'u_giuseppe', title: 'NDA fully signed with Galbusera', at: '2026-05-15T10:00:00Z' },
  { id: 'act_galbusera_2', type: 'sample_event', companyId: 'c_galbusera', relatedId: 'sr_galbusera_1', relatedType: 'sample', byUserId: 'u_ahmed', title: 'Galbusera 500g sample under review', at: '2026-06-01T09:30:00Z' },
  { id: 'act_colussi_1', type: 'meeting', companyId: 'c_colussi', byUserId: 'u_giuseppe', title: 'Met Colussi at TUTTOFOOD Milano', at: '2026-05-09T11:00:00Z' },
  { id: 'act_colussi_2', type: 'company_status_change', companyId: 'c_colussi', byUserId: 'u_giuseppe', title: 'Colussi moved to Interested', at: '2026-05-26T16:00:00Z' },
  { id: 'act_fabbri_1', type: 'nda_event', companyId: 'c_fabbri', relatedId: 'nda_fabbri', relatedType: 'nda', byUserId: 'u_giuseppe', title: 'Fabbri requested NDA modifications', body: 'Governing law and term redlines.', at: '2026-04-20T13:00:00Z' },
  { id: 'act_fabbri_2', type: 'note', companyId: 'c_fabbri', byUserId: 'u_giuseppe', title: 'Topping sample held pending NDA resolution', at: '2026-06-05T10:00:00Z' },

  /* ───────── ABS Food / Casillo / Foodness ───────── */
  { id: 'act_absfood_1', type: 'sample_event', companyId: 'c_absfood', relatedId: 'sr_absfood_1', relatedType: 'sample', byUserId: 'u_marco', title: 'Shipped 200g feasibility sample to ABS Food', at: '2026-06-07T09:00:00Z' },
  { id: 'act_absfood_2', type: 'shipment_event', companyId: 'c_absfood', relatedId: 'shp_absfood_1', relatedType: 'shipment', byUserId: 'u_marco', title: 'ABS Food shipment in transit', at: '2026-06-09T08:00:00Z' },
  { id: 'act_casillo_1', type: 'sample_event', companyId: 'c_casillo', relatedId: 'sr_casillo_1', relatedType: 'sample', byUserId: 'u_ahmed', title: 'Casillo flour blend sample approved', at: '2026-06-02T10:15:00Z' },
  { id: 'act_casillo_2', type: 'email', companyId: 'c_casillo', byContactId: 'ct_casillo_1', title: 'Casillo confirmed 500g quantity by email', at: '2026-06-03T14:00:00Z' },
  { id: 'act_foodness_1', type: 'nda_event', companyId: 'c_foodness', relatedId: 'nda_foodness', relatedType: 'nda', byUserId: 'u_giuseppe', title: 'NDA sent to Foodness', at: '2026-05-10T11:00:00Z' },

  /* ───────── NaturaSì ───────── */
  { id: 'act_naturasi_1', type: 'sample_event', companyId: 'c_naturasi', relatedId: 'sr_naturasi_1', relatedType: 'sample', byUserId: 'u_marco', title: 'Shipped 500g sample to NaturaSì Lab ON', at: '2026-06-04T09:30:00Z' },
  { id: 'act_naturasi_2', type: 'note', companyId: 'c_naturasi', byUserId: 'u_ludwig', title: 'Awaiting Lab ON receipt confirmation', at: '2026-06-06T10:00:00Z' },

  /* ───────── Eurosup (customer) ───────── */
  { id: 'act_eurosup_1', type: 'order', companyId: 'c_eurosup', relatedId: 'fin_ord_eurosup_1', relatedType: 'order', byUserId: 'u_elena', title: 'Eurosup placed repeat order ORD-2026-0006', at: '2026-03-20T15:00:00Z' },
  { id: 'act_eurosup_2', type: 'invoice', companyId: 'c_eurosup', relatedId: 'fin_inv_eurosup_2', relatedType: 'invoice', byUserId: 'u_elena', title: 'Invoice INV-2026-0008 issued to Eurosup', at: '2026-04-02T10:00:00Z' },
  { id: 'act_eurosup_3', type: 'company_status_change', companyId: 'c_eurosup', byUserId: 'u_giuseppe', title: 'Eurosup confirmed as repeat customer', at: '2026-03-20T16:00:00Z' },
  { id: 'act_eurosup_4', type: 'feedback', companyId: 'c_eurosup', relatedId: 'fb_eurosup_1', relatedType: 'feedback', byUserId: 'u_ahmed', title: 'Eurosup positive bar reformulation feedback', at: '2026-03-05T11:00:00Z' },

  /* ───────── Panettieri / Vegamore / Icedog ───────── */
  { id: 'act_panettieri_1', type: 'shipment_event', companyId: 'c_panettieri', relatedId: 'shp_panettieri_1', relatedType: 'shipment', byUserId: 'u_marco', title: 'Pastry cream sample delivered to Silvio Panettieri', at: '2026-06-02T12:00:00Z' },
  { id: 'act_vegamore_1', type: 'sample_event', companyId: 'c_vegamore', relatedId: 'sr_vegamore_1', relatedType: 'sample', byUserId: 'u_ahmed', title: 'Feedback requested from Vegamore', at: '2026-06-07T10:00:00Z' },
  { id: 'act_vegamore_2', type: 'feedback', companyId: 'c_vegamore', relatedId: 'fb_vegamore_1', relatedType: 'feedback', byContactId: 'ct_vegamore_1', title: 'Vegamore submitted vegan latte feedback', at: '2026-06-07T16:30:00Z' },
  { id: 'act_icedog_1', type: 'sample_event', companyId: 'c_icedog', relatedId: 'sr_icedog_1', relatedType: 'sample', byUserId: 'u_ahmed', title: 'Icedog gelato base entered testing', at: '2026-05-28T09:00:00Z' },
  { id: 'act_icedog_2', type: 'shipment_event', companyId: 'c_icedog', relatedId: 'shp_icedog_2', relatedType: 'shipment', byUserId: 'u_marco', title: 'Icedog redelivery booked after failed attempt', at: '2026-06-13T17:00:00Z' },

  /* ───────── Südzucker ───────── */
  { id: 'act_sudzucker_1', type: 'feedback', companyId: 'c_sudzucker', relatedId: 'fb_sudzucker_1', relatedType: 'feedback', byUserId: 'u_ahmed', title: 'Südzucker co-development feasibility positive', at: '2026-05-15T14:00:00Z' },
  { id: 'act_sudzucker_2', type: 'opportunity_change', companyId: 'c_sudzucker', relatedId: 'opp_sudzucker_1', relatedType: 'opportunity', byUserId: 'u_ludwig', title: 'Südzucker moved to Commercial Discussion', at: '2026-06-02T10:00:00Z' },
  { id: 'act_sudzucker_3', type: 'sample_event', companyId: 'c_sudzucker', relatedId: 'sr_sudzucker_2', relatedType: 'sample', byUserId: 'u_marco', title: '1kg beverage follow-up shipped to Südzucker', at: '2026-06-10T09:00:00Z' },

  /* ───────── Ehrmann / Emmi / NÖM / Bel ───────── */
  { id: 'act_ehrmann_1', type: 'sample_event', companyId: 'c_ehrmann', relatedId: 'sr_ehrmann_1', relatedType: 'sample', byUserId: 'u_ahmed', title: 'Ehrmann sample needs shipping address', at: '2026-05-26T10:00:00Z' },
  { id: 'act_ehrmann_2', type: 'email', companyId: 'c_ehrmann', byUserId: 'u_ludwig', title: 'Requested goods-in address from Ehrmann R&D', at: '2026-06-01T09:00:00Z' },
  { id: 'act_emmi_1', type: 'shipment_event', companyId: 'c_emmi', relatedId: 'shp_emmi_1', relatedType: 'shipment', byUserId: 'u_marco', title: '1kg sample delivered to Emmi (CH customs cleared)', at: '2026-05-20T12:00:00Z' },
  { id: 'act_emmi_2', type: 'note', companyId: 'c_emmi', byUserId: 'u_ahmed', title: 'Emmi protein coffee testing in progress', at: '2026-06-01T10:00:00Z' },
  { id: 'act_nom_1', type: 'sample_event', companyId: 'c_nom', relatedId: 'sr_nom_1', relatedType: 'sample', byUserId: 'u_ahmed', title: 'NÖM 10kg sample approved', at: '2026-06-05T11:00:00Z' },
  { id: 'act_nom_2', type: 'note', companyId: 'c_nom', byUserId: 'u_marco', title: 'Preparing NÖM 10kg sample batch', at: '2026-06-10T09:00:00Z' },
  { id: 'act_bel_1', type: 'sample_event', companyId: 'c_bel', relatedId: 'sr_bel_1', relatedType: 'sample', byUserId: 'u_marco', title: 'Shipped 15kg R&D sample to Groupe Bel', at: '2026-06-11T09:00:00Z' },
  { id: 'act_bel_2', type: 'feedback', companyId: 'c_bel', relatedId: 'fb_bel_1', relatedType: 'feedback', byUserId: 'u_ahmed', title: 'Groupe Bel 2kg feasibility feedback received', at: '2026-04-20T14:00:00Z' },

  /* ───────── Nutrimuscle / Nick's / Disproquima ───────── */
  { id: 'act_nutrimuscle_1', type: 'shipment_event', companyId: 'c_nutrimuscle', relatedId: 'shp_nutrimuscle_1', relatedType: 'shipment', byUserId: 'u_marco', title: 'Nutrimuscle sample delivered (Brussels)', at: '2026-05-30T13:00:00Z' },
  { id: 'act_nicks_1', type: 'shipment_event', companyId: 'c_nicks', relatedId: 'shp_nicks_1', relatedType: 'shipment', byUserId: 'u_marco', title: "Nick's 100g pilot delivered (Sweden)", at: '2026-06-05T12:00:00Z' },
  { id: 'act_nicks_2', type: 'sample_event', companyId: 'c_nicks', relatedId: 'sr_nicks_2', relatedType: 'sample', byUserId: 'u_ahmed', title: "Nick's chocolate coating sample approved", at: '2026-06-13T10:00:00Z' },
  { id: 'act_disproquima_1', type: 'opportunity_change', companyId: 'c_disproquima', relatedId: 'opp_disproquima_1', relatedType: 'opportunity', byUserId: 'u_ludwig', title: 'Disproquima moved to Commercial Discussion', at: '2026-05-28T10:00:00Z' },
  { id: 'act_disproquima_2', type: 'sample_event', companyId: 'c_disproquima', relatedId: 'sr_disproquima_2', relatedType: 'sample', byUserId: 'u_marco', title: 'Disproquima demo kit shipped', at: '2026-06-08T09:00:00Z' },

  /* ───────── Almarai / Al Ain / others ───────── */
  { id: 'act_almarai_1', type: 'nda_event', companyId: 'c_almarai', relatedId: 'nda_almarai', relatedType: 'nda', byUserId: 'u_ludwig', title: 'Mutual NDA executed with Almarai', at: '2026-05-12T11:00:00Z' },
  { id: 'act_almarai_2', type: 'document', companyId: 'c_almarai', relatedId: 'doc_almarai_2', relatedType: 'document', byUserId: 'u_ahmed', title: 'Halal certificate countersigned for Almarai', at: '2026-05-20T10:00:00Z' },
  { id: 'act_alainfarms_1', type: 'nda_event', companyId: 'c_alainfarms', relatedId: 'nda_alainfarms', relatedType: 'nda', byUserId: 'u_ludwig', title: 'Awaiting Al Ain Farms counter-signature', at: '2026-05-30T15:00:00Z' },
  { id: 'act_suntory_1', type: 'note', companyId: 'c_suntory', byUserId: 'u_ludwig', title: 'Suntory London sample exchange being scheduled', at: '2026-06-08T10:00:00Z' },
  { id: 'act_milaf_1', type: 'meeting', companyId: 'c_milaf', byUserId: 'u_ludwig', title: 'Met Milaf at Gulfood', at: '2026-04-18T11:00:00Z' },
  { id: 'act_funkyveggie_1', type: 'nda_event', companyId: 'c_funkyveggie', relatedId: 'nda_funkyveggie', relatedType: 'nda', byUserId: 'u_ludwig', title: 'NDA sent to Funky Veggie', at: '2026-05-08T10:00:00Z' },
  { id: 'act_yoplait_1', type: 'company_status_change', companyId: 'c_yoplait', byUserId: 'u_ludwig', title: 'Yoplait moved to Interested', at: '2026-05-02T11:00:00Z' },
  { id: 'act_innofoods_1', type: 'sample_event', companyId: 'c_innofoods', relatedId: 'sr_innofoods_1', relatedType: 'sample', byUserId: 'u_ahmed', title: 'Innofoods bar sample under review', at: '2026-05-25T10:00:00Z' },
  { id: 'act_gimoka_1', type: 'note', companyId: 'c_gimoka', byUserId: 'u_giuseppe', title: 'Drafting NDA for Gimoka', at: '2026-05-18T09:00:00Z' },
  { id: 'act_prinova_1', type: 'nda_event', companyId: 'c_prinova', relatedId: 'nda_prinova', relatedType: 'nda', byUserId: 'u_ludwig', title: 'Prinova reviewing NDA sub-licence clause', at: '2026-04-18T13:00:00Z' },
  { id: 'act_layenberger_1', type: 'email', companyId: 'c_layenberger', byContactId: 'ct_layenberger_1', title: 'Layenberger inbound enquiry on diet protein bars', at: '2026-05-14T09:00:00Z' },
  { id: 'act_crave_1', type: 'company_status_change', companyId: 'c_crave', byUserId: 'u_ludwig', title: 'Crave Eatables marked dormant', at: '2026-01-09T10:00:00Z' },
  { id: 'act_nourishyou_1', type: 'email', companyId: 'c_nourishyou', byUserId: 'u_ludwig', title: 'Sent intro materials to Nourish You', at: '2026-05-08T11:00:00Z' },
  { id: 'act_funkyfat_1', type: 'email', companyId: 'c_funkyfat', byUserId: 'u_ludwig', title: 'Intro deck queued for Funky Fat Foods', at: '2026-05-15T10:00:00Z' },
  { id: 'act_ascomgum_1', type: 'nda_event', companyId: 'c_ascomgum', relatedId: 'nda_ascomgum', relatedType: 'nda', byUserId: 'u_ludwig', title: 'NDA sent to Ascom Gum', at: '2026-04-08T10:00:00Z' },
  { id: 'act_prontofoods_1', type: 'call', companyId: 'c_prontofoods', byUserId: 'u_giuseppe', title: 'Inbound web enquiry from Prontofoods logged', at: '2026-05-20T14:00:00Z' },
  { id: 'act_incredo_1', type: 'note', companyId: 'c_incredo', byUserId: 'u_ludwig', title: 'Qualifying Incredo co-positioning fit', at: '2026-05-10T10:00:00Z' },

  /* ───────── Cross-company / general ───────── */
  { id: 'act_gen_1', type: 'document', companyId: 'c_proteinworks', relatedId: 'doc_pw_3', relatedType: 'document', byUserId: 'u_ahmed', title: 'Uploaded reduced-sugar bar trial report (TPW)', visibility: 'internal', at: '2026-05-30T16:00:00Z' },
  { id: 'act_gen_2', type: 'document', companyId: 'c_venchi', relatedId: 'doc_venchi_2', relatedType: 'document', byUserId: 'u_ahmed', title: 'Uploaded reduced-sugar pralines test report', at: '2026-05-18T15:00:00Z' },
  { id: 'act_gen_3', type: 'quote', companyId: 'c_eurosup', relatedId: 'fin_qt_eurosup_1', relatedType: 'quote', byUserId: 'u_elena', title: 'Quote QT-2026-0004 sent to Eurosup', at: '2026-03-12T10:00:00Z' },
  { id: 'act_gen_4', type: 'payment', companyId: 'c_eurosup', relatedId: 'fin_inv_eurosup_1', relatedType: 'invoice', byUserId: 'u_elena', title: 'Payment received for INV-2026-0003 (Eurosup)', at: '2026-02-28T11:00:00Z' },
  { id: 'act_gen_5', type: 'meeting', companyId: 'c_emmi', relatedId: 'mtg_emmi_1', relatedType: 'meeting', byUserId: 'u_ludwig', title: 'Technical call held with Emmi R&D', at: '2026-05-22T13:00:00Z' },
  { id: 'act_gen_6', type: 'task', companyId: 'c_barilla', relatedId: 'tsk_010', relatedType: 'task', byUserId: 'u_marco', title: 'Task created: ship 1kg to Barilla Parma', at: '2026-06-13T09:00:00Z' },
  { id: 'act_gen_7', type: 'registration', companyId: 'c_disproquima', byUserId: 'u_medamine', title: 'Disproquima distributor profile created', at: '2026-01-31T10:00:00Z' },
  { id: 'act_gen_8', type: 'company_status_change', companyId: 'c_proteinworks', byUserId: 'u_ludwig', title: 'The Protein Works moved to Testing', visibility: 'internal', at: '2026-05-05T09:00:00Z' },
  { id: 'act_gen_9', type: 'email', companyId: 'c_proteinworks', byContactId: 'ct_pw_1', title: 'Sofia Wade requested 1kg scale-up sample', visibility: 'client', at: '2026-06-10T08:30:00Z' },
  { id: 'act_gen_10', type: 'call', companyId: 'c_sudzucker', byUserId: 'u_ludwig', title: 'Logged strategy call with Südzucker sourcing', at: '2026-06-02T14:30:00Z' },
  { id: 'act_gen_11', type: 'note', companyId: 'c_bel', byUserId: 'u_ludwig', title: 'Bel procurement copied on spec pack', at: '2026-06-11T10:00:00Z' },
  { id: 'act_gen_12', type: 'feedback', companyId: 'c_venchi', relatedId: 'fb_venchi_2', relatedType: 'feedback', byUserId: 'u_ahmed', title: 'Venchi praline feedback under review', at: '2026-06-10T11:00:00Z' },
  { id: 'act_gen_13', type: 'invoice', companyId: 'c_disproquima', relatedId: 'fin_inv_disproquima_1', relatedType: 'invoice', byUserId: 'u_elena', title: 'Pro-forma invoice issued to Disproquima', at: '2026-06-12T10:00:00Z' },
  { id: 'act_gen_14', type: 'document', companyId: 'c_sudzucker', relatedId: 'doc_sudzucker_2', relatedType: 'document', byUserId: 'u_ahmed', title: 'Uploaded Südzucker feasibility report', at: '2026-05-15T15:30:00Z' },
  { id: 'act_gen_15', type: 'opportunity_change', companyId: 'c_eurosup', relatedId: 'opp_eurosup_2', relatedType: 'opportunity', byUserId: 'u_giuseppe', title: 'Eurosup RTD shaker opp to Commercial Discussion', at: '2026-05-25T11:00:00Z' },
];

export function getActivities(): Activity[] {
  return ACTIVITIES;
}
