import { describe, it, expect } from 'vitest';

import {
  proposeCompanyDomains,
  classifyUnlinkedDomain,
  proposeUnlinkedDomains,
  proposeAliasLinks,
  proposeFalseCompanies,
  type UnlinkedDomainGroup,
  type CompanyFactsRow,
} from '@/lib/reconcile/proposals';

/*
 * The reconciliation report, decided by pure functions.
 *
 * Everything the script decides lives here, fed plain rows and returning plain
 * proposals, so the two production cases from 2026-08-27 are regression tests
 * rather than a thing someone has to re-run against the live database:
 *
 *  - bulla.com.au: 25 inbound emails from three humans, a Lead row, no company.
 *    The FALSE NEGATIVE. It must come out of the general rules as a top
 *    candidate carrying its human senders — nothing below names it.
 *  - pphosted.com: four "Pphosted" company rows minted from Proofpoint bounces.
 *    The FALSE POSITIVE. The infrastructure list in lib/email-entity.ts is what
 *    identifies it; the rule is "name equals the label of an infrastructure
 *    domain, tagged gmail-import, and nothing real filed under it".
 *
 * No test below hardcodes either name into the implementation's expectations —
 * they are inputs, and the assertions are about the SHAPE of the answer.
 */

// ── Shorthands so each test reads as its case, not as object construction ──

function group(overrides: Partial<UnlinkedDomainGroup> & { domain: string }): UnlinkedDomainGroup {
  return {
    senders: [],
    inboundCount: 0,
    outboundCount: 0,
    hasNdaAttachment: false,
    leadNames: [],
    suppressed: false,
    companyIdForDomain: null,
    ...overrides,
  };
}

function facts(overrides: Partial<CompanyFactsRow> & { companyId: string; legalName: string }): CompanyFactsRow {
  return {
    tradingName: null,
    tags: [],
    createdAt: '2026-08-24T09:00:00.000Z',
    domains: [],
    ...overrides,
    counts: {
      contacts: 0,
      ndas: 0,
      emailMessages: 0,
      quotes: 0,
      orders: 0,
      invoices: 0,
      sampleRequests: 0,
      shipments: 0,
      opportunities: 0,
      documents: 0,
      feedbacks: 0,
      projects: 0,
      meetings: 0,
      tasks: 0,
      ...overrides.counts,
    },
  };
}

/** The real bulla.com.au aggregate, from the production evidence. */
const BULLA = group({
  domain: 'bulla.com.au',
  senders: [
    { email: 'olivia.li@bulla.com.au', name: 'Olivia Li', inboundCount: 21, automated: false },
    { email: 'rob.burston@bulla.com.au', name: 'Rob Burston', inboundCount: 3, automated: false },
    { email: 'peter.hawkett@bulla.com.au', name: 'Peter Hawkett', inboundCount: 1, automated: false },
  ],
  inboundCount: 25,
  outboundCount: 0,
  leadNames: ['Bulla'],
});

/** The real Proofpoint bounce aggregate. */
const PPHOSTED = group({
  domain: 'pphosted.com',
  senders: [
    { email: 'mailer-daemon@mx0a-0025e601.pphosted.com', name: 'Mail Delivery Subsystem', inboundCount: 3, automated: true },
    { email: 'mailer-daemon@mx0b-0025e601.pphosted.com', name: 'Mail Delivery Subsystem', inboundCount: 1, automated: true },
  ],
  inboundCount: 4,
  hasNdaAttachment: true,
});

// ── Step 1: domain backfill for companies that already exist ───────────────

