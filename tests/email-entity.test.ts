import { describe, it, expect } from 'vitest';

import {
  ENTITY_SCORE_CANDIDATE,
  ENTITY_SCORE_CREATE,
  INFRASTRUCTURE_DOMAINS,
  classifyEmailEntity,
  isFreemailDomain,
  isInfrastructureDomain,
  normalizeDomain,
  normalizeEntityName,
  organisationNameFromDomain,
  registrableDomainOf,
  type EmailEntityInput,
} from '@/lib/email-entity';
import { isAutomatedReply } from '@/lib/investor/auto-reply';

/*
 * The pure half of Gmail→company reconciliation.
 *
 * Two production failures paid for this file, both read off the live database
 * on 2026-08-27:
 *
 *  FALSE POSITIVE — four duplicate "Pphosted" companies, all created on
 *  2026-08-24, all sitting at nda_in_progress. They came from
 *  mailer-daemon@mx0a-0025e601.pphosted.com: Proofpoint bounces handing our own
 *  NDA attachment straight back to us. The sync saw "external sender, business
 *  domain, NDA-looking attachment" and created a company per bounce. Two
 *  independent rules here have to stop that — the sender is a machine AND the
 *  domain is mail infrastructure — because either one alone is a single point
 *  of failure for a mistake that writes rows into a CRM 438 companies deep.
 *
 *  FALSE NEGATIVE — 25 inbound emails from three humans at bulla.com.au
 *  (olivia.li ×21, rob.burston ×3, peter.hawkett ×1, 26 Jul → 27 Aug) linked to
 *  nothing at all. Ordinary correspondence carries no attachment, so the old
 *  code never even looked at it.
 *
 * The scorer is deliberately transparent: every rule that fires names itself in
 * `evidence`, and that array is what the audit event stores when a company is
 * auto-created. A row nobody can explain is a row nobody can trust.
 */

const input = (over: Partial<EmailEntityInput> = {}): EmailEntityInput => ({
  fromEmail: 'olivia.li@bulla.com.au',
  fromName: 'Olivia Li',
  subject: 'RE: Proamina',
  headers: {},
  isAutomatedReply: false,
  hasNdaAttachment: false,
  ...over,
});

// ── Normalisation ──────────────────────────────────────────────────────────

describe('normalizeDomain', () => {
  it('lowercases, trims and strips www.', () => {
    expect(normalizeDomain('  WWW.Bulla.COM.au ')).toBe('bulla.com.au');
    expect(normalizeDomain('bulla.com.au.')).toBe('bulla.com.au');
  });

  it('is empty for nothing usable', () => {
    for (const value of ['', '   ', null, undefined]) {
      expect(normalizeDomain(value)).toBe('');
    }
  });
});

describe('normalizeEntityName', () => {
  it('folds case, accents, punctuation and runs of whitespace', () => {
    expect(normalizeEntityName('  Bulla   Dairy Foods ')).toBe('bulla dairy foods');
    expect(normalizeEntityName('Regal Cream Products Pty. Ltd.')).toBe('regal cream products pty ltd');
    expect(normalizeEntityName('Nestlé')).toBe('nestle');
  });

  it('is empty for nothing usable', () => {
    expect(normalizeEntityName(null)).toBe('');
    expect(normalizeEntityName('   ')).toBe('');
  });
});

describe('registrableDomainOf', () => {
  /*
   * The line that made four companies. companyNameFromDomain saw the whole
   * bounce host and produced "Mx0a 0025e601"… except the four rows say
   * "Pphosted", because the crude second-level handling already dropped one
   * label. Either way the identity of the sender is pphosted.com, and that is
   * the only string that can be matched against a suppression list or a
   * CompanyDomain row.
   */
  it('collapses a Proofpoint bounce host to its registrable base', () => {
    expect(registrableDomainOf('mx0a-0025e601.pphosted.com')).toBe('pphosted.com');
    expect(registrableDomainOf('mailer-daemon@mx0a-0025e601.pphosted.com')).toBe('pphosted.com');
  });

  it('keeps three labels for a second-level registry like .com.au', () => {
    expect(registrableDomainOf('olivia.li@bulla.com.au')).toBe('bulla.com.au');
    expect(registrableDomainOf('mail.bulla.com.au')).toBe('bulla.com.au');
    expect(registrableDomainOf('someone@company.co.uk')).toBe('company.co.uk');
  });

  it('leaves an already-registrable domain alone', () => {
    expect(registrableDomainOf('italprotein.com')).toBe('italprotein.com');
    expect(registrableDomainOf('someone@italprotein.com')).toBe('italprotein.com');
  });

  it('is empty for nothing usable', () => {
    expect(registrableDomainOf('not-an-email')).toBe('');
    expect(registrableDomainOf('')).toBe('');
    expect(registrableDomainOf('@')).toBe('');
  });
});

