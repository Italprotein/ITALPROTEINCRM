import { describe, expect, it } from 'vitest';

import {
  agentFromSignature,
  classifyOutreachRecipient,
  companyNameFromDomain,
  countryFromDomain,
  initialsFromName,
  organisationLabelOf,
  type OutreachInput,
} from '@/lib/outreach';

/** A real outbound body, trimmed — the shape every one of ours has. */
const GIUSEPPE_BODY = `In allegato trova il nostro pitch. Sarebbe un piacere organizzare una breve call.
Cordiali saluti,
Giuseppe Minelli
CEO & Presidente
Italprotein Srl
ad@italprotein.com`;

const AMINE_BODY = `Best regards,
Amine Abidi
Italprotein Srl
ad@italprotein.com`;

describe('agentFromSignature', () => {
  it('names the person who actually sent it, which From cannot', () => {
    // Every message says ad@italprotein.com. On production 312 were signed by
    // Giuseppe and 178 by Amine; without the signature all 490 belong to nobody.
    expect(agentFromSignature(GIUSEPPE_BODY)).toBe('giuseppeminelli@wefin.it');
    expect(agentFromSignature(AMINE_BODY)).toBe('labidimedamine53@gmail.com');
  });

  it('matches the full name before the bare first name', () => {
    // "Amine" exists as an entry to catch the short form; it must not shadow
    // the full one, or the longest match would never win.
    expect(agentFromSignature('Regards, Amine')).toBe('labidimedamine53@gmail.com');
    expect(agentFromSignature('Regards, Amine Abidi')).toBe('labidimedamine53@gmail.com');
  });

  it('returns null rather than guessing when no signature matches', () => {
    expect(agentFromSignature('Thanks, someone else entirely')).toBeNull();
    expect(agentFromSignature(null)).toBeNull();
    expect(agentFromSignature('')).toBeNull();
  });
});

describe('classifyOutreachRecipient', () => {
  const base = (over: Partial<OutreachInput> = {}): OutreachInput => ({
    email: 'rd@mccain.com',
    knownDomains: new Set(),
    investorDomains: new Set(),
    suppressedDomains: new Set(),
    ...over,
  });

  it('creates a company for a business we deliberately emailed', () => {
    expect(classifyOutreachRecipient(base())).toEqual({
      verdict: 'create',
      domain: 'mccain.com',
    });
  });

  it('links instead of duplicating when the domain is already a company', () => {
    expect(
      classifyOutreachRecipient(base({ knownDomains: new Set(['mccain.com']) })),
    ).toEqual({ verdict: 'link', domain: 'mccain.com' });
  });

  it('never turns an investor into a commercial company', () => {
    // Investors live in their own table precisely so no sales machinery
    // attaches to them. That separation has to survive this importer.
    expect(
      classifyOutreachRecipient(
        base({ email: 'info@scientifica.vc', investorDomains: new Set(['scientifica.vc']) }),
      ),
    ).toMatchObject({ verdict: 'ignore', reason: 'investor' });
  });

  it('skips our own domains, including the parent company', () => {
    for (const email of ['ad@italprotein.com', 'giuseppeminelli@wefin.it']) {
      expect(classifyOutreachRecipient(base({ email }))).toMatchObject({
        verdict: 'ignore',
        reason: 'own-domain',
      });
    }
  });

  it('skips couriers — we email them as a supplier, not a prospect', () => {
    for (const email of ['tracking@dhl.com', 'info@brt.it']) {
      expect(classifyOutreachRecipient(base({ email }))).toMatchObject({
        verdict: 'ignore',
        reason: 'service-provider',
      });
    }
  });

  it('skips freemail and consumer ISP mailboxes', () => {
    expect(classifyOutreachRecipient(base({ email: 'someone@gmail.com' }))).toMatchObject({
      reason: 'freemail',
    });
    expect(classifyOutreachRecipient(base({ email: 'someone@verizon.net' }))).toMatchObject({
      reason: 'isp-mailbox',
    });
  });

  it('skips mail infrastructure and suppressed domains', () => {
    expect(
      classifyOutreachRecipient(base({ email: 'x@mx0a-0025e601.pphosted.com' })),
    ).toMatchObject({ reason: 'infrastructure' });
    expect(
      classifyOutreachRecipient(
        base({ email: 'x@blocked.com', suppressedDomains: new Set(['blocked.com']) }),
      ),
    ).toMatchObject({ reason: 'suppressed' });
  });

  it('rejects an unparseable address instead of creating from it', () => {
    expect(classifyOutreachRecipient(base({ email: 'not-an-address' }))).toMatchObject({
      verdict: 'ignore',
      reason: 'no-domain',
    });
  });
});