describe('proposeCompanyDomains', () => {
  it('proposes a domain when one company owns it unambiguously', () => {
    const { proposals, collisions } = proposeCompanyDomains({
      sources: [
        { companyId: 'c1', origin: 'contact', value: 'anna@acme-foods.com' },
        { companyId: 'c1', origin: 'contact', value: 'luca@acme-foods.com' },
      ],
      existingDomains: {},
    });
    expect(collisions).toEqual([]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ kind: 'PROPOSE-DOMAIN', domain: 'acme-foods.com', companyId: 'c1' });
  });

  it('reduces a contact address to its registrable domain', () => {
    const { proposals } = proposeCompanyDomains({
      sources: [{ companyId: 'c1', origin: 'contact', value: 'olivia.li@mail.bulla.com.au' }],
      existingDomains: {},
    });
    expect(proposals[0].domain).toBe('bulla.com.au');
  });

  it('reports a COLLISION instead of guessing when two companies share a domain', () => {
    const { proposals, collisions } = proposeCompanyDomains({
      sources: [
        { companyId: 'c1', origin: 'contact', value: 'anna@shared.com' },
        { companyId: 'c2', origin: 'contact', value: 'luca@shared.com' },
      ],
      existingDomains: {},
    });
    expect(proposals).toEqual([]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].kind).toBe('COLLISION');
    expect(collisions[0].domain).toBe('shared.com');
    expect(collisions[0].companyIds.sort()).toEqual(['c1', 'c2']);
  });

  it('never proposes a freemail or infrastructure domain', () => {
    const { proposals, skipped } = proposeCompanyDomains({
      sources: [
        { companyId: 'c1', origin: 'contact', value: 'someone@gmail.com' },
        { companyId: 'c2', origin: 'contact', value: 'mailer-daemon@mx0a-0025e601.pphosted.com' },
      ],
      existingDomains: {},
    });
    expect(proposals).toEqual([]);
    expect(skipped.map((s) => s.reason).sort()).toEqual(['freemail', 'infrastructure']);
  });

  it('takes domains from the website column as well as from contacts', () => {
    const { proposals } = proposeCompanyDomains({
      sources: [{ companyId: 'c1', origin: 'website', value: 'https://www.acme-foods.com/partners' }],
      existingDomains: {},
    });
    expect(proposals[0]).toMatchObject({ domain: 'acme-foods.com', companyId: 'c1' });
  });

  it('is idempotent: a domain already in the register is skipped, not re-proposed', () => {
    const { proposals, skipped } = proposeCompanyDomains({
      sources: [{ companyId: 'c1', origin: 'contact', value: 'anna@acme-foods.com' }],
      existingDomains: { 'acme-foods.com': 'c1' },
    });
    expect(proposals).toEqual([]);
    expect(skipped[0].reason).toBe('already-registered');
  });
});

// ── Step 2: unlinked stored mail, grouped by registrable domain ────────────

describe('classifyUnlinkedDomain', () => {
  it('proposes LINK when the domain is already a company domain', () => {
    const proposal = classifyUnlinkedDomain(
      group({ domain: 'acme-foods.com', companyIdForDomain: 'c1', inboundCount: 4 }),
    );
    expect(proposal.kind).toBe('PROPOSE-LINK');
    expect(proposal.companyId).toBe('c1');
  });

  it('bulla-shaped input becomes a STRONG candidate that lists its human senders', () => {
    const proposal = classifyUnlinkedDomain(BULLA);
    expect(proposal.kind).toBe('PROPOSE-CREATE-CANDIDATE');
    expect(proposal.strength).toBe('strong');
    expect(proposal.messageCount).toBe(25);
    expect(proposal.humanSenders).toEqual([
      'olivia.li@bulla.com.au',
      'rob.burston@bulla.com.au',
      'peter.hawkett@bulla.com.au',
    ]);
    expect(proposal.evidence).toContain('existing-lead');
  });

  it('pphosted-shaped input is suppressed, not proposed — even carrying an NDA', () => {
    const proposal = classifyUnlinkedDomain(PPHOSTED);
    expect(proposal.kind).toBe('PROPOSE-SUPPRESS');
    expect(proposal.humanSenders).toEqual([]);
    expect(proposal.evidence).toContain('infrastructure-domain');
  });

  it('suppresses a non-infrastructure domain whose senders are all automated', () => {
    const proposal = classifyUnlinkedDomain(
      group({
        domain: 'shop.example.com',
        senders: [{ email: 'no-reply@shop.example.com', name: null, inboundCount: 9, automated: false }],
        inboundCount: 9,
      }),
    );
    expect(proposal.kind).toBe('PROPOSE-SUPPRESS');
    expect(proposal.evidence).toContain('automated-senders-only');
  });

  it('respects an existing suppression entry', () => {
    const proposal = classifyUnlinkedDomain(
      group({
        domain: 'courier.example',
        suppressed: true,
        senders: [{ email: 'anna@courier.example', name: 'Anna Rossi', inboundCount: 5, automated: false }],
        inboundCount: 5,
      }),
    );
    expect(proposal.kind).toBe('PROPOSE-SUPPRESS');
    expect(proposal.evidence).toContain('suppressed-domain');
  });

  it('leaves a single cold human email UNCERTAIN rather than guessing', () => {
    const proposal = classifyUnlinkedDomain(
      group({
        domain: 'newcomer.it',
        senders: [{ email: 'g.bianchi@newcomer.it', name: 'Giulia Bianchi', inboundCount: 1, automated: false }],
        inboundCount: 1,
      }),
    );
    expect(proposal.kind).toBe('UNCERTAIN');
    expect(proposal.strength).toBe('weak');
  });

  it('leaves a strong domain with no lead UNCERTAIN — a person still decides', () => {
    const proposal = classifyUnlinkedDomain({ ...BULLA, leadNames: [] });
    expect(proposal.kind).toBe('UNCERTAIN');
    expect(proposal.strength).toBe('strong');
  });
});