describe('isInfrastructureDomain', () => {
  it('knows the bounce host that created the duplicates', () => {
    expect(isInfrastructureDomain('mx0a-0025e601.pphosted.com')).toBe(true);
    expect(isInfrastructureDomain('pphosted.com')).toBe(true);
    expect(INFRASTRUCTURE_DOMAINS.has('pphosted.com')).toBe(true);
  });

  it('recognises the usual senders-for-hire', () => {
    for (const host of [
      'mailgun.org',
      'email.mailgun.net',
      'sendgrid.net',
      'us-east-2.amazonses.com',
      'mcsv.net',
      'sparkpostmail.com',
      'mandrillapp.com',
      'pamx1.mimecast.com',
      'zendesk.com',
    ]) {
      expect(isInfrastructureDomain(host), host).toBe(true);
    }
  });

  /*
   * Exchange Online stamps outbound.protection.outlook.com on relayed mail.
   * That suffix is infrastructure; outlook.com itself is not — it is freemail,
   * and a different rule handles it. Collapsing the suffix to its registrable
   * base would have swallowed every Outlook user alive.
   */
  it('suppresses the Exchange relay suffix without suppressing outlook.com', () => {
    expect(isInfrastructureDomain('eur01-he1-obe.outbound.protection.outlook.com')).toBe(true);
    expect(isInfrastructureDomain('outlook.com')).toBe(false);
  });

  it('leaves a real trading domain alone', () => {
    expect(isInfrastructureDomain('bulla.com.au')).toBe(false);
    expect(isInfrastructureDomain('italprotein.com')).toBe(false);
  });
});

describe('isFreemailDomain', () => {
  it('matches on the registrable base, so a freemail subdomain still counts', () => {
    expect(isFreemailDomain('gmail.com')).toBe(true);
    expect(isFreemailDomain('libero.it')).toBe(true);
    expect(isFreemailDomain('bulla.com.au')).toBe(false);
  });
});

describe('organisationNameFromDomain', () => {
  it('names the organisation from the registrable base, never the bounce host', () => {
    expect(organisationNameFromDomain('bulla.com.au')).toBe('Bulla');
    expect(organisationNameFromDomain('acme-foods.com')).toBe('Acme Foods');
    expect(organisationNameFromDomain('mx0a-0025e601.pphosted.com')).not.toContain('Mx0a');
  });

  it('refuses freemail', () => {
    expect(organisationNameFromDomain('gmail.com')).toBeNull();
  });
});

// ── The scorer ─────────────────────────────────────────────────────────────

