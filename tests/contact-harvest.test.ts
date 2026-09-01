import { describe, expect, it } from 'vitest';

import {
  deriveContactName,
  normalizeEmail,
  parseBounce,
  planContactImport,
  type HarvestCandidate,
  type HarvestContext,
} from '@/lib/contact-harvest';

/* Bodies below are trimmed copies of real DSNs from the production mailbox —
 * the Italian wording is what Gmail actually sends this account. */

const NOT_FOUND_IT = `** Indirizzo non trovato **
Il tuo messaggio non è stato recapitato a info@vierreholding.com perché l'indirizzo risulta inesistente o non può ricevere email.
La risposta del server remoto è:
550 5.1.1 <info@vierreholding.com> sorry, no mailbox here by that name. #5.5.1
Final-Recipient: rfc822; info@vierreholding.com
Action: failed
Status: 5.1.1`;

const NOT_FOUND_EN = `** Address not found **
Your message wasn't delivered to sam@example.com because the address couldn't be found.
Final-Recipient: rfc822; sam@example.com
Action: failed
Status: 5.1.1`;

const TOO_LARGE = `** Messaggio troppo grande **
Impossibile recapitare il messaggio a info@cfosim.com perché supera il limite delle dimensioni.
Final-Recipient: rfc822; info@cfosim.com
Action: failed
Status: 5.3.4`;

const MAILBOX_FULL = `** La casella di posta del destinatario è piena **
Final-Recipient: rfc822; full@example.com
Action: failed
Status: 5.2.2`;

const TRANSIENT = `** Consegna non completata **
Final-Recipient: rfc822; slow@example.com
Action: delayed
Status: 4.4.1`;

const ACCESS_DENIED = `** Messaggio bloccato **
Final-Recipient: rfc822; blocked@example.com
Action: failed
Status: 5.7.1`;

