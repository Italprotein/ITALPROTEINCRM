/**
 * ITALPROTEIN CRM — central status-label + badge-tone module.
 *
 * Single source of truth that turns the stable string codes from `lib/types.ts`
 * into human-readable labels and sensible badge tones. Pure TypeScript: no React,
 * no side effects. Pages call `getLabel(kind, value)` and `getTone(kind, value)`.
 *
 * Tone conventions:
 *  - success  → positive / terminal-good (signed, delivered, approved, customer, resolved, paid, positive)
 *  - info     → in-progress / active neutral
 *  - default  → plain neutral
 *  - warning  → attention / pending / waiting
 *  - danger   → bad / blocked / overdue / lost / rejected / negative
 *  - muted    → idle / unknown / not-applicable (and the universal fallback)
 */

/* ────────────────────────────── Public types ────────────────────────────── */

export type BadgeTone =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'gold'
  | 'muted';

export type LabelKind =
  | 'companyType'
  | 'relationshipStage'
  | 'pipelineStage'
  | 'firstContactChannel'
  | 'cooperationModel'
  | 'companySize'
  | 'decisionRole'
  | 'sampleStatus'
  | 'quantityUnit'
  | 'customsStatus'
  | 'incoterm'
  | 'feedbackStatus'
  | 'feedbackResult'
  | 'nextStep'
  | 'applicationCategory'
  | 'developmentStage'
  | 'testStage'
  | 'ndaStatus'
  | 'ndaType'
  | 'documentAccessLevel'
  | 'documentCategory'
  | 'paymentStatus'
  | 'financeDocKind'
  | 'activityType'
  | 'taskType'
  | 'taskStatus'
  | 'meetingType'
  | 'supportCategory'
  | 'supportStatus'
  | 'notificationType'
  | 'registrationStatus'
  | 'productStatus'
  | 'agreementStatus'
  | 'priority'
  | 'role'
  | 'workspace';

/* ────────────────────────────── humanize ────────────────────────────── */

/**
 * Fallback humanizer: `'ready_to_ship'` → `'Ready to ship'`.
 * Splits on snake / kebab / camel boundaries, lowercases, then sentence-cases.
 */