describe('proposeUnlinkedDomains', () => {
  it('ranks the strongest candidate first', () => {
    const proposals = proposeUnlinkedDomains([
      PPHOSTED,
      group({
        domain: 'newcomer.it',
        senders: [{ email: 'g.bianchi@newcomer.it', name: 'Giulia Bianchi', inboundCount: 1, automated: false }],
        inboundCount: 1,
      }),
      BULLA,
    ]);
    const ranked = proposals.filter((p) => p.kind !== 'PROPOSE-SUPPRESS');
    expect(ranked[0].domain).toBe('bulla.com.au');
  });
});

// ── Step 3: names that look like the same organisation (report only) ───────

describe('proposeAliasLinks', () => {
  it('pairs two companies whose names normalise to the same string', () => {
    const links = proposeAliasLinks([
      { companyId: 'c1', name: 'Regal Cream Products Pty. Ltd.', source: 'legalName' },
      { companyId: 'c2', name: 'regal cream products pty ltd', source: 'alias' },
    ]);
    expect(links).toHaveLength(1);
    expect(links[0].companies.map((c) => c.companyId).sort()).toEqual(['c1', 'c2']);
  });

  it('pairs names that differ only by a legal-form suffix', () => {
    const links = proposeAliasLinks([
      { companyId: 'c1', name: 'Bulla Dairy Foods Pty Ltd', source: 'legalName' },
      { companyId: 'c2', name: 'Bulla Dairy Foods', source: 'legalName' },
    ]);
    expect(links).toHaveLength(1);
  });

  it('never pairs a company with itself', () => {
    expect(
      proposeAliasLinks([
        { companyId: 'c1', name: 'Acme Foods', source: 'legalName' },
        { companyId: 'c1', name: 'ACME FOODS', source: 'alias' },
      ]),
    ).toEqual([]);
  });
});

// ── Step 4: companies the old bug invented ────────────────────────────────

