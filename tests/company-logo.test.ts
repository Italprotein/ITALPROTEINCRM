import { describe, it, expect } from 'vitest';

import {
  LOGO_CONTENT_TYPES,
  LOGO_IMPORT_CANDIDATE_WHERE,
  isAllowedLogoContentType,
  parseLogoDataUri,
  domainFromEmail,
} from '@/lib/company-logo';

/*
 * These pin the three review findings on the logo pipeline.
 *
 * 1. SVG must never be storable or servable. An SVG is a scriptable document,
 *    the app sets no CSP, and the bytes are attacker-influenced: anyone with
 *    `company.edit` can point a company's website at a domain they control and
 *    DuckDuckGo's ip3 endpoint will proxy that domain's SVG favicon back to us.
 *    Served same-origin, that is stored XSS against a staff session.
 * 2. The set a provider may write and the set the API route may serve must be
 *    ONE list. A wider write set stores bytes the route 404s on, leaving a
 *    "has logo" flag that costs every list row a wasted round trip.
 * 3. The bulk importer must skip rows that already hold logo bytes, so the
 *    migration needs no backfill to protect them.
 *
 * lib/company-logo.ts is deliberately Prisma-free so all of this is reachable
 * from vitest's Node environment with no database.
 */

/** A base64 payload; contents are irrelevant to the format checks. */
const PAYLOAD = Buffer.from('not-really-an-image').toString('base64');

const dataUri = (contentType: string) => `data:${contentType};base64,${PAYLOAD}`;

describe('LOGO_CONTENT_TYPES', () => {
  it('is exactly the five raster types, and nothing else', () => {
    expect([...LOGO_CONTENT_TYPES]).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/x-icon',
      'image/vnd.microsoft.icon',
    ]);
  });

  it('does not contain image/svg+xml', () => {
    expect(LOGO_CONTENT_TYPES).not.toContain('image/svg+xml');
  });

  it('contains no type whose name suggests a document rather than a raster image', () => {
    for (const type of LOGO_CONTENT_TYPES) {
      expect(type.startsWith('image/')).toBe(true);
      expect(type).not.toMatch(/svg|xml|html/i);
    }
  });
});

describe('isAllowedLogoContentType', () => {
  for (const type of LOGO_CONTENT_TYPES) {
    it(`accepts ${type}`, () => {
      expect(isAllowedLogoContentType(type)).toBe(true);
    });
  }

  it('rejects SVG in every spelling a provider might send', () => {
    expect(isAllowedLogoContentType('image/svg+xml')).toBe(false);
    expect(isAllowedLogoContentType('IMAGE/SVG+XML')).toBe(false);
    expect(isAllowedLogoContentType('image/svg+xml; charset=utf-8')).toBe(false);
    expect(isAllowedLogoContentType('image/svg')).toBe(false);
  });

  it('rejects image types the route cannot serve, rather than storing them', () => {
    // The bug this closes: `startsWith("image/")` accepted these, the row got a
    // logoUpdatedAt, and every list render then 404'd on the <img>.
    expect(isAllowedLogoContentType('image/gif')).toBe(false);
    expect(isAllowedLogoContentType('image/avif')).toBe(false);
    expect(isAllowedLogoContentType('image/bmp')).toBe(false);
    expect(isAllowedLogoContentType('image/tiff')).toBe(false);
  });

  it('rejects non-image types outright', () => {
    expect(isAllowedLogoContentType('text/html')).toBe(false);
    expect(isAllowedLogoContentType('text/plain;charset=US-ASCII')).toBe(false);
    expect(isAllowedLogoContentType('application/octet-stream')).toBe(false);
  });

  it('rejects a missing or empty content type', () => {
    expect(isAllowedLogoContentType(null)).toBe(false);
    expect(isAllowedLogoContentType(undefined)).toBe(false);
    expect(isAllowedLogoContentType('')).toBe(false);
  });

  it('tolerates parameters and casing on an allowed type', () => {
    expect(isAllowedLogoContentType('image/PNG')).toBe(true);
    expect(isAllowedLogoContentType('image/png;charset=binary')).toBe(true);
    expect(isAllowedLogoContentType('  image/png  ')).toBe(true);
  });
});

