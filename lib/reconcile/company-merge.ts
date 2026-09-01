/**
 * Every row that points at a Company, and what a merge must do with it.
 *
 * Merging two company rows means repointing EVERY foreign key that names the
 * source, in one transaction, and then deleting it. Miss one relation and the
 * delete fails on a foreign-key constraint — or worse, succeeds against a
 * nullable column and silently orphans the rows.
 *
 * The list is therefore data rather than a sequence of hand-written statements,
 * and `tests/company-merge-relations.test.ts` parses prisma/schema.prisma and
 * diffs the Company model's back-relations against it. Add a relation to
 * Company without adding it here and that test fails, which is the only way to
 * keep an enumeration like this honest six months from now.
 *
 * No Prisma import: this is a description, and the test that checks it must run
 * without a database.
 */

export type MergeStrategy =
  /** `updateMany` the foreign key from source to target. The common case. */
  | 'repoint'
  /**
   * The foreign key is UNIQUE per company, so the target can already hold a
   * row. Target's wins; the source's is dropped.
   */
  | 'repoint_unique_company'
  /**
   * Unique on (companyId, normalizedName): repoint what the target does not
   * already have under the same normalized name, drop the rest.
   */
  | 'repoint_unique_alias'
  /**
   * Financial records outlive the CRM relationship. Their presence on the
   * SOURCE refuses the merge outright — the same rule removeCompany() applies
   * in lib/services/company.actions.ts, for the same reason.
   */
  | 'block';

export interface CompanyRelationHandling {
  /** The field name on `model Company` in prisma/schema.prisma. */
  relation: string;
  /** The Prisma client delegate, e.g. `nDA` for `model NDA`. */
  delegate: string;
  /** The column on the related model that carries the company id. */
  foreignKey: string;
  strategy: MergeStrategy;
  note?: string;
}

/**
 * All 28 back-relations declared on `model Company`, in schema order.
 *
 * `owner` is absent on purpose: it is the FORWARD relation Company→User
 * (Company.ownerUserId), not a row pointing at the company, and the merge does
 * not touch the target's owner.
 */
export const COMPANY_MERGE_RELATIONS: readonly CompanyRelationHandling[] = [
  { relation: 'contacts', delegate: 'contact', foreignKey: 'companyId', strategy: 'repoint' },
  { relation: 'opportunities', delegate: 'opportunity', foreignKey: 'companyId', strategy: 'repoint' },
  {
    relation: 'externalUsers',
    delegate: 'user',
    foreignKey: 'companyId',
    strategy: 'repoint',
    note: 'Portal logins. Their scope follows the surviving company.',
  },
  { relation: 'linkedRegistrations', delegate: 'registration', foreignKey: 'linkedCompanyId', strategy: 'repoint' },
  {
    relation: 'provisionedByDecisions',
    delegate: 'registrationDecision',
    foreignKey: 'provisionedCompanyId',
    strategy: 'repoint',
  },
  { relation: 'sampleRequests', delegate: 'sampleRequest', foreignKey: 'companyId', strategy: 'repoint' },
  { relation: 'shipments', delegate: 'shipment', foreignKey: 'companyId', strategy: 'repoint' },
  { relation: 'feedbacks', delegate: 'feedback', foreignKey: 'companyId', strategy: 'repoint' },
  { relation: 'applicationProjects', delegate: 'applicationProject', foreignKey: 'companyId', strategy: 'repoint' },
  { relation: 'ndas', delegate: 'nDA', foreignKey: 'companyId', strategy: 'repoint' },
  { relation: 'emailMessages', delegate: 'emailMessage', foreignKey: 'companyId', strategy: 'repoint' },
  { relation: 'documents', delegate: 'document', foreignKey: 'companyId', strategy: 'repoint' },
  { relation: 'googleDriveFileLinks', delegate: 'googleDriveFileLink', foreignKey: 'companyId', strategy: 'repoint' },
  {
    relation: 'quotes',
    delegate: 'quote',
    foreignKey: 'companyId',
    strategy: 'block',
    note: 'An issued quote is an accounting fact. Move it by hand or not at all.',
  },
  { relation: 'orders', delegate: 'order', foreignKey: 'companyId', strategy: 'block' },
  { relation: 'invoices', delegate: 'invoice', foreignKey: 'companyId', strategy: 'block' },
  {
    relation: 'creditNotes',
    delegate: 'creditNote',
    foreignKey: 'companyId',
    strategy: 'repoint',
    note: 'Nullable and always issued against an invoice, which blocks first.',
  },
  { relation: 'tasks', delegate: 'task', foreignKey: 'companyId', strategy: 'repoint' },
  { relation: 'meetings', delegate: 'meeting', foreignKey: 'companyId', strategy: 'repoint' },
  { relation: 'activities', delegate: 'activity', foreignKey: 'companyId', strategy: 'repoint' },
  { relation: 'notifications', delegate: 'notification', foreignKey: 'companyId', strategy: 'repoint' },
  {
    relation: 'audienceNotifications',
    delegate: 'notification',
    foreignKey: 'audienceCompanyId',
    strategy: 'repoint',
    note: 'Same table as `notifications`, different column — both must move.',
  },
  { relation: 'supportRequests', delegate: 'supportRequest', foreignKey: 'companyId', strategy: 'repoint' },
  { relation: 'assistantThreads', delegate: 'assistantThread', foreignKey: 'companyId', strategy: 'repoint' },
  {
    relation: 'doNotContact',
    delegate: 'doNotContactEntry',
    foreignKey: 'companyId',
    strategy: 'repoint_unique_company',
    note: 'companyId is UNIQUE — the target keeps its own entry if it has one.',
  },
  {
    relation: 'followUp',
    delegate: 'followUp',
    foreignKey: 'companyId',
    strategy: 'repoint_unique_company',
    note:
      'companyId is UNIQUE, same shape as the do-not-contact entry above. The ' +
      'target keeps its own row: whichever status and date a person set on the ' +
      'surviving company outrank the duplicate being merged away.',
  },
  {
    relation: 'aliasEntries',
    delegate: 'companyAlias',
    foreignKey: 'companyId',
    strategy: 'repoint_unique_alias',
    note: 'Unique on (companyId, normalizedName).',
  },
  {
    relation: 'domains',
    delegate: 'companyDomain',
    foreignKey: 'companyId',
    strategy: 'repoint',
    note: 'domain is globally unique, so repointing companyId can never collide.',
  },
];

/**
 * Columns that carry a company id with NO foreign key and no relation field on
 * Company, so the schema diff above cannot see them.
 *
 * `email_logs.companyId` is operational and moves with the relationship.
 * `audit_events.companyId` deliberately does NOT move: an audit trail records
 * what happened to the row that existed, and rewriting it to point at the
 * survivor would erase the fact that the source ever existed. The merge writes
 * its own event naming both ids instead.
 */
export const COMPANY_ID_COLUMNS_WITHOUT_RELATIONS: readonly {
  delegate: string;
  foreignKey: string;
  strategy: 'repoint' | 'keep';
}[] = [
  { delegate: 'emailLog', foreignKey: 'companyId', strategy: 'repoint' },
  { delegate: 'auditEvent', foreignKey: 'companyId', strategy: 'keep' },
];

/** Relations whose presence on the source refuses the merge. */
export const MERGE_BLOCKING_RELATIONS = COMPANY_MERGE_RELATIONS.filter((r) => r.strategy === 'block');
