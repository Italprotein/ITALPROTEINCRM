import { describe, it, expect } from 'vitest';

import {
  loadDomainRegister,
  loadSuppressedDomains,
  planAliasLinks,
  planDomains,
  planFalseCompanies,
  planMail,
  type ReconcileCandidateCompany,
  type ReconcileMessage,
  type ReconcileReader,
} from '@/lib/reconcile/plan';

/*
 * The reconciliation passes, EXECUTED.
 *
 * tests/reconcile-proposals.test.ts covers the decisions and
 * tests/reconcile-script.test.ts parses the script's source for its dry-run
 * guarantee. Neither ran a single line of the read-and-shape code between them,
 * and that gap shipped a `const` map being reassigned on every run — a
 * TypeError that killed the command after pass 1's report, dry and apply alike.
 * `tsconfig.json` excluded `scripts/`, so typecheck never saw it either.
 *
 * So the passes moved to lib/reconcile/plan.ts behind a reader port, and this
 * file runs all four of them end to end against plain rows. A crash in that
 * code is now a failing test.
 *
 * The data is shaped like the two production cases of 2026-08-27 and nothing in
 * the implementation names either.
 */

// ── A reader made of literals ─────────────────────────────────────────────

interface FakeData {
  companyDomains?: { domain: string; companyId: string }[];
  suppressedDomains?: string[];
  contacts?: { companyId: string; email: string; secondaryEmail: string | null }[];
  websites?: { id: string; website: string | null }[];
  messages?: ReconcileMessage[];
  leads?: { companyName: string; sourceDomain: string | null }[];
  companyNames?: { id: string; legalName: string; tradingName: string | null }[];
  aliases?: { companyId: string; name: string }[];
  autoImported?: ReconcileCandidateCompany[];
  counts?: Record<string, Record<string, number>>;
  ndaIds?: Record<string, string[]>;
}

function fakeReader(data: FakeData): ReconcileReader {
  return {
    companyDomains: async () => data.companyDomains ?? [],
    suppressedDomains: async () => data.suppressedDomains ?? [],
    contactAddresses: async () => data.contacts ?? [],
    companyWebsites: async () => data.websites ?? [],
    messages: async () => data.messages ?? [],
    leads: async () => data.leads ?? [],
    companyNames: async () => data.companyNames ?? [],
    aliases: async () => data.aliases ?? [],
    autoImportedCompanies: async () => data.autoImported ?? [],
    companyCounts: async (id) => data.counts?.[id] ?? {},
    companyNdaIds: async (id) => data.ndaIds?.[id] ?? [],
  };
}

function inbound(
  id: string,
  from: string,
  name: string | null,
  extra: Partial<ReconcileMessage> = {},
): ReconcileMessage {
  return {
    id,
    direction: 'inbound',
    fromAddress: from,
    fromName: name,
    subject: 'RE: Proamina',
    toAddresses: ['sales@italprotein.com'],
    ccAddresses: [],
    companyId: null,
    ndaDetected: false,
    ...extra,
  };
}

/** 25 inbound emails from three humans on one domain, with a Lead standing. */
function bullaShaped(): FakeData {
  const messages: ReconcileMessage[] = [];
  for (let i = 0; i < 21; i += 1) messages.push(inbound(`b${i}`, 'olivia.li@bulla.com.au', 'Olivia Li'));
  for (let i = 0; i < 3; i += 1) messages.push(inbound(`r${i}`, 'rob.burston@bulla.com.au', 'Rob Burston'));
  messages.push(inbound('p0', 'peter.hawkett@bulla.com.au', 'Peter Hawkett'));
  return { messages, leads: [{ companyName: 'Bulla', sourceDomain: 'bulla.com.au' }] };
}

/** Four Proofpoint bounces, each from a different per-message host. */
function pphostedShaped(): ReconcileMessage[] {
  return [0, 1, 2, 3].map((i) =>
    inbound(`bounce${i}`, `mailer-daemon@mx0${i}-0025e601.pphosted.com`, 'Mail Delivery Subsystem', {
      subject: 'Undelivered Mail Returned to Sender',
      ndaDetected: true,
    }),
  );
}

// ── The regression the whole refactor exists for ──────────────────────────

