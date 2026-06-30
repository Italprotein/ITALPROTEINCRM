/**
 * ITALPROTEIN CRM — domain model.
 *
 * Single source of truth for every record type, status taxonomy and enum used
 * across the prototype. Mock services return these shapes today; the real
 * backend must return the same shapes so the UI does not change.
 *
 * Status values are stored as stable string codes (e.g. `ready_to_ship`); human
 * labels come from i18n message keys, never from these unions directly.
 */

/* ────────────────────────────── Primitives ────────────────────────────── */

export type ID = string;
export type ISODate = string; // 'YYYY-MM-DD' or full ISO timestamp
export type Locale = 'en' | 'it';
export type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

/* ────────────────────────────── Roles ────────────────────────────── */

export type InternalRole =
  | 'super_admin'
  | 'crm_admin'
  | 'business_dev'
  | 'rnd_technical'
  | 'logistics'
  | 'finance'
  | 'management_readonly';

export type ExternalRole =
  | 'company_owner'
  | 'company_member'
  | 'company_technical'
  | 'company_logistics'
  | 'company_finance';

export type Role = InternalRole | ExternalRole;
export type Workspace = 'internal' | 'external';

/* ────────────────────────────── Users / accounts ────────────────────────────── */

export interface UserAccount {
  id: ID;
  workspace: Workspace;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  /** External accounts are scoped to a single company. */
  companyId?: ID;
  avatarColor?: string;
  /** Short blurb shown on the account picker. */
  blurb: string;
}

export interface UserSession {
  accountId: ID;
  role: Role;
  workspace: Workspace;
  companyId?: ID;
  startedAt: ISODate;
}

/* ────────────────────────────── Companies ────────────────────────────── */

export type CompanyType =
  | 'distributor'
  | 'fb_manufacturer'
  | 'horeca'
  | 'bakery_manufacturer'
  | 'dairy_manufacturer'
  | 'confectionery_manufacturer'
  | 'ingredient_company'
  | 'retailer'
  | 'agency'
  | 'laboratory'
  | 'consultant'
  | 'other';

export type RelationshipStage =
  | 'lead'
  | 'contacted'
  | 'interested'
  | 'qualified'
  | 'nda_in_progress'
  | 'nda_signed'
  | 'sampling'
  | 'testing'
  | 'commercial_discussion'
  | 'customer'
  | 'repeat_customer'
  | 'dormant'
  | 'lost';

export type FirstContactChannel =
  | 'email'
  | 'gmail'
  | 'referral'
  | 'event'
  | 'inbound_web'
  | 'linkedin'
  | 'phone'
  | 'partner'
  | 'other';

export type CooperationModel =
  | 'direct'
  | 'distribution'
  | 'private_label'
  | 'co_development'
  | 'agency'
  | 'undecided';

export type CompanySize = 'micro' | 'small' | 'medium' | 'large' | 'enterprise';

export interface Address {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
  lat?: number;
  lng?: number;
}

export interface FirstContact {
  date: ISODate;
  channel: FirstContactChannel;
  personName?: string;
  note?: string;
}

export interface Company {
  id: ID;
  legalName: string;
  tradingName?: string;
  aliases?: string[];
  type: CompanyType;
  subtype?: string;
  description?: string;
  website?: string;
  linkedin?: string;
  vatNumber?: string;
  registrationNumber?: string;
  logoUrl?: string;
  /** Brand initials fallback when no logo. */
  initials: string;
  accentColor?: string;

  headquarters: Address;
  additionalLocations?: Address[];
  billingAddress?: Address;
  shippingAddresses?: Address[];

  country: string;
  countryCode: string;
  city: string;
  region?: string;
  timezone?: string;

  preferredLanguage: Locale;
  preferredCurrency: Currency;
  size?: CompanySize;
  marketsServed?: string[];
  mainActivity?: string;

  leadSource?: FirstContactChannel;
  firstContact: FirstContact;