export function humanize(s?: string | null): string {
  if (!s) return '';
  const words = s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

/* ────────────────────────────── Internal helpers ────────────────────────────── */

type LabelMap = Record<string, string>;
type ToneMap = Record<string, BadgeTone>;

/* ────────────────────────────── Label maps ────────────────────────────── */

const companyTypeLabels: LabelMap = {
  distributor: 'Distributor',
  fb_manufacturer: 'F&B manufacturer',
  horeca: 'HoReCa',
  bakery_manufacturer: 'Bakery manufacturer',
  dairy_manufacturer: 'Dairy manufacturer',
  confectionery_manufacturer: 'Confectionery manufacturer',
  ingredient_company: 'Ingredient company',
  retailer: 'Retailer',
  agency: 'Agency',
  laboratory: 'Laboratory',
  consultant: 'Consultant',
  other: 'Other',
};

const relationshipStageLabels: LabelMap = {
  lead: 'Lead',
  contacted: 'Contacted',
  interested: 'Interested',
  qualified: 'Qualified',
  nda_in_progress: 'NDA in progress',
  nda_signed: 'NDA signed',
  sampling: 'Sampling',
  testing: 'Testing',
  commercial_discussion: 'Commercial discussion',
  customer: 'Customer',
  repeat_customer: 'Repeat customer',
  dormant: 'Dormant',
  lost: 'Lost',
};

const pipelineStageLabels: LabelMap = {
  lead: 'Lead',
  contacted: 'Contacted',
  interested: 'Interested',
  qualified: 'Qualified',
  nda_to_prepare: 'NDA to prepare',
  nda_sent: 'NDA sent',
  nda_negotiation: 'NDA negotiation',
  nda_signed: 'NDA signed',
  introductory_call: 'Introductory call',
  technical_call: 'Technical call',
  sample_requested: 'Sample requested',
  sample_approved: 'Sample approved',
  sample_shipped: 'Sample shipped',
  sample_delivered: 'Sample delivered',
  application_testing: 'Application testing',
  feedback_received: 'Feedback received',
  commercial_discussion: 'Commercial discussion',
  quotation: 'Quotation',
  customer: 'Customer',
  repeat_customer: 'Repeat customer',
  on_hold: 'On hold',
  inactive: 'Inactive',
  lost: 'Lost',
  disqualified: 'Disqualified',
};

const firstContactChannelLabels: LabelMap = {
  email: 'Email',
  gmail: 'Gmail',
  referral: 'Referral',
  event: 'Event',
  inbound_web: 'Inbound web',
  linkedin: 'LinkedIn',
  phone: 'Phone',
  partner: 'Partner',
  other: 'Other',
};

const cooperationModelLabels: LabelMap = {
  direct: 'Direct',
  distribution: 'Distribution',
  private_label: 'Private label',
  co_development: 'Co-development',
  agency: 'Agency',
  undecided: 'Undecided',
};

const companySizeLabels: LabelMap = {
  micro: 'Micro',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  enterprise: 'Enterprise',
};

const decisionRoleLabels: LabelMap = {
  decision_maker: 'Decision maker',
  influencer: 'Influencer',
  gatekeeper: 'Gatekeeper',
  champion: 'Champion',
  user: 'User',
  unknown: 'Unknown',
};

const sampleStatusLabels: LabelMap = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  more_info_required: 'More info required',
  approved: 'Approved',
  rejected: 'Rejected',
  preparing: 'Preparing',
  ready_to_ship: 'Ready to ship',
  shipped: 'Shipped',
  in_transit: 'In transit',
  customs_hold: 'Customs hold',
  delivery_attempted: 'Delivery attempted',
  delivered: 'Delivered',
  receipt_confirmed: 'Receipt confirmed',
  testing: 'Testing',
  feedback_requested: 'Feedback requested',
  feedback_received: 'Feedback received',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const quantityUnitLabels: LabelMap = {
  g: 'g',
  kg: 'kg',
  units: 'units',
  sachets: 'sachets',
  boxes: 'boxes',
  l: 'L',
  ml: 'mL',
};

const customsStatusLabels: LabelMap = {
  not_required: 'Not required',
  pending: 'Pending',
  in_clearance: 'In clearance',
  hold: 'Hold',
  cleared: 'Cleared',
};

const incotermLabels: LabelMap = {
  DAP: 'DAP',
  DDP: 'DDP',
  EXW: 'EXW',
  CPT: 'CPT',
  FCA: 'FCA',
  CIP: 'CIP',
};

const feedbackStatusLabels: LabelMap = {
  received: 'Received',
  under_review: 'Under review',
  additional_info_requested: 'Additional info requested',
  technical_reply_sent: 'Technical reply sent',
  technical_call_needed: 'Technical call needed',
  resolved: 'Resolved',
};

const feedbackResultLabels: LabelMap = {
  positive: 'Positive',
  mixed: 'Mixed',
  negative: 'Negative',
  inconclusive: 'Inconclusive',
};

const nextStepLabels: LabelMap = {
  new_sample: 'New sample',
  technical_call: 'Technical call',
  reformulate: 'Reformulate',
  proceed_commercial: 'Proceed to commercial',
  close: 'Close',
  awaiting_decision: 'Awaiting decision',
};

const applicationCategoryLabels: LabelMap = {
  dairy: 'Dairy',
  yogurt: 'Yogurt',
  desserts: 'Desserts',
  flavoured_milk: 'Flavoured milk',
  ice_cream: 'Ice cream',
  bakery: 'Bakery',
  biscuits: 'Biscuits',
  cakes: 'Cakes',
  croissants: 'Croissants',
  chocolate: 'Chocolate',
  protein_bars: 'Protein bars',
  beverages: 'Beverages',
  functional_drinks: 'Functional drinks',
  coffee: 'Coffee',
  spreads: 'Spreads',
  sauces: 'Sauces',
  plant_based: 'Plant-based',
  sports_nutrition: 'Sports nutrition',
  other: 'Other',
};

const developmentStageLabels: LabelMap = {
  concept: 'Concept',
  feasibility: 'Feasibility',
  prototype: 'Prototype',
  pilot: 'Pilot',
  pre_industrial: 'Pre-industrial',
  industrial: 'Industrial',
  launched: 'Launched',
  on_hold: 'On hold',
};

const testStageLabels: LabelMap = {
  not_started: 'Not started',
  lab: 'Lab',
  bench: 'Bench',
  pilot_line: 'Pilot line',
  shelf_life: 'Shelf life',
  sensory_panel: 'Sensory panel',
  completed: 'Completed',
};

const ndaStatusLabels: LabelMap = {
  not_required: 'Not required',
  to_prepare: 'To prepare',
  draft: 'Draft',
  sent: 'Sent',
  under_review: 'Under review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  awaiting_italprotein_signature: 'Awaiting ITALPROTEIN signature',
  awaiting_counterparty_signature: 'Awaiting counterparty signature',
  partially_signed: 'Partially signed',
  fully_signed: 'Fully signed',
  expired: 'Expired',
  terminated: 'Terminated',
};

const ndaTypeLabels: LabelMap = {
  mutual: 'Mutual',
  one_way_inbound: 'One-way (inbound)',
  one_way_outbound: 'One-way (outbound)',
};

const documentAccessLevelLabels: LabelMap = {
  public: 'Public',
  portal_general: 'Portal — general',
  pre_nda: 'Pre-NDA',
  post_nda: 'Post-NDA',
  company_specific: 'Company-specific',
  internal: 'Internal',
};

const documentCategoryLabels: LabelMap = {
  technical_data_sheet: 'Technical data sheet',
  safety_data_sheet: 'Safety data sheet',
  presentation: 'Presentation',
  application_guide: 'Application guide',
  price_list: 'Price list',
  nda: 'NDA',
  certificate: 'Certificate',
  regulatory: 'Regulatory',
  marketing: 'Marketing',
  photo: 'Photo',
  other: 'Other',
};

const paymentStatusLabels: LabelMap = {
  draft: 'Draft',
  pending: 'Pending',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const financeDocKindLabels: LabelMap = {
  quote: 'Quote',
  order: 'Order',
  invoice: 'Invoice',
  credit_note: 'Credit note',
};

const activityTypeLabels: LabelMap = {
  email: 'Email',
  call: 'Call',
  meeting: 'Meeting',
  note: 'Note',
  task: 'Task',
  company_status_change: 'Company status change',
  opportunity_change: 'Opportunity change',
  nda_event: 'NDA event',
  sample_event: 'Sample event',
  shipment_event: 'Shipment event',
  feedback: 'Feedback',
  technical_reply: 'Technical reply',
  document: 'Document',
  quote: 'Quote',
  order: 'Order',
  invoice: 'Invoice',
  payment: 'Payment',
  registration: 'Registration',
};

const taskTypeLabels: LabelMap = {
  follow_up: 'Follow-up',
  call: 'Call',
  email: 'Email',
  prepare_nda: 'Prepare NDA',
  prepare_sample: 'Prepare sample',
  rnd_review: 'R&D review',
  logistics: 'Logistics',
  finance: 'Finance',
  meeting: 'Meeting',
  other: 'Other',
};

const taskStatusLabels: LabelMap = {
  open: 'Open',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
};

const meetingTypeLabels: LabelMap = {
  video_call: 'Video call',
  phone_call: 'Phone call',
  on_site: 'On-site',
  event: 'Event',
  technical_call: 'Technical call',
};

const supportCategoryLabels: LabelMap = {
  technical_question: 'Technical question',
  sample_request: 'Sample request',
  logistics_issue: 'Logistics issue',
  commercial_request: 'Commercial request',
  documentation_request: 'Documentation request',
  regulatory_request: 'Regulatory request',
  meeting_request: 'Meeting request',
  account_issue: 'Account issue',
  other: 'Other',
};

const supportStatusLabels: LabelMap = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_on_client: 'Waiting on client',
  resolved: 'Resolved',
  closed: 'Closed',
};

const notificationTypeLabels: LabelMap = {
  new_registration: 'New registration',
  registration_decision: 'Registration decision',
  new_sample_request: 'New sample request',
  sample_approved: 'Sample approved',
  ready_to_ship: 'Ready to ship',
  shipment_dispatched: 'Shipment dispatched',
  customs_hold: 'Customs hold',
  delivery_delay: 'Delivery delay',
  delivery_confirmed: 'Delivery confirmed',
  feedback_requested: 'Feedback requested',
  feedback_submitted: 'Feedback submitted',
  technical_reply: 'Technical reply',
  nda_sent: 'NDA sent',
  nda_changes_requested: 'NDA changes requested',
  nda_signed: 'NDA signed',
  nda_expiring: 'NDA expiring',
  task_due: 'Task due',
  task_overdue: 'Task overdue',
  support_request: 'Support request',
  invoice_overdue: 'Invoice overdue',
};

const registrationStatusLabels: LabelMap = {
  submitted: 'Submitted',
  email_verification: 'Email verification',
  pending_approval: 'Pending approval',
  more_info_requested: 'More info requested',
  approved: 'Approved',
  rejected: 'Rejected',
};

const productStatusLabels: LabelMap = {
  in_development: 'In development',
  tested: 'Tested',
  launched: 'Launched',
  archived: 'Archived',
};

const agreementStatusLabels: LabelMap = {
  none: 'No agreement',
  draft: 'Draft',
  active: 'Active',
  expired: 'Expired',
};

const priorityLabels: LabelMap = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const roleLabels: LabelMap = {
  super_admin: 'Super admin',
  crm_admin: 'CRM admin',
  business_dev: 'Business development',
  rnd_technical: 'R&D / technical',
  logistics: 'Logistics',
  finance: 'Finance',
  management_readonly: 'Management (read-only)',
  company_owner: 'Company owner',
  company_member: 'Company member',
  company_technical: 'Company technical',
  company_logistics: 'Company logistics',
  company_finance: 'Company finance',
};

const workspaceLabels: LabelMap = {
  internal: 'Internal',
  external: 'External',
};

/* ────────────────────────────── Tone maps ────────────────────────────── */

const companyTypeTones: ToneMap = {
  distributor: 'info',
  fb_manufacturer: 'info',
  horeca: 'info',
  bakery_manufacturer: 'info',
  dairy_manufacturer: 'info',
  confectionery_manufacturer: 'info',
  ingredient_company: 'info',
  retailer: 'info',
  agency: 'secondary',
  laboratory: 'secondary',
  consultant: 'secondary',
  other: 'muted',
};

const relationshipStageTones: ToneMap = {
  lead: 'muted',
  contacted: 'default',
  interested: 'info',
  qualified: 'info',
  nda_in_progress: 'warning',
  nda_signed: 'success',
  sampling: 'info',
  testing: 'info',
  commercial_discussion: 'info',
  customer: 'success',
  repeat_customer: 'success',
  dormant: 'muted',
  lost: 'danger',
};

const pipelineStageTones: ToneMap = {
  lead: 'muted',
  contacted: 'default',
  interested: 'info',
  qualified: 'info',
  nda_to_prepare: 'warning',
  nda_sent: 'warning',
  nda_negotiation: 'warning',
  nda_signed: 'success',
  introductory_call: 'info',
  technical_call: 'info',
  sample_requested: 'info',
  sample_approved: 'success',
  sample_shipped: 'info',
  sample_delivered: 'success',
  application_testing: 'info',
  feedback_received: 'info',
  commercial_discussion: 'info',
  quotation: 'gold',
  customer: 'success',
  repeat_customer: 'success',
  on_hold: 'warning',
  inactive: 'muted',
  lost: 'danger',
  disqualified: 'danger',
};

const firstContactChannelTones: ToneMap = {
  email: 'default',
  gmail: 'default',
  referral: 'success',
  event: 'info',
  inbound_web: 'info',
  linkedin: 'info',
  phone: 'default',
  partner: 'success',
  other: 'muted',
};

const cooperationModelTones: ToneMap = {
  direct: 'info',
  distribution: 'info',
  private_label: 'info',
  co_development: 'info',
  agency: 'secondary',
  undecided: 'muted',
};

const companySizeTones: ToneMap = {
  micro: 'muted',
  small: 'default',
  medium: 'info',
  large: 'info',
  enterprise: 'gold',
};

const decisionRoleTones: ToneMap = {
  decision_maker: 'gold',
  influencer: 'info',
  gatekeeper: 'warning',
  champion: 'success',
  user: 'default',
  unknown: 'muted',
};

const sampleStatusTones: ToneMap = {
  draft: 'muted',
  submitted: 'info',
  under_review: 'info',
  more_info_required: 'warning',
  approved: 'success',
  rejected: 'danger',
  preparing: 'info',
  ready_to_ship: 'info',
  shipped: 'info',
  in_transit: 'info',
  customs_hold: 'danger',
  delivery_attempted: 'warning',
  delivered: 'success',
  receipt_confirmed: 'success',
  testing: 'info',
  feedback_requested: 'warning',
  feedback_received: 'success',
  closed: 'muted',
  cancelled: 'danger',
};

const customsStatusTones: ToneMap = {
  not_required: 'muted',
  pending: 'warning',
  in_clearance: 'info',
  hold: 'danger',
  cleared: 'success',
};

const feedbackStatusTones: ToneMap = {
  received: 'info',
  under_review: 'info',
  additional_info_requested: 'warning',
  technical_reply_sent: 'info',
  technical_call_needed: 'warning',
  resolved: 'success',
};

const feedbackResultTones: ToneMap = {
  positive: 'success',
  mixed: 'warning',
  negative: 'danger',
  inconclusive: 'muted',
};

const nextStepTones: ToneMap = {
  new_sample: 'info',
  technical_call: 'info',
  reformulate: 'warning',
  proceed_commercial: 'success',
  close: 'muted',
  awaiting_decision: 'warning',
};

const developmentStageTones: ToneMap = {
  concept: 'muted',
  feasibility: 'info',
  prototype: 'info',
  pilot: 'info',
  pre_industrial: 'info',
  industrial: 'success',
  launched: 'success',
  on_hold: 'warning',
};

const testStageTones: ToneMap = {
  not_started: 'muted',
  lab: 'info',
  bench: 'info',
  pilot_line: 'info',
  shelf_life: 'info',
  sensory_panel: 'info',
  completed: 'success',
};

const ndaStatusTones: ToneMap = {
  not_required: 'muted',
  to_prepare: 'warning',
  draft: 'muted',
  sent: 'info',
  under_review: 'info',
  changes_requested: 'warning',
  approved: 'success',
  awaiting_italprotein_signature: 'warning',
  awaiting_counterparty_signature: 'warning',
  partially_signed: 'warning',
  fully_signed: 'success',
  expired: 'danger',
  terminated: 'danger',
};

const ndaTypeTones: ToneMap = {
  mutual: 'info',
  one_way_inbound: 'default',
  one_way_outbound: 'default',
};

const documentAccessLevelTones: ToneMap = {
  public: 'success',
  portal_general: 'info',
  pre_nda: 'default',
  post_nda: 'gold',
  company_specific: 'gold',
  internal: 'danger',
};

const documentCategoryTones: ToneMap = {
  technical_data_sheet: 'info',
  safety_data_sheet: 'warning',
  presentation: 'default',
  application_guide: 'info',
  price_list: 'gold',
  nda: 'secondary',
  certificate: 'success',
  regulatory: 'warning',
  marketing: 'default',
  photo: 'muted',
  other: 'muted',
};

const paymentStatusTones: ToneMap = {
  draft: 'muted',
  pending: 'warning',
  partially_paid: 'info',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'muted',
  refunded: 'secondary',
};

const financeDocKindTones: ToneMap = {
  quote: 'info',
  order: 'gold',
  invoice: 'default',
  credit_note: 'secondary',
};

const activityTypeTones: ToneMap = {
  email: 'default',
  call: 'default',
  meeting: 'info',
  note: 'muted',
  task: 'default',
  company_status_change: 'info',
  opportunity_change: 'info',
  nda_event: 'secondary',
  sample_event: 'info',
  shipment_event: 'info',
  feedback: 'info',
  technical_reply: 'info',
  document: 'default',
  quote: 'info',
  order: 'gold',
  invoice: 'default',
  payment: 'success',
  registration: 'info',
};

const taskTypeTones: ToneMap = {
  follow_up: 'default',
  call: 'default',
  email: 'default',
  prepare_nda: 'secondary',
  prepare_sample: 'info',
  rnd_review: 'info',
  logistics: 'info',
  finance: 'default',
  meeting: 'info',
  other: 'muted',
};

const taskStatusTones: ToneMap = {
  open: 'default',
  in_progress: 'info',
  blocked: 'danger',
  done: 'success',
  cancelled: 'muted',
};

const meetingTypeTones: ToneMap = {
  video_call: 'info',
  phone_call: 'default',
  on_site: 'info',
  event: 'info',
  technical_call: 'info',
};

const supportCategoryTones: ToneMap = {
  technical_question: 'info',
  sample_request: 'info',
  logistics_issue: 'warning',
  commercial_request: 'info',
  documentation_request: 'default',
  regulatory_request: 'warning',
  meeting_request: 'info',
  account_issue: 'warning',
  other: 'muted',
};

const supportStatusTones: ToneMap = {
  open: 'default',
  in_progress: 'info',
  waiting_on_client: 'warning',
  resolved: 'success',
  closed: 'muted',
};

const notificationTypeTones: ToneMap = {
  new_registration: 'info',
  registration_decision: 'info',
  new_sample_request: 'info',
  sample_approved: 'success',
  ready_to_ship: 'info',
  shipment_dispatched: 'info',
  customs_hold: 'danger',
  delivery_delay: 'warning',
  delivery_confirmed: 'success',
  feedback_requested: 'warning',
  feedback_submitted: 'info',
  technical_reply: 'info',
  nda_sent: 'info',
  nda_changes_requested: 'warning',
  nda_signed: 'success',
  nda_expiring: 'warning',
  task_due: 'warning',
  task_overdue: 'danger',
  support_request: 'info',
  invoice_overdue: 'danger',
};

const registrationStatusTones: ToneMap = {
  submitted: 'info',
  email_verification: 'warning',
  pending_approval: 'warning',
  more_info_requested: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const productStatusTones: ToneMap = {
  in_development: 'info',
  tested: 'gold',
  launched: 'success',
  archived: 'muted',
};

const agreementStatusTones: ToneMap = {
  none: 'muted',
  draft: 'warning',
  active: 'success',
  expired: 'danger',
};

const priorityTones: ToneMap = {
  low: 'muted',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

const roleTones: ToneMap = {
  super_admin: 'gold',
  crm_admin: 'gold',
  business_dev: 'info',
  rnd_technical: 'info',
  logistics: 'info',
  finance: 'info',
  management_readonly: 'secondary',
  company_owner: 'gold',
  company_member: 'default',
  company_technical: 'info',
  company_logistics: 'info',
  company_finance: 'info',
};

const workspaceTones: ToneMap = {
  internal: 'secondary',
  external: 'info',
};

/* ────────────────────────────── Registries ────────────────────────────── */

const LABELS: Record<LabelKind, LabelMap> = {
  companyType: companyTypeLabels,
  relationshipStage: relationshipStageLabels,
  pipelineStage: pipelineStageLabels,
  firstContactChannel: firstContactChannelLabels,
  cooperationModel: cooperationModelLabels,
  companySize: companySizeLabels,
  decisionRole: decisionRoleLabels,
  sampleStatus: sampleStatusLabels,
  quantityUnit: quantityUnitLabels,
  customsStatus: customsStatusLabels,
  incoterm: incotermLabels,
  feedbackStatus: feedbackStatusLabels,
  feedbackResult: feedbackResultLabels,
  nextStep: nextStepLabels,
  applicationCategory: applicationCategoryLabels,
  developmentStage: developmentStageLabels,
  testStage: testStageLabels,
  ndaStatus: ndaStatusLabels,
  ndaType: ndaTypeLabels,
  documentAccessLevel: documentAccessLevelLabels,
  documentCategory: documentCategoryLabels,
  paymentStatus: paymentStatusLabels,
  financeDocKind: financeDocKindLabels,
  activityType: activityTypeLabels,
  taskType: taskTypeLabels,
  taskStatus: taskStatusLabels,
  meetingType: meetingTypeLabels,
  supportCategory: supportCategoryLabels,
  supportStatus: supportStatusLabels,
  notificationType: notificationTypeLabels,
  registrationStatus: registrationStatusLabels,
  productStatus: productStatusLabels,
  agreementStatus: agreementStatusLabels,
  priority: priorityLabels,
  role: roleLabels,
  workspace: workspaceLabels,
};

const TONES: Partial<Record<LabelKind, ToneMap>> = {
  companyType: companyTypeTones,
  relationshipStage: relationshipStageTones,
  pipelineStage: pipelineStageTones,
  firstContactChannel: firstContactChannelTones,
  cooperationModel: cooperationModelTones,
  companySize: companySizeTones,
  decisionRole: decisionRoleTones,
  sampleStatus: sampleStatusTones,
  customsStatus: customsStatusTones,
  feedbackStatus: feedbackStatusTones,
  feedbackResult: feedbackResultTones,
  nextStep: nextStepTones,
  developmentStage: developmentStageTones,
  testStage: testStageTones,
  ndaStatus: ndaStatusTones,
  ndaType: ndaTypeTones,
  documentAccessLevel: documentAccessLevelTones,
  documentCategory: documentCategoryTones,
  paymentStatus: paymentStatusTones,
  financeDocKind: financeDocKindTones,
  activityType: activityTypeTones,
  taskType: taskTypeTones,
  taskStatus: taskStatusTones,
  meetingType: meetingTypeTones,
  supportCategory: supportCategoryTones,
  supportStatus: supportStatusTones,
  notificationType: notificationTypeTones,
  registrationStatus: registrationStatusTones,
  productStatus: productStatusTones,
  agreementStatus: agreementStatusTones,
  priority: priorityTones,
  role: roleTones,
  workspace: workspaceTones,
  // `quantityUnit` and `incoterm` are neutral codes with no meaningful tone → fall back to 'muted'.
};

/* ────────────────────────────── Italian label maps ────────────────────────────── */

const LABELS_IT: Record<LabelKind, LabelMap> = {
  companyType: {
    distributor: 'Distributore', fb_manufacturer: 'Produttore F&B', horeca: 'HoReCa',
    bakery_manufacturer: 'Produttore da forno', dairy_manufacturer: 'Produttore lattiero-caseario',
    confectionery_manufacturer: 'Produttore dolciario', ingredient_company: 'Azienda di ingredienti',
    retailer: 'Rivenditore', agency: 'Agenzia', laboratory: 'Laboratorio', consultant: 'Consulente', other: 'Altro',
  },
  relationshipStage: {
    lead: 'Lead', contacted: 'Contattato', interested: 'Interessato', qualified: 'Qualificato',
    nda_in_progress: 'NDA in corso', nda_signed: 'NDA firmato', sampling: 'Campionatura', testing: 'Test',
    commercial_discussion: 'Trattativa commerciale', customer: 'Cliente', repeat_customer: 'Cliente abituale',
    dormant: 'Inattivo', lost: 'Perso',
  },
  pipelineStage: {
    lead: 'Lead', contacted: 'Contattato', interested: 'Interessato', qualified: 'Qualificato',
    nda_to_prepare: 'NDA da preparare', nda_sent: 'NDA inviato', nda_negotiation: 'Negoziazione NDA', nda_signed: 'NDA firmato',
    introductory_call: 'Call introduttiva', technical_call: 'Call tecnica', sample_requested: 'Campione richiesto',
    sample_approved: 'Campione approvato', sample_shipped: 'Campione spedito', sample_delivered: 'Campione consegnato',
    application_testing: 'Test applicativo', feedback_received: 'Feedback ricevuto', commercial_discussion: 'Trattativa commerciale',
    quotation: 'Preventivo', customer: 'Cliente', repeat_customer: 'Cliente abituale', on_hold: 'In sospeso',
    inactive: 'Inattivo', lost: 'Perso', disqualified: 'Squalificato',
  },
  firstContactChannel: {
    email: 'Email', gmail: 'Gmail', referral: 'Passaparola', event: 'Evento', inbound_web: 'Web inbound',
    linkedin: 'LinkedIn', phone: 'Telefono', partner: 'Partner', other: 'Altro',
  },
  cooperationModel: {
    direct: 'Diretto', distribution: 'Distribuzione', private_label: 'Private label',
    co_development: 'Co-sviluppo', agency: 'Agenzia', undecided: 'Da definire',
  },
  companySize: { micro: 'Micro', small: 'Piccola', medium: 'Media', large: 'Grande', enterprise: 'Enterprise' },
  decisionRole: {
    decision_maker: 'Decision maker', influencer: 'Influencer', gatekeeper: 'Gatekeeper',
    champion: 'Champion', user: 'Utente', unknown: 'Sconosciuto',
  },
  sampleStatus: {
    draft: 'Bozza', submitted: 'Inviato', under_review: 'In revisione', more_info_required: 'Servono più info',
    approved: 'Approvato', rejected: 'Rifiutato', preparing: 'In preparazione', ready_to_ship: 'Pronto per spedizione',
    shipped: 'Spedito', in_transit: 'In transito', customs_hold: 'Fermo in dogana', delivery_attempted: 'Tentativo di consegna',
    delivered: 'Consegnato', receipt_confirmed: 'Ricezione confermata', testing: 'In test', feedback_requested: 'Feedback richiesto',
    feedback_received: 'Feedback ricevuto', closed: 'Chiuso', cancelled: 'Annullato',
  },
  quantityUnit: { g: 'g', kg: 'kg', units: 'unità', sachets: 'bustine', boxes: 'scatole', l: 'L', ml: 'mL' },
  customsStatus: {
    not_required: 'Non richiesta', pending: 'In attesa', in_clearance: 'In sdoganamento', hold: 'Bloccata', cleared: 'Sdoganata',
  },
  incoterm: { DAP: 'DAP', DDP: 'DDP', EXW: 'EXW', CPT: 'CPT', FCA: 'FCA', CIP: 'CIP' },
  feedbackStatus: {
    received: 'Ricevuto', under_review: 'In revisione', additional_info_requested: 'Info aggiuntive richieste',
    technical_reply_sent: 'Risposta tecnica inviata', technical_call_needed: 'Call tecnica necessaria', resolved: 'Risolto',
  },
  feedbackResult: { positive: 'Positivo', mixed: 'Misto', negative: 'Negativo', inconclusive: 'Inconcludente' },
  nextStep: {
    new_sample: 'Nuovo campione', technical_call: 'Call tecnica', reformulate: 'Riformulare',
    proceed_commercial: 'Procedere al commerciale', close: 'Chiudere', awaiting_decision: 'In attesa di decisione',
  },
  applicationCategory: {
    dairy: 'Lattiero-caseario', yogurt: 'Yogurt', desserts: 'Dessert', flavoured_milk: 'Latte aromatizzato',
    ice_cream: 'Gelato', bakery: 'Prodotti da forno', biscuits: 'Biscotti', cakes: 'Torte', croissants: 'Croissant',
    chocolate: 'Cioccolato', protein_bars: 'Barrette proteiche', beverages: 'Bevande', functional_drinks: 'Bevande funzionali',
    coffee: 'Caffè', spreads: 'Creme spalmabili', sauces: 'Salse', plant_based: 'Vegetale', sports_nutrition: 'Nutrizione sportiva', other: 'Altro',
  },
  developmentStage: {
    concept: 'Concept', feasibility: 'Fattibilità', prototype: 'Prototipo', pilot: 'Pilota',
    pre_industrial: 'Pre-industriale', industrial: 'Industriale', launched: 'Lanciato', on_hold: 'In sospeso',
  },
  testStage: {
    not_started: 'Non iniziato', lab: 'Laboratorio', bench: 'Banco', pilot_line: 'Linea pilota',
    shelf_life: 'Shelf life', sensory_panel: 'Panel sensoriale', completed: 'Completato',
  },
  ndaStatus: {
    not_required: 'Non richiesto', to_prepare: 'Da preparare', draft: 'Bozza', sent: 'Inviato', under_review: 'In revisione',
    changes_requested: 'Modifiche richieste', approved: 'Approvato', awaiting_italprotein_signature: 'In attesa firma ITALPROTEIN',
    awaiting_counterparty_signature: 'In attesa firma controparte', partially_signed: 'Parzialmente firmato',
    fully_signed: 'Firmato', expired: 'Scaduto', terminated: 'Terminato',
  },
  ndaType: { mutual: 'Reciproco', one_way_inbound: 'Unilaterale (in entrata)', one_way_outbound: 'Unilaterale (in uscita)' },
  documentAccessLevel: {
    public: 'Pubblico', portal_general: 'Portale — generale', pre_nda: 'Pre-NDA', post_nda: 'Post-NDA',
    company_specific: 'Specifico azienda', internal: 'Interno',
  },
  documentCategory: {
    technical_data_sheet: 'Scheda tecnica', safety_data_sheet: 'Scheda di sicurezza', presentation: 'Presentazione',
    application_guide: 'Guida applicativa', price_list: 'Listino prezzi', nda: 'NDA', certificate: 'Certificato',
    regulatory: 'Regolatorio', marketing: 'Marketing', photo: 'Foto', other: 'Altro',
  },
  paymentStatus: {
    draft: 'Bozza', pending: 'In attesa', partially_paid: 'Parzialmente pagato', paid: 'Pagato',
    overdue: 'Scaduto', cancelled: 'Annullato', refunded: 'Rimborsato',
  },
  financeDocKind: { quote: 'Preventivo', order: 'Ordine', invoice: 'Fattura', credit_note: 'Nota di credito' },
  activityType: {
    email: 'Email', call: 'Chiamata', meeting: 'Riunione', note: 'Nota', task: 'Task',
    company_status_change: 'Cambio stato azienda', opportunity_change: 'Cambio opportunità', nda_event: 'Evento NDA',
    sample_event: 'Evento campione', shipment_event: 'Evento spedizione', feedback: 'Feedback', technical_reply: 'Risposta tecnica',
    document: 'Documento', quote: 'Preventivo', order: 'Ordine', invoice: 'Fattura', payment: 'Pagamento', registration: 'Registrazione',
  },
  taskType: {
    follow_up: 'Follow-up', call: 'Chiamata', email: 'Email', prepare_nda: 'Preparare NDA', prepare_sample: 'Preparare campione',
    rnd_review: 'Revisione R&S', logistics: 'Logistica', finance: 'Finanza', meeting: 'Riunione', other: 'Altro',
  },
  taskStatus: { open: 'Aperto', in_progress: 'In corso', blocked: 'Bloccato', done: 'Completato', cancelled: 'Annullato' },
  meetingType: {
    video_call: 'Videochiamata', phone_call: 'Telefonata', on_site: 'In sede', event: 'Evento', technical_call: 'Call tecnica',
  },
  supportCategory: {
    technical_question: 'Domanda tecnica', sample_request: 'Richiesta campione', logistics_issue: 'Problema logistico',
    commercial_request: 'Richiesta commerciale', documentation_request: 'Richiesta documentazione',
    regulatory_request: 'Richiesta regolatoria', meeting_request: 'Richiesta riunione', account_issue: 'Problema account', other: 'Altro',
  },
  supportStatus: {
    open: 'Aperto', in_progress: 'In corso', waiting_on_client: 'In attesa del cliente', resolved: 'Risolto', closed: 'Chiuso',
  },
  notificationType: {
    new_registration: 'Nuova registrazione', registration_decision: 'Decisione registrazione', new_sample_request: 'Nuova richiesta campione',
    sample_approved: 'Campione approvato', ready_to_ship: 'Pronto per spedizione', shipment_dispatched: 'Spedizione inviata',
    customs_hold: 'Fermo in dogana', delivery_delay: 'Ritardo consegna', delivery_confirmed: 'Consegna confermata',
    feedback_requested: 'Feedback richiesto', feedback_submitted: 'Feedback inviato', technical_reply: 'Risposta tecnica',
    nda_sent: 'NDA inviato', nda_changes_requested: 'Modifiche NDA richieste', nda_signed: 'NDA firmato', nda_expiring: 'NDA in scadenza',
    task_due: 'Task in scadenza', task_overdue: 'Task scaduto', support_request: 'Richiesta di supporto', invoice_overdue: 'Fattura scaduta',
  },
  registrationStatus: {
    submitted: 'Inviata', email_verification: 'Verifica email', pending_approval: 'In attesa di approvazione',
    more_info_requested: 'Info aggiuntive richieste', approved: 'Approvata', rejected: 'Rifiutata',
  },
  productStatus: { in_development: 'In sviluppo', tested: 'Testato', launched: 'Lanciato', archived: 'Archiviato' },
  agreementStatus: { none: 'Nessun accordo', draft: 'Bozza', active: 'Attivo', expired: 'Scaduto' },
  priority: { low: 'Bassa', medium: 'Media', high: 'Alta', urgent: 'Urgente' },
  role: {
    super_admin: 'Super admin', crm_admin: 'Admin CRM', business_dev: 'Sviluppo commerciale', rnd_technical: 'R&S / Tecnico',
    logistics: 'Logistica', finance: 'Finanza', management_readonly: 'Direzione (sola lettura)', company_owner: 'Titolare azienda',
    company_member: 'Membro azienda', company_technical: 'Referente tecnico', company_logistics: 'Referente logistica', company_finance: 'Referente finanza',
  },
  workspace: { internal: 'Interno', external: 'Esterno' },
};

/** Active locale for `getLabel`. Synced from next-intl by the app shells (client-side render). */
let _labelLocale: 'en' | 'it' = 'en';
export function setLabelLocale(loc?: string): void {
  _labelLocale = loc === 'it' ? 'it' : 'en';
}

/* ────────────────────────────── Public API ────────────────────────────── */

/**
 * Human label for a coded value. Falls back to `humanize(value)` when the value
 * is not in the map (or the kind has no map), so unknown codes still render nicely.
 */
export function getLabel(kind: LabelKind, value: string | undefined | null): string {
  if (value == null || value === '') return '';
  if (_labelLocale === 'it') {
    const it = LABELS_IT[kind]?.[value];
    if (it != null) return it;
  }
  return LABELS[kind]?.[value] ?? humanize(value);
}

/**
 * Sensible badge tone for a coded value. Defaults to `'muted'` when no specific
 * tone is defined for the kind/value pair.
 */
export function getTone(kind: LabelKind, value: string | undefined | null): BadgeTone {
  if (value == null || value === '') return 'muted';
  const map = TONES[kind];
  return map?.[value] ?? 'muted';
}

/* ────────────────────────────── Development-stage progress ────────────────────────────── */

/**
 * Approximate completion percentage per `developmentStage` code — the single source
 * that drives the progress bars on both the admin and portal projects pages. Keyed by
 * string so this module stays dependency-free; unknown codes fall back to 0.
 */
const developmentStageProgress: Record<string, number> = {
  concept: 10,
  feasibility: 25,
  prototype: 45,
  pilot: 60,
  pre_industrial: 80,
  industrial: 92,
  launched: 100,
  on_hold: 50,
};

/** Completion % for a development stage (0 when unknown/empty). */
export function getStageProgress(stage: string | undefined | null): number {
  if (!stage) return 0;
  return developmentStageProgress[stage] ?? 0;
}