describe('parseLogoDataUri', () => {
  for (const type of LOGO_CONTENT_TYPES) {
    it(`parses a stored ${type} logo`, () => {
      expect(parseLogoDataUri(dataUri(type))).toEqual({ contentType: type, base64: PAYLOAD });
    });
  }

  it('refuses to serve a stored SVG even if one somehow reached the column', () => {
    // Defence in depth: the writer can no longer store this, but a row written
    // by an earlier build, by hand, or by a future bug must still not be served.
    expect(parseLogoDataUri(dataUri('image/svg+xml'))).toBeNull();
  });

  it('refuses to serve any type outside the allowlist', () => {
    expect(parseLogoDataUri(dataUri('image/gif'))).toBeNull();
    expect(parseLogoDataUri(dataUri('text/html'))).toBeNull();
  });

  it('normalises the content type it returns to lowercase', () => {
    expect(parseLogoDataUri(dataUri('IMAGE/PNG'))?.contentType).toBe('image/png');
  });

  it('returns null for null, empty and malformed input', () => {
    expect(parseLogoDataUri(null)).toBeNull();
    expect(parseLogoDataUri(undefined)).toBeNull();
    expect(parseLogoDataUri('')).toBeNull();
    expect(parseLogoDataUri('https://example.com/logo.png')).toBeNull();
    expect(parseLogoDataUri('data:image/png,not-base64-encoded')).toBeNull();
    expect(parseLogoDataUri(`data:image/png;base64,`)).toBeNull();
  });

  it('never lets a second type smuggled into the payload change what is served', () => {
    const parsed = parseLogoDataUri(`data:image/png;base64,${PAYLOAD}data:image/svg+xml;base64,x`);
    expect(parsed?.contentType).toBe('image/png');
  });

  it('accepts every type the writer can produce — the two sets are one set', () => {
    for (const type of LOGO_CONTENT_TYPES) {
      expect(isAllowedLogoContentType(type)).toBe(true);
      expect(parseLogoDataUri(dataUri(type))).not.toBeNull();
    }
  });
});

describe('LOGO_IMPORT_CANDIDATE_WHERE', () => {
  it('requires logoUrl to be null, so a row that already holds bytes is skipped', () => {
    // This is why the migration needs no backfill: a pre-existing hand-set
    // logoUrl with a null logoUpdatedAt is simply never a candidate, so the
    // importer cannot overwrite it.
    expect(LOGO_IMPORT_CANDIDATE_WHERE.logoUrl).toBeNull();
  });

  it('skips human-verified logos', () => {
    expect(LOGO_IMPORT_CANDIDATE_WHERE.logoVerified).toBe(false);
  });

  it('constrains on exactly those three keys and nothing more', () => {
    expect(Object.keys(LOGO_IMPORT_CANDIDATE_WHERE).sort()).toEqual([
      'OR',
      'logoUrl',
      'logoVerified',
    ]);
  });
});

/*
 * Domain identity from contact email.
 *
 * Measured on production 2026-08-14: of 438 companies, 9 carry a website but
 * 381 have a contact on a corporate email domain. Keying the importer on
 * `website` alone therefore reaches 2% of the book. The company's own people
 * are the identity we actually hold, so their email domain is the fallback.
 *
 * The whole risk here is free-mail: resolving a contact at gmail.com to a
 * "company domain" would stamp Google's favicon onto an unrelated company, and
 * because the importer only ever fills empty logos, that wrong logo then looks
 * settled. So the free-mail list is the load-bearing part of this function, not
 * the parsing.
 */
describe('domainFromEmail', () => {
  it('takes the domain from a corporate address', () => {
    expect(domainFromEmail('marco.rossi@barilla.com')).toBe('barilla.com');
  });

  it('lowercases and trims, since CRM data is hand-entered', () => {
    expect(domainFromEmail('  Marco@Barilla.COM ')).toBe('barilla.com');
  });

  it('drops a www. prefix so it matches the website-derived form', () => {
    expect(domainFromEmail('info@www.barilla.com')).toBe('barilla.com');
  });

  it('keeps multi-part corporate domains intact', () => {
    expect(domainFromEmail('a@sub.barilla.co.uk')).toBe('sub.barilla.co.uk');
  });

  it.each([
    'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.it', 'hotmail.com', 'hotmail.it',
    'yahoo.com', 'yahoo.it', 'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'proton.me',
    'gmx.de', 'web.de', 'libero.it', 'tiscali.it', 'alice.it', 'virgilio.it', 'live.com', 'msn.com',
  ])('refuses the free-mail domain %s', (domain) => {
    expect(domainFromEmail(`someone@${domain}`)).toBeNull();
  });

  it('refuses free-mail case-insensitively', () => {
    expect(domainFromEmail('Someone@GMAIL.COM')).toBeNull();
  });

  it.each(['', '   ', 'not-an-email', 'no-at-sign.com', 'a@', '@b.com', 'a@b'])(
    'returns null for malformed input %j',
    (value) => {
      expect(domainFromEmail(value)).toBeNull();
    },
  );

  it('returns null rather than throwing on null/undefined', () => {
    expect(domainFromEmail(null)).toBeNull();
    expect(domainFromEmail(undefined)).toBeNull();
  });
});

describe('LOGO_IMPORT_CANDIDATE_WHERE — reaches email-only companies', () => {
  it('accepts a company with a website OR a contact, not website only', () => {
    expect(LOGO_IMPORT_CANDIDATE_WHERE.OR).toEqual([
      { website: { not: null } },
      { contacts: { some: {} } },
    ]);
  });

  it('still never touches a hand-verified logo or an existing one', () => {
    expect(LOGO_IMPORT_CANDIDATE_WHERE.logoVerified).toBe(false);
    expect(LOGO_IMPORT_CANDIDATE_WHERE.logoUrl).toBeNull();
  });
});