  accountOwnerId: ID;
  supportingTeamIds?: ID[];

  territory?: string;
  distributionMarkets?: string[];
  cooperationModel?: CooperationModel;

  relationshipStage: RelationshipStage;
  leadScore?: number; // 0-100
  probability?: number; // 0-100
  priority: Priority;

  ndaStatus: NDAStatus;
  latestSampleStatus?: SampleStatus;

  productCategories?: ApplicationCategory[];
  applicationInterests?: string[];
  estimatedAnnualPotential?: number; // in preferredCurrency
  opportunityValue?: number;

  commercialNotes?: string;
  logisticsRequirements?: string;
  preferredCourier?: string;
  deliveryInstructions?: string;
  customsInfo?: string;
  paymentTerms?: string;

  tags?: string[];
  lastActivityAt?: ISODate;
  nextAction?: { label: string; dueDate?: ISODate };
  createdAt: ISODate;
}

/* ────────────────────────────── Contacts ────────────────────────────── */

export type DecisionRole = 'decision_maker' | 'influencer' | 'gatekeeper' | 'champion' | 'user' | 'unknown';

export interface Contact {
  id: ID;
  companyId: ID;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  department?: string;
  businessRole?: string;
  decisionRole?: DecisionRole;

  email: string;
  secondaryEmail?: string;
  phone?: string;
  mobile?: string;
  whatsapp?: string;
  linkedin?: string;

  country?: string;
  countryCode?: string;
  timezone?: string;
  preferredLanguage?: Locale;

  isPrimary?: boolean;
  isTechnical?: boolean;
  isCommercial?: boolean;
  isLegal?: boolean;
  isLogistics?: boolean;
  isFinance?: boolean;

  communicationPreferences?: string[];
  lastContactAt?: ISODate;
  nextAction?: { label: string; dueDate?: ISODate };
  ownerId?: ID;
  notes?: string;
  /** External portal account linked to this contact, if any. */
  portalAccountId?: ID;
  createdAt: ISODate;
}

/* ────────────────────────────── Pipeline / Opportunities ────────────────────────────── */

export type PipelineStage =
  | 'lead'
  | 'contacted'
  | 'interested'
  | 'qualified'
  | 'nda_to_prepare'
  | 'nda_sent'
  | 'nda_negotiation'
  | 'nda_signed'
  | 'introductory_call'
  | 'technical_call'
  | 'sample_requested'
  | 'sample_approved'
  | 'sample_shipped'
  | 'sample_delivered'
  | 'application_testing'
  | 'feedback_received'
  | 'commercial_discussion'
  | 'quotation'
  | 'customer'
  | 'repeat_customer'
  // paused / terminal
  | 'on_hold'
  | 'inactive'
  | 'lost'
  | 'disqualified';

export interface StageHistoryEntry {
  stage: PipelineStage;
  enteredAt: ISODate;
  byUserId?: ID;
  note?: string;
}