describe('the planning path executes', () => {
  it('runs all four passes end to end without throwing', async () => {
    // The bug this guards was not a wrong answer — it was a TypeError. Any
    // crash anywhere in the read-and-shape code fails here.
    const reader = fakeReader({
      ...bullaShaped(),
      messages: [...(bullaShaped().messages ?? []), ...pphostedShaped()],
      contacts: [{ companyId: 'c1', email: 'anna@acme-foods.com', secondaryEmail: null }],
      websites: [{ id: 'c2', website: 'https://www.other-foods.com/en' }],
      companyNames: [{ id: 'c1', legalName: 'Acme Foods', tradingName: null }],
      autoImported: [],
    });

    const register = await loadDomainRegister(reader);
    const suppressed = await loadSuppressedDomains(reader);
    await expect(planDomains(reader, register)).resolves.toBeDefined();
    await expect(planMail(reader, register, suppressed)).resolves.toBeDefined();
    await expect(planAliasLinks(reader)).resolves.toBeDefined();
    await expect(planFalseCompanies(reader)).resolves.toBeDefined();
  });

  it('runs twice with no state carried between runs', async () => {
    // The original crash was a MODULE-LEVEL map being reassigned. State that
    // outlives one plan is the shape of that bug, so two plans from two readers
    // must not see each other.
    const first = fakeReader(bullaShaped());
    const second = fakeReader({
      messages: [inbound('x0', 'g.bianchi@newcomer.it', 'Giulia Bianchi')],
      leads: [],
    });

    const planA = await planMail(first, new Map(), new Set());
    const planB = await planMail(second, new Map(), new Set());

    expect([...planA.messageIdsByDomain.keys()]).toEqual(['bulla.com.au']);
    expect([...planB.messageIdsByDomain.keys()]).toEqual(['newcomer.it']);
    expect(planA.messageIdsByDomain.get('bulla.com.au')).toHaveLength(25);
    expect(planB.messageIdsByDomain.get('bulla.com.au')).toBeUndefined();
  });
});

// ── Pass 1 ────────────────────────────────────────────────────────────────

describe('planDomains', () => {
  it('derives a domain from contacts and from the website column', async () => {
    const reader = fakeReader({
      contacts: [
        { companyId: 'c1', email: 'anna@acme-foods.com', secondaryEmail: 'anna.b@acme-foods.com' },
      ],
      websites: [{ id: 'c2', website: 'https://www.other-foods.com/en/partners' }],
    });
    const { proposals, collisions } = await planDomains(reader, new Map());
    expect(collisions).toEqual([]);
    expect(proposals.map((p) => `${p.domain}->${p.companyId}`).sort()).toEqual([
      'acme-foods.com->c1',
      'other-foods.com->c2',
    ]);
  });

  it('never proposes our own domain', async () => {
    const reader = fakeReader({
      contacts: [{ companyId: 'c1', email: 'giuseppe@italprotein.com', secondaryEmail: null }],
    });
    const { proposals, skipped } = await planDomains(reader, new Map());
    expect(proposals).toEqual([]);
    expect(skipped).toEqual([]);
  });

  it('reports a collision rather than picking a company', async () => {
    const reader = fakeReader({
      contacts: [
        { companyId: 'c1', email: 'anna@shared.com', secondaryEmail: null },
        { companyId: 'c2', email: 'luca@shared.com', secondaryEmail: null },
      ],
    });
    const { proposals, collisions } = await planDomains(reader, new Map());
    expect(proposals).toEqual([]);
    expect(collisions[0].companyIds).toEqual(['c1', 'c2']);
  });
});

// ── Pass 2 ────────────────────────────────────────────────────────────────

describe('planMail', () => {
  it('makes the bulla-shaped domain a strong candidate carrying its senders', async () => {
    const reader = fakeReader(bullaShaped());
    const plan = await planMail(reader, new Map(), new Set());
    const bulla = plan.proposals.find((p) => p.domain === 'bulla.com.au')!;
    expect(bulla.kind).toBe('PROPOSE-CREATE-CANDIDATE');
    expect(bulla.strength).toBe('strong');
    expect(bulla.messageCount).toBe(25);
    expect(bulla.humanSenders).toEqual([
      'olivia.li@bulla.com.au',
      'rob.burston@bulla.com.au',
      'peter.hawkett@bulla.com.au',
    ]);
    // Ranked first, so the report shows it at the top.
    expect(plan.proposals[0].domain).toBe('bulla.com.au');
  });

  it('reduces every bounce host to one suppressed registrable domain', async () => {
    const reader = fakeReader({ messages: pphostedShaped() });
    const plan = await planMail(reader, new Map(), new Set());
    // Four different sending hosts, ONE group — that reduction is the fix for
    // the four duplicate company rows.
    expect(plan.proposals).toHaveLength(1);
    expect(plan.proposals[0]).toMatchObject({ kind: 'PROPOSE-SUPPRESS', domain: 'pphosted.com' });
    expect(plan.proposals[0].humanSenders).toEqual([]);
  });

  it('links a domain the register already owns, and counts two-way mail', async () => {
    const reader = fakeReader({
      messages: [
        inbound('m1', 'anna@acme-foods.com', 'Anna Rossi'),
        {
          ...inbound('m2', 'sales@italprotein.com', 'Sales'),
          direction: 'outbound',
          toAddresses: ['anna@acme-foods.com'],
        },
      ],
    });
    const plan = await planMail(reader, new Map([['acme-foods.com', 'c1']]), new Set());
    const proposal = plan.proposals.find((p) => p.domain === 'acme-foods.com')!;
    expect(proposal.kind).toBe('PROPOSE-LINK');
    expect(proposal.companyId).toBe('c1');
    expect(plan.groups.find((g) => g.domain === 'acme-foods.com')!.outboundCount).toBe(1);
  });

  it('never groups consumer mailboxes into one candidate', async () => {
    const reader = fakeReader({
      messages: [
        inbound('g1', 'someone@gmail.com', 'Some One'),
        inbound('g2', 'another@gmail.com', 'An Other'),
      ],
    });
    const plan = await planMail(reader, new Map(), new Set());
    expect(plan.proposals).toEqual([]);
    expect(plan.freemailSkipped).toEqual([{ domain: 'gmail.com', messages: 2 }]);
  });

  it('skips mail that is already attributed', async () => {
    const reader = fakeReader({
      messages: [inbound('m1', 'anna@acme-foods.com', 'Anna Rossi', { companyId: 'c1' })],
    });
    const plan = await planMail(reader, new Map(), new Set());
    expect(plan.proposals).toEqual([]);
  });

  it('honours an existing suppression', async () => {
    const reader = fakeReader({ messages: [inbound('m1', 'anna@courier.example', 'Anna Rossi')] });
    const plan = await planMail(reader, new Map(), new Set(['courier.example']));
    expect(plan.proposals[0].kind).toBe('PROPOSE-SUPPRESS');
    expect(plan.proposals[0].evidence).toContain('suppressed-domain');
  });
});