describe('companyNameFromDomain', () => {
  it('splits the run-together suffixes that domains create', () => {
    expect(companyNameFromDomain('dawnfoods.com')).toBe('Dawn Foods');
    expect(companyNameFromDomain('schreiberfoods.com')).toBe('Schreiber Foods');
    expect(companyNameFromDomain('asahibeverages.com')).toBe('Asahi Beverages');
    expect(companyNameFromDomain('hellenicdairies.com')).toBe('Hellenic Dairies');
    expect(companyNameFromDomain('arabianmills.com')).toBe('Arabian Mills');
  });

  it('capitalises the Mc prefix the way the real name does', () => {
    expect(companyNameFromDomain('mccain.com')).toBe('McCain');
    expect(companyNameFromDomain('mccain.co.uk')).toBe('McCain');
  });

  it('leaves lookalike prefixes alone', () => {
    // "mac" and "de" as surname prefixes did more harm than good on the real
    // list: they turned macromike.com into "MacRomike" and delmonte.com into
    // "DeLmonte".
    expect(companyNameFromDomain('macromike.com.au')).toBe('Macromike');
    expect(companyNameFromDomain('delmonte.com')).toBe('Delmonte');
  });

  it('reads past a second-level suffix to the organisation label', () => {
    expect(companyNameFromDomain('brookfarm.com.au')).toBe('Brook Farm');
    expect(companyNameFromDomain('wholebake.co.uk')).toBe('Wholebake');
  });

  it('keeps hyphenated names as separate words', () => {
    expect(companyNameFromDomain('biota-ingredients.com')).toBe('Biota Ingredients');
  });

  it('refuses to name a company after a freemail provider', () => {
    expect(companyNameFromDomain('gmail.com')).toBeNull();
    expect(companyNameFromDomain('')).toBeNull();
  });

  it('leaves a name it cannot split alone rather than mangling it', () => {
    // Nothing here can know gupuds.com is "GupuDS"; a plain capitalisation is
    // an honest placeholder, an invented split would not be.
    expect(companyNameFromDomain('gupuds.com')).toBe('Gupuds');
  });
});

describe('countryFromDomain', () => {
  it('reads a country from a ccTLD, including second-level ones', () => {
    expect(countryFromDomain('brookfarm.com.au')).toEqual({ code: 'AU', name: 'Australia' });
    expect(countryFromDomain('wholebake.co.uk')).toEqual({ code: 'GB', name: 'United Kingdom' });
    expect(countryFromDomain('balocco.it')).toEqual({ code: 'IT', name: 'Italy' });
    expect(countryFromDomain('modernmills.com.sa')).toEqual({ code: 'SA', name: 'Saudi Arabia' });
  });

  it('says nothing when the TLD says nothing', () => {
    // .com is not a country. Guessing "US" here would put a wrong flag on a
    // third of the imported rows.
    expect(countryFromDomain('mccain.com')).toBeNull();
    expect(countryFromDomain('chobani.com')).toBeNull();
  });
});

describe('initialsFromName', () => {
  it('builds the two-letter monogram the avatar tile expects', () => {
    expect(initialsFromName('Dawn Foods')).toBe('DF');
    expect(initialsFromName('McCain')).toBe('MC');
    expect(initialsFromName('')).toBe('??');
  });
});

describe('organisationLabelOf', () => {
  it('collapses a regional domain family onto one label', () => {
    // The reason McCain is one company with three domains rather than three
    // companies that happen to render with the same name.
    for (const domain of ['mccain.com', 'mccain.ca', 'mccain.co.uk']) {
      expect(organisationLabelOf(domain)).toBe('mccain');
    }
    expect(organisationLabelOf('orkla.no')).toBe(organisationLabelOf('orkla.se'));
    expect(organisationLabelOf('sanitarium.com')).toBe(organisationLabelOf('sanitarium.com.au'));
  });

  it('keeps unrelated organisations apart', () => {
    expect(organisationLabelOf('chobani.com')).not.toBe(organisationLabelOf('fonterra.com'));
  });

  it('reads a subdomain back to its registrable organisation', () => {
    expect(organisationLabelOf('fr.froneri.com')).toBe('froneri');
  });
});
