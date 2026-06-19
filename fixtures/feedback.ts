import type { Feedback } from '@/lib/types';

/**
 * Mock application feedback (FB-2026-####). Each references a valid companyId and
 * sampleRequestId; sensory fields filled; comments mix internal + client.
 * c_proteinworks has 2 (one resolved, one under_review). technicalOwnerId is u_ahmed.
 */
export const FEEDBACK: Feedback[] = [
  /* ───────── The Protein Works ───────── */
  {
    id: 'fb_pw_1', reference: 'FB-2026-0001', companyId: 'c_proteinworks', contactId: 'ct_pw_2',
    sampleRequestId: 'sr_pw_2', shipmentId: 'shp_pw_2', projectId: 'prj_pw_1', lotBatch: 'PRO-2026-B03',
    applicationCategory: 'beverages', productProjectName: 'RTD protein shake', testDate: '2026-06-05',
    overallResult: 'mixed', overallRating: 4,
    tasteAroma: 'Clean sweetness, no off-notes; slightly less rounded than sucrose control.',
    solubility: 'Fully soluble in cold water at target dosage.',
    processingBehaviour: 'No issues during high-shear mixing.',
    texture: 'Comparable mouthfeel to control.',
    appearanceColour: 'Slight haze at 8% protein — needs clarity check.',
    comparisonControl: 'Within acceptable range vs sucrose RTD control.',
    issuesEncountered: 'Minor haze in clear RTD format.',
    questions: 'Recommended dosage to avoid haze in clear beverages?',
    requestedSupport: 'Technical guidance on clarity.',
    preferredNextStep: 'technical_call', availabilityForCall: 'Weekdays 14:00–16:00 GMT',
    priority: 'high', status: 'under_review', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_pw_1a', byContactId: 'ct_pw_2', visibility: 'client', body: 'Great sweetness profile, just the haze question on the clear format.', at: '2026-06-09T15:45:00Z' },
      { id: 'fbc_pw_1b', byUserId: 'u_ahmed', visibility: 'internal', body: 'Haze likely protein-interaction; suggest 0.8% dosage and chelant.', at: '2026-06-10T09:00:00Z' },
      { id: 'fbc_pw_1c', byUserId: 'u_ahmed', visibility: 'client', body: 'Reply sent with dosage recommendation; happy to do a call.', at: '2026-06-11T09:30:00Z' },
    ],
    createdAt: '2026-06-09',
  },
  {
    id: 'fb_pw_2', reference: 'FB-2026-0002', companyId: 'c_proteinworks', contactId: 'ct_pw_2',
    sampleRequestId: 'sr_pw_1', shipmentId: 'shp_pw_1', projectId: 'prj_pw_1', lotBatch: 'PRO-2025-A14',
    applicationCategory: 'protein_bars', productProjectName: 'Reduced-sugar protein bar', testDate: '2026-05-02',
    overallResult: 'positive', overallRating: 5,
    tasteAroma: 'Excellent — clean, sucrose-like sweetness in the bar matrix.',
    solubility: 'N/A (dry blend).',
    processingBehaviour: 'Good binding; no crumbling during forming.',
    texture: 'Soft chew, comparable to full-sugar reference.',
    appearanceColour: 'No discolouration.',
    comparisonControl: 'Indistinguishable from sugar control in blind tasting.',
    issuesEncountered: 'None.',
    preferredNextStep: 'proceed_commercial', availabilityForCall: 'Any time',
    priority: 'medium', status: 'resolved', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_pw_2a', byContactId: 'ct_pw_2', visibility: 'client', body: 'Very pleased — moving to 1kg scale-up.', at: '2026-05-03T10:00:00Z' },
      { id: 'fbc_pw_2b', byUserId: 'u_ahmed', visibility: 'internal', body: 'Closing as resolved; scale-up sample to follow.', at: '2026-05-04T09:00:00Z' },
    ],
    createdAt: '2026-05-03',
  },

  /* ───────── Venchi ───────── */
  {
    id: 'fb_venchi_1', reference: 'FB-2026-0003', companyId: 'c_venchi', contactId: 'ct_venchi_1',
    sampleRequestId: 'sr_venchi_2', projectId: 'prj_venchi_1', lotBatch: 'PRO-2026-A15',
    applicationCategory: 'spreads', productProjectName: 'Protein gianduia', testDate: '2026-05-12',
    overallResult: 'positive', overallRating: 4,
    tasteAroma: 'Balanced sweetness; complements hazelnut.',
    solubility: 'Disperses well in fat phase.', texture: 'Smooth, no graininess.',
    appearanceColour: 'No colour change.', comparisonControl: 'Close to sugar control.',
    preferredNextStep: 'new_sample', priority: 'medium', status: 'technical_reply_sent', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_venchi_1a', byContactId: 'ct_venchi_1', visibility: 'client', body: 'Promising for the spread; want to try in pralines.', at: '2026-05-18T11:20:00Z' },
      { id: 'fbc_venchi_1b', byUserId: 'u_ahmed', visibility: 'internal', body: 'Recommend 6kg praline trial — initiated SR-2026-0004.', at: '2026-05-19T09:00:00Z' },
    ],
    createdAt: '2026-05-18',
  },
  {
    id: 'fb_venchi_2', reference: 'FB-2026-0004', companyId: 'c_venchi', contactId: 'ct_venchi_1',
    sampleRequestId: 'sr_venchi_1', projectId: 'prj_venchi_1',
    applicationCategory: 'chocolate', productProjectName: 'Reduced-sugar pralines', testDate: '2026-06-09',
    overallResult: 'inconclusive',
    tasteAroma: 'First impressions positive; full panel pending.',
    issuesEncountered: 'Awaiting full sensory panel results.',
    preferredNextStep: 'awaiting_decision', priority: 'medium', status: 'under_review', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_venchi_2a', byUserId: 'u_ahmed', visibility: 'internal', body: 'Initial notes only; panel scheduled.', at: '2026-06-10T11:00:00Z' },
    ],
    createdAt: '2026-06-10',
  },

  /* ───────── Eurosup ───────── */
  {
    id: 'fb_eurosup_1', reference: 'FB-2026-0005', companyId: 'c_eurosup', contactId: 'ct_eurosup_2',
    sampleRequestId: 'sr_eurosup_2', projectId: 'prj_eurosup_1', lotBatch: 'PRO-2025-A20',
    applicationCategory: 'protein_bars', productProjectName: 'Reformulated protein bar', testDate: '2026-03-01',
    overallResult: 'positive', overallRating: 5,
    tasteAroma: 'Clean sweetness; improved vs previous blend.',
    texture: 'Excellent chew retention over shelf life.', comparisonControl: 'Better than incumbent.',
    preferredNextStep: 'proceed_commercial', priority: 'high', status: 'resolved', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_eurosup_1a', byContactId: 'ct_eurosup_2', visibility: 'client', body: 'Approved for production; placing order.', at: '2026-03-05T11:00:00Z' },
    ],
    createdAt: '2026-03-05',
  },

  /* ───────── Südzucker ───────── */
  {
    id: 'fb_sudzucker_1', reference: 'FB-2026-0006', companyId: 'c_sudzucker', contactId: 'ct_sudzucker_1',
    sampleRequestId: 'sr_sudzucker_1', projectId: 'prj_sudzucker_1', lotBatch: 'PRO-2026-A02',
    applicationCategory: 'other', productProjectName: 'Sugar-reduction co-development', testDate: '2026-04-25',
    overallResult: 'positive', overallRating: 4,
    tasteAroma: 'Strong fit for sugar-reduction systems.',
    processingBehaviour: 'Stable across pilot conditions.', comparisonControl: 'Favourable.',
    preferredNextStep: 'proceed_commercial', priority: 'high', status: 'technical_reply_sent', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_sudzucker_1a', byContactId: 'ct_sudzucker_1', visibility: 'client', body: 'Want to explore joint positioning.', at: '2026-05-15T14:00:00Z' },
      { id: 'fbc_sudzucker_1b', byUserId: 'u_ludwig', visibility: 'internal', body: 'Moving to commercial discussion; proposal in progress.', at: '2026-06-02T10:00:00Z' },
    ],
    createdAt: '2026-05-15',
  },

  /* ───────── Bel ───────── */
  {
    id: 'fb_bel_1', reference: 'FB-2026-0007', companyId: 'c_bel', contactId: 'ct_bel_1',
    sampleRequestId: 'sr_bel_2', projectId: 'prj_bel_1', lotBatch: 'PRO-2026-A04',
    applicationCategory: 'desserts', productProjectName: 'Fruit-dairy protein snack', testDate: '2026-04-15',
    overallResult: 'mixed', overallRating: 3,
    tasteAroma: 'Good sweetness; slight aftertaste at high dosage.',
    texture: 'Acceptable.', comparisonControl: 'Slightly below sugar control on aftertaste.',
    issuesEncountered: 'Aftertaste at >1.2% dosage.', questions: 'Optimal dosage for fruit-dairy matrix?',
    preferredNextStep: 'new_sample', priority: 'high', status: 'additional_info_requested', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_bel_1a', byContactId: 'ct_bel_1', visibility: 'client', body: 'Need a larger sample to optimise dosage.', at: '2026-04-20T14:00:00Z' },
      { id: 'fbc_bel_1b', byUserId: 'u_ahmed', visibility: 'internal', body: 'Recommend 15kg scale-up — SR-2026-0019 raised.', at: '2026-05-15T09:00:00Z' },
    ],
    createdAt: '2026-04-20',
  },

  /* ───────── Vegamore ───────── */
  {
    id: 'fb_vegamore_1', reference: 'FB-2026-0008', companyId: 'c_vegamore', contactId: 'ct_vegamore_1',
    sampleRequestId: 'sr_vegamore_1', projectId: 'prj_vegamore_1',
    applicationCategory: 'plant_based', productProjectName: 'Vegan protein latte', testDate: '2026-06-05',
    overallResult: 'positive', overallRating: 4,
    tasteAroma: 'Works well with oat base.', solubility: 'Good cold/hot solubility.',
    texture: 'Creamy.', comparisonControl: 'Better than current vegan sweetener.',
    preferredNextStep: 'proceed_commercial', priority: 'low', status: 'received', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_vegamore_1a', byContactId: 'ct_vegamore_1', visibility: 'client', body: 'Customers loved the latte — keen to proceed.', at: '2026-06-07T16:30:00Z' },
    ],
    createdAt: '2026-06-07',
  },

  /* ───────── Icedog / Emmi / Nick's / Casillo / Nutrimuscle ───────── */
  {
    id: 'fb_icedog_1', reference: 'FB-2026-0009', companyId: 'c_icedog', contactId: 'ct_icedog_1',
    sampleRequestId: 'sr_icedog_1', projectId: 'prj_icedog_1', lotBatch: 'PRO-2026-A09',
    applicationCategory: 'ice_cream', productProjectName: 'Protein gelato base', testDate: '2026-05-28',
    overallResult: 'mixed', overallRating: 3,
    tasteAroma: 'Clean; needs body adjustment.', texture: 'Slightly icy — freezing point depression to tune.',
    issuesEncountered: 'Ice crystal formation at low dosage.', questions: 'Dosage to control freezing point?',
    preferredNextStep: 'technical_call', priority: 'medium', status: 'technical_call_needed', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_icedog_1a', byContactId: 'ct_icedog_1', visibility: 'client', body: 'Texture needs work; can we discuss?', at: '2026-06-01T10:00:00Z' },
      { id: 'fbc_icedog_1b', byUserId: 'u_ahmed', visibility: 'internal', body: 'Schedule technical call; propose blend tweak.', at: '2026-06-03T09:00:00Z' },
    ],
    createdAt: '2026-06-01',
  },
  {
    id: 'fb_emmi_1', reference: 'FB-2026-0010', companyId: 'c_emmi', contactId: 'ct_emmi_1',
    sampleRequestId: 'sr_emmi_1', projectId: 'prj_emmi_1', lotBatch: 'PRO-2026-A11',
    applicationCategory: 'coffee', productProjectName: 'Protein coffee drink', testDate: '2026-06-01',
    overallResult: 'positive', overallRating: 4,
    tasteAroma: 'Complements coffee; no bitterness.', solubility: 'Good in hot milk.',
    comparisonControl: 'Favourable.', preferredNextStep: 'awaiting_decision',
    priority: 'high', status: 'under_review', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_emmi_1a', byUserId: 'u_ahmed', visibility: 'internal', body: 'Awaiting Emmi lab results for full panel.', at: '2026-06-09T10:00:00Z' },
    ],
    createdAt: '2026-06-09',
  },
  {
    id: 'fb_nicks_1', reference: 'FB-2026-0011', companyId: 'c_nicks', contactId: 'ct_nicks_1',
    sampleRequestId: 'sr_nicks_1', projectId: 'prj_nicks_1', lotBatch: 'PRO-2026-A07',
    applicationCategory: 'ice_cream', productProjectName: 'Low-sugar protein ice cream', testDate: '2026-06-06',
    overallResult: 'positive', overallRating: 4,
    tasteAroma: 'Clean low-sugar profile.', texture: 'Good scoopability.',
    comparisonControl: 'Matches brand sweetness target.', preferredNextStep: 'proceed_commercial',
    priority: 'medium', status: 'received', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_nicks_1a', byContactId: 'ct_nicks_1', visibility: 'client', body: 'On brand for us; exploring chocolate coating next.', at: '2026-06-08T11:00:00Z' },
    ],
    createdAt: '2026-06-08',
  },
  {
    id: 'fb_casillo_1', reference: 'FB-2026-0012', companyId: 'c_casillo', contactId: 'ct_casillo_2',
    sampleRequestId: 'sr_casillo_2', projectId: 'prj_casillo_1', lotBatch: 'PRO-2026-A01',
    applicationCategory: 'bakery', productProjectName: 'High-protein flour screening', testDate: '2026-03-25',
    overallResult: 'positive', overallRating: 4,
    tasteAroma: 'Neutral in bakery base.', processingBehaviour: 'Good dough handling.',
    comparisonControl: 'Comparable.', preferredNextStep: 'new_sample',
    priority: 'medium', status: 'resolved', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_casillo_1a', byContactId: 'ct_casillo_2', visibility: 'client', body: 'Want a larger blend trial.', at: '2026-03-30T10:00:00Z' },
    ],
    createdAt: '2026-03-30',
  },
  {
    id: 'fb_nutrimuscle_1', reference: 'FB-2026-0013', companyId: 'c_nutrimuscle', contactId: 'ct_nutrimuscle_1',
    sampleRequestId: 'sr_nutrimuscle_1', applicationCategory: 'sports_nutrition',
    productProjectName: 'Protein shake reformulation', testDate: '2026-06-02',
    overallResult: 'mixed', overallRating: 3,
    tasteAroma: 'Good but want vanilla compatibility data.', solubility: 'Good.',
    questions: 'Compatibility with vanilla flavour system?', preferredNextStep: 'technical_call',
    priority: 'medium', status: 'additional_info_requested', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_nutrimuscle_1a', byContactId: 'ct_nutrimuscle_1', visibility: 'client', body: 'Need flavour compatibility guidance.', at: '2026-06-05T10:00:00Z' },
    ],
    createdAt: '2026-06-05',
  },

  /* ───────── Disproquima / Innofoods / Panettieri / Galbusera / Absfood / Naturasi / Barilla ───────── */
  {
    id: 'fb_disproquima_1', reference: 'FB-2026-0014', companyId: 'c_disproquima', contactId: 'ct_disproquima_2',
    sampleRequestId: 'sr_disproquima_1', applicationCategory: 'other',
    productProjectName: 'Distributor evaluation', testDate: '2026-04-08',
    overallResult: 'positive', overallRating: 5,
    tasteAroma: 'Strong portfolio fit for Iberian market.', comparisonControl: 'Competitive.',
    preferredNextStep: 'proceed_commercial', priority: 'high', status: 'resolved', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_disproquima_1a', byContactId: 'ct_disproquima_2', visibility: 'client', body: 'Ready to discuss distribution terms.', at: '2026-05-10T10:00:00Z' },
    ],
    createdAt: '2026-04-10',
  },
  {
    id: 'fb_innofoods_1', reference: 'FB-2026-0015', companyId: 'c_innofoods', contactId: 'ct_innofoods_1',
    sampleRequestId: 'sr_innofoods_1', applicationCategory: 'protein_bars',
    productProjectName: 'Functional protein bar', testDate: '2026-05-24',
    overallResult: 'inconclusive', issuesEncountered: 'Sample still under internal review.',
    preferredNextStep: 'awaiting_decision', priority: 'low', status: 'received', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_innofoods_1a', byUserId: 'u_ahmed', visibility: 'internal', body: 'Awaiting client bench results.', at: '2026-05-25T10:00:00Z' },
    ],
    createdAt: '2026-05-25',
  },
  {
    id: 'fb_panettieri_1', reference: 'FB-2026-0016', companyId: 'c_panettieri', contactId: 'ct_panettieri_1',
    sampleRequestId: 'sr_panettieri_1', applicationCategory: 'desserts',
    productProjectName: 'Protein pastry cream', testDate: '2026-06-06',
    overallResult: 'positive', overallRating: 4,
    tasteAroma: 'Lovely in pastry cream.', texture: 'Smooth, pipeable.',
    preferredNextStep: 'proceed_commercial', priority: 'low', status: 'received', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_panettieri_1a', byContactId: 'ct_panettieri_1', visibility: 'client', body: 'Customers cannot tell the difference!', at: '2026-06-08T09:00:00Z' },
    ],
    createdAt: '2026-06-08',
  },
  {
    id: 'fb_galbusera_1', reference: 'FB-2026-0017', companyId: 'c_galbusera', contactId: 'ct_galbusera_1',
    sampleRequestId: 'sr_galbusera_1', applicationCategory: 'biscuits',
    productProjectName: 'Reduced-sugar biscuit', testDate: '2026-06-01',
    overallResult: 'inconclusive', issuesEncountered: 'Quantity confirmation pending before bench trial.',
    preferredNextStep: 'awaiting_decision', priority: 'medium', status: 'received', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_galbusera_1a', byUserId: 'u_ahmed', visibility: 'internal', body: 'Confirm sample quantity with Restelli.', at: '2026-06-01T09:30:00Z' },
    ],
    createdAt: '2026-06-01',
  },
  {
    id: 'fb_absfood_1', reference: 'FB-2026-0018', companyId: 'c_absfood', contactId: 'ct_absfood_1',
    sampleRequestId: 'sr_absfood_1', applicationCategory: 'desserts',
    productProjectName: 'Functional dessert base', testDate: '2026-06-12',
    overallResult: 'inconclusive', issuesEncountered: 'Awaiting sample delivery (in transit).',
    preferredNextStep: 'awaiting_decision', priority: 'low', status: 'received', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_absfood_1a', byUserId: 'u_ahmed', visibility: 'internal', body: 'Feedback placeholder; sample arriving 16 Jun.', at: '2026-06-09T10:00:00Z' },
    ],
    createdAt: '2026-06-09',
  },
  {
    id: 'fb_naturasi_1', reference: 'FB-2026-0019', companyId: 'c_naturasi', contactId: 'ct_naturasi_2',
    sampleRequestId: 'sr_naturasi_1', applicationCategory: 'dairy',
    productProjectName: 'Private-label protein dairy', testDate: '2026-06-13',
    overallResult: 'inconclusive', issuesEncountered: 'Lab ON receipt pending.',
    preferredNextStep: 'awaiting_decision', priority: 'medium', status: 'received', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_naturasi_1a', byUserId: 'u_ludwig', visibility: 'internal', body: 'Chase Lab ON for receipt confirmation.', at: '2026-06-06T10:00:00Z' },
    ],
    createdAt: '2026-06-06',
  },
  {
    id: 'fb_bel_2', reference: 'FB-2026-0020', companyId: 'c_bel', contactId: 'ct_bel_1',
    sampleRequestId: 'sr_bel_1', projectId: 'prj_bel_1',
    applicationCategory: 'dairy', productProjectName: 'Fruit-dairy protein snack (15kg round)', testDate: '2026-06-16',
    overallResult: 'inconclusive', issuesEncountered: 'Sample in transit; trial scheduled.',
    preferredNextStep: 'awaiting_decision', priority: 'high', status: 'received', technicalOwnerId: 'u_ahmed',
    comments: [
      { id: 'fbc_bel_2a', byUserId: 'u_ahmed', visibility: 'internal', body: 'Awaiting 15kg delivery for optimisation round.', at: '2026-06-11T10:00:00Z' },
    ],
    createdAt: '2026-06-11',
  },
];

export function getFeedback(): Feedback[] {
  return FEEDBACK;
}