export interface Opportunity {
  id: ID;
  companyId: ID;
  title: string;
  stage: PipelineStage;
  expectedValue?: number;
  currency: Currency;
  probability?: number; // 0-100
  expectedCloseDate?: ISODate;
  nextAction?: { label: string; dueDate?: ISODate };
  ownerId: ID;
  applicationCategory?: ApplicationCategory;
  productInterest?: string;
  lossReason?: string;
  competitorNotes?: string;
  stageHistory: StageHistoryEntry[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ────────────────────────────── Samples ────────────────────────────── */

export type SampleStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'more_info_required'
  | 'approved'
  | 'rejected'
  | 'preparing'
  | 'ready_to_ship'
  | 'shipped'
  | 'in_transit'
  | 'customs_hold'
  | 'delivery_attempted'
  | 'delivered'
  | 'receipt_confirmed'
  | 'testing'
  | 'feedback_requested'
  | 'feedback_received'
  | 'closed'
  | 'cancelled';

export type QuantityUnit = 'g' | 'kg' | 'units' | 'sachets' | 'boxes' | 'l' | 'ml';

export interface SampleStatusEvent {
  status: SampleStatus;
  at: ISODate;
  byUserId?: ID;
  note?: string;
}

export interface SampleRequest {
  id: ID;
  reference: string; // e.g. SR-2026-0142
  companyId: ID;
  contactId?: ID;
  opportunityId?: ID;
  projectId?: ID;

  applicationCategory: ApplicationCategory;
  requestedProduct: string;
  testObjective?: string;
  requestedQuantity: number;
  approvedQuantity?: number;
  unit: QuantityUnit;
  lotBatch?: string;
  packagingType?: string;

  requestDate: ISODate;
  approvalDate?: ISODate;
  requestedDeliveryDate?: ISODate;

  priority: Priority;
  assignedLogisticsId?: ID;
  accountOwnerId?: ID;

  internalInstructions?: string;
  clientVisibleNotes?: string;
  customsNotes?: string;
  requiredDocuments?: string[];
  attachments?: AttachmentRef[];

  deliveryAddress?: Address;
  recipient?: string;
  recipientPhone?: string;
  recipientEmail?: string;

  status: SampleStatus;
  statusHistory: SampleStatusEvent[];
  shipmentId?: ID;
  createdAt: ISODate;
}

/* ────────────────────────────── Shipments ────────────────────────────── */

export type CustomsStatus =
  | 'not_required'
  | 'pending'
  | 'in_clearance'
  | 'hold'
  | 'cleared';

export type Incoterm = 'DAP' | 'DDP' | 'EXW' | 'CPT' | 'FCA' | 'CIP';

export interface Shipment {
  id: ID;
  reference: string; // e.g. SHP-2026-0098
  sampleRequestId: ID;
  companyId: ID;

  senderLocation: string;
  recipient: string;
  address: Address;
  phone?: string;
  email?: string;

  courier?: string;
  service?: string;
  trackingNumber?: string;
  trackingUrl?: string;

  shipmentDate?: ISODate;
  estimatedDelivery?: ISODate;
  actualDelivery?: ISODate;

  packageCount?: number;
  weightKg?: number;
  dimensions?: string;
  shippingCost?: number;
  currency?: Currency;

  customsStatus?: CustomsStatus;
  incoterm?: Incoterm;
  eoriImportInfo?: string;
  customsDocuments?: AttachmentRef[];
  proofOfDelivery?: AttachmentRef;

  deliveryIssue?: string;
  isDelayed?: boolean;
  internalNotes?: string;
  clientVisibleNotes?: string;
  createdAt: ISODate;
}

/* ────────────────────────────── Feedback ────────────────────────────── */

export type FeedbackStatus =
  | 'received'
  | 'under_review'
  | 'additional_info_requested'
  | 'technical_reply_sent'
  | 'technical_call_needed'
  | 'resolved';

export type FeedbackResult = 'positive' | 'mixed' | 'negative' | 'inconclusive';
export type NextStep = 'new_sample' | 'technical_call' | 'reformulate' | 'proceed_commercial' | 'close' | 'awaiting_decision';

export interface FeedbackComment {
  id: ID;
  byUserId?: ID;
  byContactId?: ID;
  visibility: 'internal' | 'client';
  body: string;
  at: ISODate;
}

export interface Feedback {
  id: ID;
  reference: string; // FB-2026-0033
  companyId: ID;
  contactId?: ID;
  sampleRequestId?: ID;
  shipmentId?: ID;
  projectId?: ID;
  lotBatch?: string;

  applicationCategory: ApplicationCategory;
  productProjectName?: string;
  testDate?: ISODate;

  overallResult?: FeedbackResult;
  overallRating?: number; // 1-5

  tasteAroma?: string;
  solubility?: string;
  processingBehaviour?: string;
  texture?: string;
  appearanceColour?: string;
  comparisonControl?: string;
  issuesEncountered?: string;
  questions?: string;
  requestedSupport?: string;
  preferredNextStep?: NextStep;
  availabilityForCall?: string;
  attachments?: AttachmentRef[];

  priority: Priority;
  status: FeedbackStatus;
  technicalOwnerId?: ID;
  comments: FeedbackComment[];
  createdAt: ISODate;
}

/* ────────────────────────────── Application Projects & Products ────────────────────────────── */

export type ApplicationCategory =
  | 'dairy'
  | 'yogurt'
  | 'desserts'
  | 'flavoured_milk'
  | 'ice_cream'
  | 'bakery'
  | 'biscuits'
  | 'cakes'
  | 'croissants'
  | 'chocolate'
  | 'protein_bars'
  | 'beverages'
  | 'functional_drinks'
  | 'coffee'
  | 'spreads'
  | 'sauces'
  | 'plant_based'
  | 'sports_nutrition'
  | 'other';

export type DevelopmentStage =
  | 'concept'
  | 'feasibility'
  | 'prototype'
  | 'pilot'
  | 'pre_industrial'
  | 'industrial'
  | 'launched'
  | 'on_hold';

export type TestStage = 'not_started' | 'lab' | 'bench' | 'pilot_line' | 'shelf_life' | 'sensory_panel' | 'completed';

export interface ApplicationProject {
  id: ID;
  companyId: ID;
  name: string;
  clientProjectCode?: string;
  productName?: string;
  brandName?: string;
  category: ApplicationCategory;
  subcategory?: string;
  market?: string;
  objective?: string;
  developmentStage: DevelopmentStage;
  testStage?: TestStage;
  sampleRequestId?: ID;
  lotBatch?: string;
  testRounds?: number;
  currentResult?: FeedbackResult;
  estimatedLaunch?: ISODate;
  estimatedAnnualVolume?: number;
  commercialPotential?: number;
  contactIds?: ID[];
  internalOwnerId?: ID;
  technicalOwnerId?: ID;
  nextAction?: { label: string; dueDate?: ISODate };
  attachments?: AttachmentRef[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Product {
  id: ID;
  name: string;
  category: ApplicationCategory;
  companyId?: ID; // client product developed with Proamina
  brandName?: string;
  market?: string;
  proaminaDosage?: string;
  status: 'in_development' | 'tested' | 'launched' | 'archived';
  description?: string;
  imageUrl?: string;
  relatedProjectId?: ID;
  createdAt: ISODate;
}

/* ────────────────────────────── NDAs & Documents ────────────────────────────── */

export type NDAStatus =
  | 'not_required'
  | 'to_prepare'
  | 'draft'
  | 'sent'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'awaiting_italprotein_signature'
  | 'awaiting_counterparty_signature'
  | 'partially_signed'
  | 'fully_signed'
  | 'expired'
  | 'terminated';

export type NDAType = 'mutual' | 'one_way_inbound' | 'one_way_outbound';

export interface NDAVersion {
  version: string;
  date: ISODate;
  note?: string;
  fileRef?: AttachmentRef;
}

export interface NDA {
  id: ID;
  reference: string;
  companyId: ID;
  type: NDAType;
  templateVersion?: string;
  datePrepared?: ISODate;
  dateSent?: ISODate;
  status: NDAStatus;
  internalSignatory?: string;
  externalSignatory?: string;
  requestedModifications?: string;
  effectiveDate?: ISODate;
  expiryDate?: ISODate;
  governingLaw?: string;
  jurisdiction?: string;
  permittedAffiliates?: string;
  permittedSubDistributors?: string;
  reminderDates?: ISODate[];
  versions: NDAVersion[];
  signedFiles?: AttachmentRef[];
  amendmentFiles?: AttachmentRef[];
  accessLevelUnlocked?: DocumentAccessLevel;
  createdAt: ISODate;
}

export type DocumentAccessLevel =
  | 'public'
  | 'portal_general'
  | 'pre_nda'
  | 'post_nda'
  | 'company_specific'
  | 'internal';

export type DocumentCategory =
  | 'technical_data_sheet'
  | 'safety_data_sheet'
  | 'presentation'
  | 'application_guide'
  | 'price_list'
  | 'nda'
  | 'certificate'
  | 'regulatory'
  | 'marketing'
  | 'photo'
  | 'other';

export interface DocumentRecord {
  id: ID;
  name: string;
  category: DocumentCategory;
  accessLevel: DocumentAccessLevel;
  companyId?: ID; // for company-specific docs
  version?: string;
  fileType: string; // pdf, docx, pptx, xlsx, png…
  sizeKb?: number;
  uploadedAt: ISODate;
  uploadedByUserId?: ID;
  description?: string;
  downloadCount?: number;
}

export interface AttachmentRef {
  id: ID;
  name: string;
  fileType: string;
  sizeKb?: number;
  uploadedAt?: ISODate;
}

/* ────────────────────────────── Finance ────────────────────────────── */

export type PaymentStatus =
  | 'draft'
  | 'pending'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'refunded';

export type FinanceDocKind = 'quote' | 'order' | 'invoice' | 'credit_note';

export interface LineItem {
  id: ID;
  productName: string;
  quantity: number;
  unit: QuantityUnit;
  pricePerUnit: number;
  pricePerKg?: number;
  discountPct?: number;
  vatPct?: number;
}

export interface FinanceDocument {
  id: ID;
  kind: FinanceDocKind;
  reference: string; // QT-/ORD-/INV-/CN-
  companyId: ID;
  currency: Currency;
  issueDate: ISODate;
  dueDate?: ISODate;
  lineItems: LineItem[];
  subtotal: number;
  discountTotal?: number;
  vatTotal?: number;
  shippingCost?: number;
  total: number;
  paymentTerms?: string;
  paymentStatus: PaymentStatus;
  paidAmount?: number;
  outstandingAmount?: number;
  overdueAmount?: number;
  relatedQuoteId?: ID;
  relatedOrderId?: ID;
  notes?: string;
  createdAt: ISODate;
}

export interface PriceListEntry {
  id: ID;
  segment: 'horeca' | 'bakery' | 'export' | 'ecommerce' | 'distributor';
  productName: string;
  unit: QuantityUnit;
  price: number;
  currency: Currency;
  marginPct?: number;
  note?: string;
}

/* ────────────────────────────── Activities, Tasks, Meetings ────────────────────────────── */

export type ActivityType =
  | 'email'
  | 'call'
  | 'meeting'
  | 'note'
  | 'task'
  | 'company_status_change'
  | 'opportunity_change'
  | 'nda_event'
  | 'sample_event'
  | 'shipment_event'
  | 'feedback'
  | 'technical_reply'
  | 'document'
  | 'quote'
  | 'order'
  | 'invoice'
  | 'payment'
  | 'registration';

export interface Activity {
  id: ID;
  type: ActivityType;
  companyId?: ID;
  contactId?: ID;
  relatedId?: ID; // sample/shipment/nda/etc.
  relatedType?: string;
  title: string;
  body?: string;
  byUserId?: ID;
  byContactId?: ID;
  visibility?: 'internal' | 'client';
  at: ISODate;
}

export type TaskType = 'follow_up' | 'call' | 'email' | 'prepare_nda' | 'prepare_sample' | 'rnd_review' | 'logistics' | 'finance' | 'meeting' | 'other';
export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

export interface Task {
  id: ID;
  title: string;
  description?: string;
  type: TaskType;
  companyId?: ID;
  contactId?: ID;
  relatedId?: ID;
  relatedType?: string;
  ownerId: ID;
  collaboratorIds?: ID[];
  priority: Priority;
  dueDate?: ISODate;
  reminderDate?: ISODate;
  status: TaskStatus;
  comments?: { byUserId: ID; body: string; at: ISODate }[];
  completedAt?: ISODate;
  createdAt: ISODate;
}

export type MeetingType = 'video_call' | 'phone_call' | 'on_site' | 'event' | 'technical_call';

export interface Meeting {
  id: ID;
  title: string;
  type: MeetingType;
  companyId?: ID;
  contactIds?: ID[];
  ownerId: ID;
  start: ISODate;
  end?: ISODate;
  location?: string;
  agenda?: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  createdAt: ISODate;
}

/* ────────────────────────────── Requests & Support ────────────────────────────── */

export type SupportCategory =
  | 'technical_question'
  | 'sample_request'
  | 'logistics_issue'
  | 'commercial_request'
  | 'documentation_request'
  | 'regulatory_request'
  | 'meeting_request'
  | 'account_issue'
  | 'other';

export type SupportStatus = 'open' | 'acknowledged' | 'in_progress' | 'waiting_on_client' | 'resolved' | 'closed';

export interface SupportRequest {
  id: ID;
  reference: string; // REQ-2026-0007
  companyId: ID;
  contactId?: ID;
  subject: string;
  category: SupportCategory;
  description: string;
  priority: Priority;
  status: SupportStatus;
  assignedOwnerId?: ID;
  conversation: { byUserId?: ID; byContactId?: ID; body: string; at: ISODate }[];
  attachments?: AttachmentRef[];
  createdAt: ISODate;
  dueDate?: ISODate;
  resolvedDate?: ISODate;
}

/* ────────────────────────────── Notifications & Email log ────────────────────────────── */

export type NotificationType =
  | 'new_registration'
  | 'registration_decision'
  | 'new_sample_request'
  | 'sample_approved'
  | 'ready_to_ship'
  | 'shipment_dispatched'
  | 'customs_hold'
  | 'delivery_delay'
  | 'delivery_confirmed'
  | 'feedback_requested'
  | 'feedback_submitted'
  | 'technical_reply'
  | 'nda_sent'
  | 'nda_changes_requested'
  | 'nda_signed'
  | 'nda_expiring'
  | 'task_due'
  | 'task_overdue'
  | 'support_request'
  | 'invoice_overdue';

export interface AppNotification {
  id: ID;
  type: NotificationType;
  workspace: Workspace;
  /** Who should see it: a role, a specific account, or a company portal. */
  audienceRoles?: Role[];
  audienceCompanyId?: ID;
  title: string;
  body?: string;
  companyId?: ID;
  relatedId?: ID;
  relatedType?: string;
  href?: string;
  priority: Priority;
  read: boolean;
  createdAt: ISODate;
}

export interface EmailLogEntry {
  id: ID;
  /** The notification/event that would have triggered a Gmail send. */
  trigger: NotificationType;
  to: string;
  cc?: string[];
  subject: string;
  preview: string;
  locale: Locale;
  companyId?: ID;
  relatedId?: ID;
  status: 'simulated_sent' | 'queued' | 'skipped';
  createdAt: ISODate;
}

/* ────────────────────────────── Registrations ────────────────────────────── */

export type RegistrationStatus =
  | 'submitted'
  | 'email_verification'
  | 'pending_approval'
  | 'more_info_requested'
  | 'approved'
  | 'rejected';

export interface Registration {
  id: ID;
  reference: string; // REG-2026-0011
  status: RegistrationStatus;

  // company
  legalName: string;
  tradingName?: string;
  companyType: CompanyType;
  companySubtype?: string;
  website?: string;
  country: string;
  countryCode: string;
  region?: string;
  city: string;
  address?: string;
  postalCode?: string;
  vatNumber?: string;
  registrationNumber?: string;
  mainActivity?: string;
  companySize?: CompanySize;
  marketsServed?: string[];
  preferredLanguage: Locale;
  preferredCurrency: Currency;
  timezone?: string;

  // primary contact
  contactFirstName: string;
  contactLastName: string;
  contactJobTitle?: string;
  contactDepartment?: string;
  contactEmail: string;
  contactPhone?: string;
  contactMobile?: string;
  contactLanguage?: Locale;

  // interest
  reason?: string;
  existingContactPerson?: string;
  intendedApplications?: ApplicationCategory[];
  productCategories?: ApplicationCategory[];
  samplesRequested?: boolean;
  intendedTerritories?: string[];
  estimatedTimeline?: string;
  additionalMessage?: string;

  // legal
  privacyAccepted: boolean;
  termsAccepted: boolean;
  marketingOptIn?: boolean;

  // admin handling
  linkedCompanyId?: ID;
  adminNote?: string;
  decidedByUserId?: ID;
  decidedAt?: ISODate;
  createdAt: ISODate;
}

/* ────────────────────────────── Audit ────────────────────────────── */

export interface AuditEvent {
  id: ID;
  at: ISODate;
  actorId?: ID;
  actorRole?: Role;
  action: string; // e.g. 'company.update', 'sample.status_change'
  entityType: string;
  entityId?: ID;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/* ────────────────────────────── Saved views ────────────────────────────── */

export interface SavedView {
  id: ID;
  name: string;
  entity: string;
  filters: Record<string, unknown>;
  columns?: string[];
  ownerId?: ID;
  shared?: boolean;
}

/* ────────────────────────────── Ordered taxonomies (for funnels/boards) ────────────────────────────── */

export const PIPELINE_STAGES: PipelineStage[] = [
  'lead', 'contacted', 'interested', 'qualified',
  'nda_to_prepare', 'nda_sent', 'nda_negotiation', 'nda_signed',
  'introductory_call', 'technical_call',
  'sample_requested', 'sample_approved', 'sample_shipped', 'sample_delivered',
  'application_testing', 'feedback_received', 'commercial_discussion', 'quotation',
  'customer', 'repeat_customer',
];

export const PIPELINE_TERMINAL_STAGES: PipelineStage[] = ['on_hold', 'inactive', 'lost', 'disqualified'];

export const SAMPLE_STATUS_FLOW: SampleStatus[] = [
  'draft', 'submitted', 'under_review', 'more_info_required', 'approved', 'rejected',
  'preparing', 'ready_to_ship', 'shipped', 'in_transit', 'customs_hold', 'delivery_attempted',
  'delivered', 'receipt_confirmed', 'testing', 'feedback_requested', 'feedback_received',
  'closed', 'cancelled',
];

export const NDA_STATUS_FLOW: NDAStatus[] = [
  'not_required', 'to_prepare', 'draft', 'sent', 'under_review', 'changes_requested', 'approved',
  'awaiting_italprotein_signature', 'awaiting_counterparty_signature', 'partially_signed',
  'fully_signed', 'expired', 'terminated',
];

export const FEEDBACK_STATUS_FLOW: FeedbackStatus[] = [
  'received', 'under_review', 'additional_info_requested', 'technical_reply_sent',
  'technical_call_needed', 'resolved',
];

export const COMPANY_TYPES: CompanyType[] = [
  'distributor', 'fb_manufacturer', 'horeca', 'bakery_manufacturer', 'dairy_manufacturer',
  'confectionery_manufacturer', 'ingredient_company', 'retailer', 'agency', 'laboratory',
  'consultant', 'other',
];

export const APPLICATION_CATEGORIES: ApplicationCategory[] = [
  'dairy', 'yogurt', 'desserts', 'flavoured_milk', 'ice_cream', 'bakery', 'biscuits', 'cakes',
  'croissants', 'chocolate', 'protein_bars', 'beverages', 'functional_drinks', 'coffee',
  'spreads', 'sauces', 'plant_based', 'sports_nutrition', 'other',
];