// ── Passes 3 and 4 ────────────────────────────────────────────────────────

describe('planAliasLinks', () => {
  it('pairs a legal name against another company alias', async () => {
    const reader = fakeReader({
      companyNames: [
        { id: 'c1', legalName: 'Regal Cream Products Pty Ltd', tradingName: null },
        { id: 'c2', legalName: 'Something Else', tradingName: null },
      ],
      aliases: [{ companyId: 'c2', name: 'Regal Cream Products' }],
    });
    const links = await planAliasLinks(reader);
    expect(links).toHaveLength(1);
    expect(links[0].companies.map((c) => c.companyId).sort()).toEqual(['c1', 'c2']);
  });
});

describe('planFalseCompanies', () => {
  const rows: ReconcileCandidateCompany[] = [1, 2, 3, 4].map((n) => ({
    id: `p${n}`,
    legalName: 'Pphosted',
    tradingName: null,
    tags: ['gmail-import'],
    createdAt: new Date(`2026-08-24T0${n}:00:00.000Z`),
    domains: [],
  }));

  const emptyCounts = { contacts: 0, quotes: 0, orders: 0, invoices: 0, ndas: 1 };

  it('folds the group onto the oldest row and names what needs a human', async () => {
    const reader = fakeReader({
      autoImported: rows,
      counts: Object.fromEntries(rows.map((row) => [row.id, emptyCounts])),
      ndaIds: { p1: ['nda-1'], p2: ['nda-2'], p3: ['nda-3'], p4: ['nda-4'] },
    });
    const [proposal] = await planFalseCompanies(reader);
    expect(proposal.keepCompanyId).toBe('p1');
    expect(proposal.keepCompanyName).toBe('Pphosted');
    expect(proposal.duplicateCompanyIds).toEqual(['p2', 'p3', 'p4']);
    // The survivor is not exonerated by surviving: it keeps a relay's name and
    // inherits every bounce-filed NDA, so both are reported.
    expect(proposal.survivorNdaCount).toBe(1);
    expect(proposal.foldedNdaCount).toBe(3);
    expect(proposal.ndaIdsToReview).toEqual(['nda-1', 'nda-2', 'nda-3', 'nda-4']);
  });

  it('pays for counts only on rows that already look like an artefact', async () => {
    const asked: string[] = [];
    const reader: ReconcileReader = {
      ...fakeReader({
        autoImported: [
          ...rows.slice(0, 1),
          {
            id: 'real',
            legalName: 'Bulla Dairy Foods',
            tradingName: null,
            tags: ['gmail-import'],
            createdAt: new Date('2026-08-01T00:00:00.000Z'),
            domains: ['bulla.com.au'],
          },
        ],
        counts: { p1: emptyCounts },
      }),
      companyCounts: async (id) => {
        asked.push(id);
        return emptyCounts;
      },
    };
    await planFalseCompanies(reader);
    expect(asked).toEqual(['p1']);
  });

  it('spares a row carrying real business data', async () => {
    const reader = fakeReader({
      autoImported: rows.slice(0, 1),
      counts: { p1: { ...emptyCounts, contacts: 2 } },
    });
    expect(await planFalseCompanies(reader)).toEqual([]);
  });
});