describe('classifyEmailEntity: the Pphosted bounce', () => {
  const bounce = {
    fromEmail: 'mailer-daemon@mx0a-0025e601.pphosted.com',
    fromName: 'Mail Delivery Subsystem',
    subject: 'Undeliverable: NDA Italprotein',
    headers: { 'Return-Path': '<>', 'Auto-Submitted': 'auto-replied' },
    hasNdaAttachment: true,
  };

  /*
   * Both rules are tested with the OTHER one disarmed, on purpose. In
   * production these fire together, which means a single regression in either
   * would be invisible until the duplicates came back.
   */
  it('is ignored for being a machine, even with the domain rule disarmed', () => {
    const verdict = classifyEmailEntity(
      input({ ...bounce, fromEmail: 'mailer-daemon@some-unknown-host.example', isAutomatedReply: true }),
    );
    expect(verdict.verdict).toBe('ignore');
    expect(verdict.evidence).toContain('automated-sender');
  });

  it('is ignored for being infrastructure, even with the automated flag disarmed', () => {
    const verdict = classifyEmailEntity(input({ ...bounce, fromName: 'Olivia Li', isAutomatedReply: false }));
    expect(verdict.verdict).toBe('ignore');
    expect(verdict.evidence).toContain('infrastructure-domain');
  });

  it('is ignored when both fire, and never scores', () => {
    const verdict = classifyEmailEntity(input({ ...bounce, isAutomatedReply: true }));
    expect(verdict.verdict).toBe('ignore');
    expect(verdict.score).toBeLessThan(ENTITY_SCORE_CANDIDATE);
  });

  /*
   * Wiring check, not a re-test of the investor module: the flag this scorer
   * consumes is the one that module produces for exactly this message.
   */
  it('takes its automated flag from the shared detector', () => {
    expect(
      isAutomatedReply({ from: bounce.fromEmail, subject: bounce.subject, headers: bounce.headers }),
    ).toBe(true);
  });

  it('is ignored even when suppression is what the caller knows', () => {
    const verdict = classifyEmailEntity(
      input({ fromEmail: 'sales@newco.example', fromName: 'Jane Roe', hasNdaAttachment: true, isSuppressed: true }),
    );
    expect(verdict.verdict).toBe('ignore');
    expect(verdict.evidence).toContain('suppressed-domain');
  });
});

describe('classifyEmailEntity: real correspondence', () => {
  /*
   * Olivia Li, 21 messages, replies in both directions. Nothing in the CRM
   * points at her: this is the false negative, and it must at least surface as
   * a candidate rather than vanishing.
   */
  it('promotes two-way correspondence with a human on a business domain to a candidate', () => {
    const verdict = classifyEmailEntity(input({ twoWay: true, humanReplyCount: 21 }));
    expect(verdict.verdict).toBe('candidate');
    expect(verdict.score).toBeGreaterThanOrEqual(ENTITY_SCORE_CANDIDATE);
    expect(verdict.evidence).toContain('two-way-correspondence');
  });

  /*
   * The rail that stops the FP fix from re-creating the FP. Ordinary mail, no
   * matter how much of it, must not mint a company on its own: the promotion
   * from candidate to company stays a decision somebody makes.
   */
  it('never reaches link_or_create on correspondence alone', () => {
    const verdict = classifyEmailEntity(input({ twoWay: true, humanReplyCount: 99 }));
    expect(verdict.verdict).not.toBe('link_or_create');
    expect(verdict.score).toBeLessThan(ENTITY_SCORE_CREATE);
  });

  it('counts repeated inbound from one human as engagement even without a reply from us', () => {
    const verdict = classifyEmailEntity(input({ twoWay: false, humanReplyCount: 3 }));
    expect(verdict.verdict).toBe('candidate');
    expect(verdict.evidence).toContain('repeated-inbound');
  });

  it('leaves a single cold inbound from a named human on a business domain a candidate', () => {
    const verdict = classifyEmailEntity(input({ subject: 'Protein isolate enquiry' }));
    expect(verdict.verdict).toBe('candidate');
    expect(verdict.evidence).toContain('cold-inbound-human-business-domain');
  });

  it('ignores a single cold inbound with no human name behind a robot mailbox', () => {
    const verdict = classifyEmailEntity(input({ fromEmail: 'no-reply@newsletter.example', fromName: null }));
    expect(verdict.verdict).toBe('ignore');
    expect(verdict.evidence).toContain('no-reply-localpart');
  });

  it('still ignores no.reply and donotreply spellings', () => {
    for (const localpart of ['no.reply', 'noreply', 'donotreply', 'do-not-reply', 'non-rispondere']) {
      const verdict = classifyEmailEntity(input({ fromEmail: `${localpart}@shop.example`, fromName: null }));
      expect(verdict.verdict, localpart).toBe('ignore');
    }
  });
});

