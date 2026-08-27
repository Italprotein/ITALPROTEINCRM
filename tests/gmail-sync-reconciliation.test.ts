import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/*
 * Structural safety net for Gmail→company reconciliation.
 *
 * lib/backend/gmail-sync.ts imports lib/backend/prisma.ts, which throws at
 * module load when DATABASE_URL is unset, so this suite cannot import the sync
 * and neither can any other test in this repo. Faking it properly would mean
 * hand-writing a Prisma client with company, companyDomain, companyAlias,
 * suppressedEntity, auditEvent, nDA, document, attachment, emailMessage and
 * lead — plus $transaction semantics and a UNIQUE constraint — to assert
 * properties that are visible in the source. That fake would be far more code
 * than the thing it tests, and every one of its behaviours would be one I wrote.
 *
 * So the decision logic lives in lib/email-entity.ts and is unit-tested for
 * real (tests/email-entity.test.ts, no database, no fakes), and what is left
 * here is the WIRING: that the sync actually calls it, in the right order, and
 * that the two properties which cost production four duplicate companies stay
 * structurally impossible. Same technique as tests/action-guards.test.ts.
 */

const ROOT = path.resolve(__dirname, '..');
const SYNC = fs.readFileSync(path.join(ROOT, 'lib', 'backend', 'gmail-sync.ts'), 'utf8');
const SCHEMA = fs.readFileSync(path.join(ROOT, 'prisma', 'schema.prisma'), 'utf8');

/** Source index of a marker, asserted to exist so ordering checks cannot pass on -1. */
function indexOf(haystack: string, needle: string): number {
  const at = haystack.indexOf(needle);
  expect(at, `expected to find ${needle} in lib/backend/gmail-sync.ts`).toBeGreaterThan(-1);
  return at;
}

/** The body of the one function allowed to mint a Company row. */
const ENSURE = SYNC.slice(
  SYNC.indexOf('async function ensureCompanyForDomain('),
  SYNC.indexOf('// ── NDA detection'),
);

describe('company creation cannot bypass the idempotent path', () => {
  /*
   * The exact line that made four "Pphosted" companies on 2026-08-24: a bare
   * create on the top-level client, outside any transaction, with nothing to
   * collide against. Company rows may now only be minted inside
   * ensureCompanyForDomain's transaction, where the domain register's UNIQUE
   * constraint is the referee.
   */
  it('has no bare prisma.company.create call anywhere in the sync', () => {
    // Call-shaped, so the prose in ensureCompanyForDomain's own comment — which
    // names the line it replaced — does not satisfy or break this.
    expect(SYNC).not.toContain('prisma.company.create(');
  });

  it('creates companies only inside a transaction that also claims the domain', () => {
    const transaction = indexOf(ENSURE, 'prisma.$transaction(');
    const create = indexOf(ENSURE, 'tx.company.create(');
    expect(transaction).toBeLessThan(create);
    // The claim goes through the same tx handle, so a rollback takes both. It
    // is written in a helper declared above the transaction, so the assertion
    // is on the handle it uses and on the call that follows the create — not on
    // where the helper happens to sit in the file.
    expect(ENSURE).toContain('tx.companyDomain.create(');
    expect(ENSURE).not.toContain('prisma.companyDomain.create(');
    expect(indexOf(ENSURE, 'attachDomain(tx, company.id)')).toBeGreaterThan(create);
  });

  /*
   * A company nobody asked for is only tolerable if the reason it exists is one
   * query away. The audit event carries the scorer's evidence array verbatim.
   */
  it('records how, in the same transaction as the create', () => {
    expect(SYNC).toContain('tx.auditEvent.create');
    expect(SYNC).toContain('company.auto_created');
    expect(SYNC).toContain('evidence');
  });

  it('re-checks the domain register inside the transaction, not only before it', () => {
    const transaction = indexOf(ENSURE, 'prisma.$transaction(');
    const recheck = indexOf(ENSURE, 'tx.companyDomain.findUnique(');
    const create = indexOf(ENSURE, 'tx.company.create(');
    expect(recheck).toBeGreaterThan(transaction);
    expect(recheck).toBeLessThan(create);
  });
});