describe('parseBounce', () => {
  it('reads an Italian "address not found" as a dead address', () => {
    const bounce = parseBounce(NOT_FOUND_IT);
    expect(bounce).toMatchObject({
      address: 'info@vierreholding.com',
      status: '5.1.1',
      marker: 'indirizzo non trovato',
      notFound: true,
    });
  });

  it('reads the English wording the same way', () => {
    expect(parseBounce(NOT_FOUND_EN)?.notFound).toBe(true);
  });

  it('does NOT condemn a mailbox that only refused an oversized message', () => {
    // 36 of these in production. Treating them as dead would delete working
    // contacts at real companies.
    const bounce = parseBounce(TOO_LARGE);
    expect(bounce?.address).toBe('info@cfosim.com');
    expect(bounce?.notFound).toBe(false);
  });

  it('does NOT condemn a full mailbox, a delayed message, or a policy block', () => {
    expect(parseBounce(MAILBOX_FULL)?.notFound).toBe(false);
    expect(parseBounce(TRANSIENT)?.notFound).toBe(false);
    expect(parseBounce(ACCESS_DENIED)?.notFound).toBe(false);
  });

  it('trusts the status code when a foreign relay writes its own wording', () => {
    const bounce = parseBounce(
      'Delivery failed\nFinal-Recipient: rfc822; ghost@example.com\nStatus: 5.1.10',
    );
    expect(bounce?.notFound).toBe(true);
  });

  it('returns null for ordinary mail, so every message can be handed to it', () => {
    expect(parseBounce('Hi, thanks for the sample — we will test next week.')).toBeNull();
    expect(parseBounce(null)).toBeNull();
    expect(parseBounce('')).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('unwraps a display name and drops trailing punctuation', () => {
    expect(normalizeEmail('Rob Burston <Rob.Burston@Bulla.com.au>')).toBe('rob.burston@bulla.com.au');
    expect(normalizeEmail('  a@b.com. ')).toBe('a@b.com');
  });

  it('rejects anything that is not an address', () => {
    expect(normalizeEmail('not an address')).toBe('');
    expect(normalizeEmail('a@b')).toBe('');
    expect(normalizeEmail(null)).toBe('');
  });
});

describe('deriveContactName', () => {
  it('prefers the display name the person chose', () => {
    expect(deriveContactName('Andrea Bulgarelli', 'a.bulgarelli@lec.it')).toEqual({
      firstName: 'Andrea',
      lastName: 'Bulgarelli',
    });
  });

  it('keeps a multi-word surname whole', () => {
    expect(deriveContactName('Maria Francesca Iodice', 'mf@x.it')).toEqual({
      firstName: 'Maria',
      lastName: 'Francesca Iodice',
    });
  });

  it('reorders a surname-first directory entry', () => {
    expect(deriveContactName('Rossi, Mario', 'm.rossi@x.it')).toEqual({
      firstName: 'Mario',
      lastName: 'Rossi',
    });
  });

  it('falls back to a firstname.lastname address when there is no display name', () => {
    expect(deriveContactName(null, 'rob.burston@bulla.com.au')).toEqual({
      firstName: 'Rob',
      lastName: 'Burston',
    });
  });

  it('leaves a desk address as a desk address', () => {
    // Matches the hand-entered rows already in production: firstName "info",
    // empty surname — not an invented person.
    expect(deriveContactName(null, 'info@bauer-natur.de')).toEqual({
      firstName: 'info',
      lastName: '',
    });
  });

  it('ignores a display name that is only the address again', () => {
    expect(deriveContactName('sales@x.com', 'sales@x.com')).toEqual({
      firstName: 'sales',
      lastName: '',
    });
  });

  it('strips honorifics rather than treating them as a first name', () => {
    expect(deriveContactName('Dr. Sabrina Layenberger', 'sabrina@layenberger.com')).toEqual({
      firstName: 'Sabrina',
      lastName: 'Layenberger',
    });
  });
});

describe('planContactImport', () => {
  const base: HarvestCandidate = {
    email: 'marta.faggian@unired.it',
    companyId: 'c1',
    displayName: 'Marta Faggian',
    messageCount: 4,
    lastSeenAt: new Date('2026-08-20T00:00:00.000Z'),
    outboundOnly: false,
  };

  const context = (over: Partial<HarvestContext> = {}): HarvestContext => ({
    existingEmails: new Set(),
    notFoundEmails: new Set(),
    ownDomains: new Set(['italprotein.com']),
    ...over,
  });

  it('creates a contact for an address we have corresponded with', () => {
    expect(planContactImport(base, context())).toEqual({
      kind: 'create',
      email: 'marta.faggian@unired.it',
      companyId: 'c1',
      firstName: 'Marta',
      lastName: 'Faggian',
      lastSeenAt: base.lastSeenAt,
    });
  });

  it('refuses an address Gmail said was not found', () => {
    // The instruction this enforces: verify against Gmail BEFORE adding.
    expect(
      planContactImport(base, context({ notFoundEmails: new Set(['marta.faggian@unired.it']) })),
    ).toEqual({ kind: 'skip', email: 'marta.faggian@unired.it', reason: 'address_not_found' });
  });

  it('checks the bounce list before the already-a-contact shortcut', () => {
    // Both conditions true: the answer must still name the dead address, so the
    // report tells the truth about why nothing happened.
    const action = planContactImport(
      base,
      context({
        existingEmails: new Set(['marta.faggian@unired.it']),
        notFoundEmails: new Set(['marta.faggian@unired.it']),
      }),
    );
    expect(action).toEqual({
      kind: 'skip',
      email: 'marta.faggian@unired.it',
      reason: 'address_not_found',
    });
  });

  it('skips addresses already on a contact row', () => {
    expect(
      planContactImport(base, context({ existingEmails: new Set(['marta.faggian@unired.it']) })),
    ).toMatchObject({ reason: 'already_a_contact' });
  });

  it('never turns a colleague or a mail server into a contact', () => {
    expect(
      planContactImport({ ...base, email: 'ad@italprotein.com' }, context()),
    ).toMatchObject({ reason: 'own_domain' });
    expect(
      planContactImport({ ...base, email: 'bounce@mx0a-0025e601.pphosted.com' }, context()),
    ).toMatchObject({ reason: 'infrastructure' });
  });

  it('admits several addresses from the same company', () => {
    // The whole request: one row per person, not one per company.
    const people = ['rob.burston@bulla.com.au', 'peter.hawkett@bulla.com.au', 'olivia.li@bulla.com.au'];
    const actions = people.map((email) =>
      planContactImport({ ...base, email, displayName: null }, context()),
    );
    expect(actions.every((a) => a.kind === 'create')).toBe(true);
    expect(actions.map((a) => (a.kind === 'create' ? a.firstName : ''))).toEqual([
      'Rob', 'Peter', 'Olivia',
    ]);
  });

  it('rejects an unparseable address instead of writing it', () => {
    expect(planContactImport({ ...base, email: 'not-an-address' }, context())).toMatchObject({
      reason: 'invalid',
    });
  });
});