describe('classifyEmailEntity: the NDA path', () => {
  it('is the only route to link_or_create: NDA + human + business domain', () => {
    const verdict = classifyEmailEntity(
      input({ fromEmail: 'j.roe@acme-foods.com', fromName: 'Jane Roe', hasNdaAttachment: true }),
    );
    expect(verdict.verdict).toBe('link_or_create');
    expect(verdict.score).toBeGreaterThanOrEqual(ENTITY_SCORE_CREATE);
    expect(verdict.evidence).toContain('nda-attachment-from-human-business-domain');
  });

  /*
   * Freemail NDAs already had the right behaviour — the sync parks the file
   * unattributed instead of guessing — and that must survive the rewrite. A
   * gmail.com address is a person, not an organisation: creating "Gmail" as a
   * company is the same class of mistake as creating "Pphosted".
   */
  it('never lets freemail reach link_or_create, however strong the evidence', () => {
    const verdict = classifyEmailEntity(
      input({
        fromEmail: 'jane.roe@gmail.com',
        fromName: 'Jane Roe',
        hasNdaAttachment: true,
        twoWay: true,
        humanReplyCount: 40,
      }),
    );
    expect(verdict.verdict).toBe('candidate');
    expect(verdict.evidence).toContain('freemail-domain');
  });

  it('does not create from an NDA sent by a machine', () => {
    const verdict = classifyEmailEntity(
      input({ fromEmail: 'postmaster@acme-foods.com', fromName: null, hasNdaAttachment: true, isAutomatedReply: true }),
    );
    expect(verdict.verdict).toBe('ignore');
  });

  it('does not create when the NDA arrives from mail infrastructure', () => {
    const verdict = classifyEmailEntity(
      input({ fromEmail: 'relay@sendgrid.net', fromName: 'Acme Foods', hasNdaAttachment: true }),
    );
    expect(verdict.verdict).toBe('ignore');
    expect(verdict.evidence).toContain('infrastructure-domain');
  });

  it('ignores a sender with no usable domain at all', () => {
    const verdict = classifyEmailEntity(input({ fromEmail: 'garbage', fromName: 'Jane Roe', hasNdaAttachment: true }));
    expect(verdict.verdict).toBe('ignore');
    expect(verdict.evidence).toContain('no-sender-domain');
  });
});

describe('classifyEmailEntity: evidence', () => {
  it('names every rule that fired, and nothing that did not', () => {
    const verdict = classifyEmailEntity(
      input({ fromEmail: 'j.roe@acme-foods.com', fromName: 'Jane Roe', hasNdaAttachment: true, twoWay: true }),
    );
    expect(verdict.evidence).toContain('nda-attachment-from-human-business-domain');
    expect(verdict.evidence).toContain('two-way-correspondence');
    expect(verdict.evidence).not.toContain('freemail-domain');
    expect(verdict.evidence).not.toContain('infrastructure-domain');
    expect(new Set(verdict.evidence).size).toBe(verdict.evidence.length);
  });

  /*
   * A List-Unsubscribe header is NOT automation by the shared detector's
   * semantics (Precedence: list is deliberately absent from it, because this
   * company mails plenty of info@ group aliases that relay real answers). The
   * wiring must not quietly invent a stricter rule on the side.
   */
  it('does not treat a List-Unsubscribe header as automation on its own', () => {
    const headers = { 'List-Unsubscribe': '<mailto:unsub@bulla.com.au>' };
    expect(isAutomatedReply({ from: 'olivia.li@bulla.com.au', subject: 'RE: Proamina', headers })).toBe(false);

    const verdict = classifyEmailEntity(
      input({ headers, isAutomatedReply: isAutomatedReply({ from: 'olivia.li@bulla.com.au', headers }) }),
    );
    expect(verdict.verdict).toBe('candidate');
    expect(verdict.evidence).not.toContain('automated-sender');
  });

  it('keeps the thresholds ordered so a verdict cannot skip a tier', () => {
    expect(ENTITY_SCORE_CREATE).toBeGreaterThan(ENTITY_SCORE_CANDIDATE);
    expect(ENTITY_SCORE_CANDIDATE).toBeGreaterThan(0);
  });
});