describe('the NDA path is gated on the scorer', () => {
  it('classifies the sender before it may create anything', () => {
    const classify = indexOf(SYNC, 'classifyEmailEntity({');
    const ensure = indexOf(SYNC, 'ensureCompanyForDomain({');
    expect(classify).toBeLessThan(ensure);
    expect(SYNC).toContain("classification.verdict === \"link_or_create\"");
  });

  it('feeds the scorer a suppression answer and an automation verdict', () => {
    expect(SYNC).toContain('isAutomatedReply: automatedSender');
    expect(SYNC).toContain('isSuppressed: senderIsNoise');
  });

  /*
   * One detector, not two. lib/investor/auto-reply.ts owns "did a machine send
   * this"; a private copy here would be free to disagree with it, and the
   * disagreement would only ever show up as rows in production.
   */
  it('imports the shared automation detector rather than growing its own', () => {
    expect(SYNC).toContain('from "@/lib/investor/auto-reply"');
    expect(SYNC).not.toContain('AUTOMATED_SUBJECT_PATTERNS');
    expect(SYNC).not.toContain('mailer-daemon');
  });

  /*
   * Same rule for the freemail list and the domain reducer: they moved to
   * lib/email-entity.ts, where they are tested. A second literal list here is
   * how the two drift apart.
   */
  it('keeps no second copy of the freemail list or the domain rules', () => {
    expect(SYNC).not.toContain('"gmail.com"');
    expect(SYNC).not.toContain('"googlemail.com"');
    expect(SYNC).toContain('from "@/lib/email-entity"');
  });

  /*
   * companyNameFromDomain used to run on the raw sending host, which is how a
   * per-message bounce host became a company name. Naming now starts from the
   * registrable base.
   */
  it('names companies from the registrable domain, never the sending host', () => {
    expect(SYNC).not.toContain('companyNameFromDomain');
    expect(SYNC).toContain('organisationNameFromDomain(senderRegistrable)');
    expect(SYNC).toContain('registrableDomain: senderRegistrable');
  });
});

describe('the resolution ladder', () => {
  it('tries contacts, then the domain register, then aliases, then the website substring', () => {
    const ladder = SYNC.slice(
      indexOf(SYNC, 'async function resolveCompanyId('),
      indexOf(SYNC, 'async function resolveUniqueCompanyFromEmails('),
    );
    const contact = ladder.indexOf('prisma.contact.findFirst');
    const domains = ladder.indexOf('prisma.companyDomain.findFirst');
    const aliases = ladder.indexOf('prisma.companyAlias.findMany');
    const website = ladder.indexOf('website: { contains:');
    for (const [label, at] of Object.entries({ contact, domains, aliases, website })) {
      expect(at, label).toBeGreaterThan(-1);
    }
    expect(contact).toBeLessThan(domains);
    expect(domains).toBeLessThan(aliases);
    // The substring test on a free-text field stays last: website
    // "https://acme.com/partners/foo.it" contains "foo.it".
    expect(aliases).toBeLessThan(website);
  });
});

describe('suppression outlives the lead rebuild', () => {
  /*
   * reconcileStoredLeadOwnership deletes and re-derives every gmail-source lead
   * on each run. Without a skip here, a bounce handler cleaned out by hand
   * reappears as a lead on the next sync — so "Pphosted is gone" would be true
   * only until tomorrow.
   */
  it('skips infrastructure and suppressed senders while rebuilding leads', () => {
    const rebuild = SYNC.slice(
      indexOf(SYNC, 'async function reconcileStoredLeadOwnership('),
      indexOf(SYNC, '// ── Main sync'),
    );
    expect(rebuild).toContain('isInfrastructureDomain(domain)');
    expect(rebuild).toContain('isSuppressedSender(from, registrable, suppressions)');
  });

  it('reads the suppression register from its own table, not from Lead', () => {
    expect(SYNC).toContain('prisma.suppressedEntity.findMany');
  });

  it('suppresses the live lead path too, not only the rebuild', () => {
    expect(SYNC).toContain('senderIsNoise ? null : organisationNameFromDomain(senderRegistrable)');
  });
});

describe('the schema backs the idempotency claim', () => {
  /*
   * If this constraint is ever relaxed, ensureCompanyForDomain silently stops
   * being idempotent — the re-check inside the transaction still races, and
   * duplicates come back. The guarantee is the constraint, not the code.
   */
  it('makes CompanyDomain.domain globally unique', () => {
    const model = SCHEMA.slice(
      SCHEMA.indexOf('model CompanyDomain {'),
      SCHEMA.indexOf('model SuppressedEntity {'),
    );
    expect(model).toMatch(/domain\s+String\s+@unique/);
  });

  /*
   * Deliberately NOT globally unique: two unrelated companies genuinely share a
   * trading name across markets, and a global unique makes the second one
   * unsaveable. Ambiguity is resolved by refusing to link, not by refusing to
   * save.
   */
  it('scopes CompanyAlias uniqueness to the company and indexes the name globally', () => {
    const model = SCHEMA.slice(
      SCHEMA.indexOf('model CompanyAlias {'),
      SCHEMA.indexOf('model CompanyDomain {'),
    );
    expect(model).toContain('@@unique([companyId, normalizedName])');
    expect(model).toContain('@@index([normalizedName])');
    expect(model).not.toMatch(/normalizedName\s+String\s+@unique/);
  });

  it('keeps suppression in its own table with a stable key', () => {
    const model = SCHEMA.slice(
      SCHEMA.indexOf('model SuppressedEntity {'),
      SCHEMA.indexOf('model SuppressedEntity {') + 1200,
    );
    expect(model).toContain('@@unique([kind, normalizedValue])');
  });
});