describe('proposeFalseCompanies', () => {
  const pphostedRows = [
    facts({ companyId: 'p1', legalName: 'Pphosted', tags: ['gmail-import'], createdAt: '2026-08-24T08:00:00.000Z', counts: { ndas: 1 } }),
    facts({ companyId: 'p2', legalName: 'Pphosted', tags: ['gmail-import'], createdAt: '2026-08-24T09:00:00.000Z', counts: { ndas: 1 } }),
    facts({ companyId: 'p3', legalName: 'Pphosted', tags: ['gmail-import'], createdAt: '2026-08-24T10:00:00.000Z', counts: { ndas: 1 } }),
    facts({ companyId: 'p4', legalName: 'Pphosted', tags: ['gmail-import'], createdAt: '2026-08-24T11:00:00.000Z', counts: { ndas: 1 } }),
  ];

  it('detects the four bounce-born rows, keeps one, and lists the rest for manual deletion', () => {
    const proposals = proposeFalseCompanies(pphostedRows);
    expect(proposals).toHaveLength(1);
    const [p] = proposals;
    expect(p.kind).toBe('PROPOSE-FALSE-COMPANY');
    expect(p.infrastructureDomain).toBe('pphosted.com');
    expect(p.suppressDomain).toBe('pphosted.com');
    // The oldest row survives; the merge target is a real id, never invented.
    expect(p.keepCompanyId).toBe('p1');
    expect(p.duplicateCompanyIds).toEqual(['p2', 'p3', 'p4']);
  });

  it('spares a row that carries real business data, however it was named', () => {
    const proposals = proposeFalseCompanies([
      facts({ companyId: 'p1', legalName: 'Pphosted', tags: ['gmail-import'], counts: { ndas: 1, contacts: 2 } }),
    ]);
    expect(proposals).toEqual([]);
  });

  it('spares a company whose name is not an infrastructure label', () => {
    const proposals = proposeFalseCompanies([
      facts({ companyId: 'c1', legalName: 'Bulla', tags: ['gmail-import'], counts: { ndas: 1 } }),
    ]);
    expect(proposals).toEqual([]);
  });

  it('spares a row nobody auto-created, even one named after a relay', () => {
    const proposals = proposeFalseCompanies([
      facts({ companyId: 'c1', legalName: 'Pphosted', tags: [], counts: { ndas: 1 } }),
    ]);
    expect(proposals).toEqual([]);
  });

  it('proposes nothing to delete when only one bounce-born row exists', () => {
    const proposals = proposeFalseCompanies([pphostedRows[0]]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].duplicateCompanyIds).toEqual([]);
    expect(proposals[0].suppressDomain).toBe('pphosted.com');
  });

  it('does not exonerate the survivor: it is named, counted and reported too', () => {
    // Folding four rows into one leaves ONE company still named after a bounce
    // handler, now holding all four bounce-filed NDAs. If the proposal only
    // listed the three duplicates, that row would quietly become permanent.
    const [proposal] = proposeFalseCompanies(pphostedRows);
    expect(proposal.keepCompanyName).toBe('Pphosted');
    expect(proposal.survivorNdaCount).toBe(1);
    expect(proposal.foldedNdaCount).toBe(3);
  });

  it('names the bounce-born NDA rows when the caller supplied their ids', () => {
    const withIds = pphostedRows.map((row, index) => ({ ...row, ndaIds: [`nda-${index + 1}`] }));
    const [proposal] = proposeFalseCompanies(withIds);
    // Survivor's own first, then everything the fold moves onto it.
    expect(proposal.ndaIdsToReview).toEqual(['nda-1', 'nda-2', 'nda-3', 'nda-4']);
    expect(proposal.survivorNdaCount).toBe(1);
    expect(proposal.foldedNdaCount).toBe(3);
  });

  it('is not shielded by the document its own bounce filed — the production regression', () => {
    // The first dry-run against production found all four Pphosted rows
    // carrying documents: 1 (the auto-filed bounce attachment) and proposed
    // nothing. A document created by the same bug is not evidence of a person.
    const rows = [1, 2, 3, 4].map((i) => ({
      companyId: `c${i}`,
      legalName: 'Pphosted',
      tradingName: null,
      tags: ['gmail-import'],
      createdAt: `2026-08-24T0${i}:00:00Z`,
      domains: [],
      counts: { contacts: 0, ndas: 1, emailMessages: 1, documents: 1 },
      ndaIds: [`nda${i}`],
    }));
    const proposals = proposeFalseCompanies(rows as never);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].duplicateCompanyIds).toHaveLength(3);
    expect(proposals[0].ndaIdsToReview).toHaveLength(4);
  });

  it('still refuses to fold a row a person has worked with', () => {
    const row = {
      companyId: 'c1', legalName: 'Pphosted', tradingName: null,
      tags: ['gmail-import'], createdAt: '2026-08-24T01:00:00Z', domains: [],
      counts: { contacts: 1, ndas: 1, documents: 1 }, ndaIds: ['nda1'],
    };
    expect(proposeFalseCompanies([row] as never)).toHaveLength(0);
  });

});
