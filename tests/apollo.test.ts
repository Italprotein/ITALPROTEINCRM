import { describe, expect, it } from 'vitest';

import {
  apolloFailureFor,
  apolloPatchFor,
  companySizeFromHeadcount,
  companyTypeFromApollo,
  isEmptyPatch,
  isFatalApolloFailure,
  isoCountryFromName,
  narrowToGaps,
  parseApolloBulk,
  type CompanyGaps,
} from '@/lib/apollo';

/**
 * Taken from a live organizations/bulk_enrich response (four real domains from
 * the CRM, Sept 2026), reduced to the fields the mapper reads.
 */
const LIVE = {
  status: 'success',
  organizations: [
    {
      name: 'Chobani',
      primary_domain: 'chobani.com',
      website_url: 'http://www.chobani.com',
      linkedin_url: 'http://www.linkedin.com/company/chobani',
      industry: 'food & beverages',
      keywords: ['food & beverage services', 'food industry'],
      estimated_num_employees: 2400,
      city: 'New Berlin',
      state: 'New York',
      country: 'United States',
      short_description: 'Chobani is a food maker.',
    },
    {
      name: 'McCain Foods',
      primary_domain: 'mccain.com',
      website_url: 'http://www.mccain.com',
      industry: 'food production',
      keywords: ['food production', 'manufacturing', 'retail'],
      estimated_num_employees: 21000,
      city: 'Toronto',
      country: 'Canada',
    },
    {
      name: 'Azelis',
      primary_domain: 'azelis.com',
      industry: 'chemicals',
      keywords: ['specialty chemicals', 'distribution'],
      estimated_num_employees: 4400,
      city: 'Antwerpen',
      country: 'Belgium',
    },
    {
      name: 'Balocco',
      primary_domain: 'balocco.it',
      industry: 'food production',
      keywords: ['food', 'confectionery', 'b2c'],
      estimated_num_employees: 480,
      city: 'Fossano',
      country: 'Italy',
    },
  ],
};

describe('companyTypeFromApollo', () => {
  it('reads a food company as a food company', () => {
    expect(companyTypeFromApollo('food production', [])).toBe('food_manufacturer');
    expect(companyTypeFromApollo('food & beverages', [])).toBe('fb_manufacturer');
  });

  it('does not call a chemicals distributor a food manufacturer', () => {
    // This is the whole reason the outreach import refused to blanket-assign
    // fb_manufacturer: Azelis was in that list and is not a food producer.
    expect(companyTypeFromApollo('chemicals', ['specialty chemicals', 'distribution']))
      .toBe('ingredient_company');
  });

  it('sharpens a generic food label using the keywords', () => {
    expect(companyTypeFromApollo('food production', ['confectionery', 'b2c']))
      .toBe('confectionery_manufacturer');
    expect(companyTypeFromApollo('food production', ['bakery', 'bread']))
      .toBe('bakery_manufacturer');
    expect(companyTypeFromApollo('food & beverages', ['dairy', 'cheese']))
      .toBe('dairy_manufacturer');
  });

  it('returns null for a label it does not recognise, rather than guessing', () => {
    // A wrong type is worse than no type: it silently skews every by-type
    // chart, and nobody would know to check it.
    expect(companyTypeFromApollo('interstellar mining', [])).toBeNull();
    expect(companyTypeFromApollo(null, null)).toBeNull();
    expect(companyTypeFromApollo('', [])).toBeNull();
  });

  it('never lets keywords alone invent a type', () => {
    expect(companyTypeFromApollo('unknown industry', ['bakery', 'bread'])).toBeNull();
  });
});

describe('companySizeFromHeadcount', () => {
  it('bands headcount the way the EU SME definition does', () => {
    expect(companySizeFromHeadcount(4)).toBe('micro');
    expect(companySizeFromHeadcount(30)).toBe('small');
    expect(companySizeFromHeadcount(240)).toBe('medium');
    expect(companySizeFromHeadcount(480)).toBe('large');
    expect(companySizeFromHeadcount(21000)).toBe('enterprise');
  });

  it('says nothing when the number is missing or nonsense', () => {
    expect(companySizeFromHeadcount(null)).toBeNull();
    expect(companySizeFromHeadcount(0)).toBeNull();
    expect(companySizeFromHeadcount(-5)).toBeNull();
    expect(companySizeFromHeadcount(Number.NaN)).toBeNull();
  });
});

describe('isoCountryFromName', () => {
  it('maps the names Apollo actually returns', () => {
    expect(isoCountryFromName('United States')).toBe('US');
    expect(isoCountryFromName('Canada')).toBe('CA');
    expect(isoCountryFromName('Belgium')).toBe('BE');
    expect(isoCountryFromName('Italy')).toBe('IT');
    expect(isoCountryFromName('united kingdom')).toBe('GB');
  });

  it('returns null for a country it has no code for', () => {
    expect(isoCountryFromName('Atlantis')).toBeNull();
    expect(isoCountryFromName(null)).toBeNull();
  });
});

describe('apolloPatchFor, on the live payload', () => {
  const orgs = parseApolloBulk(LIVE);

  it('reads all four organizations', () => {
    expect(orgs).toHaveLength(4);
  });

  it('builds a full patch for a complete record', () => {
    expect(apolloPatchFor(orgs[0])).toMatchObject({
      type: 'fb_manufacturer',
      size: 'enterprise',
      city: 'New Berlin',
      country: 'United States',
      countryCode: 'US',
      website: 'https://www.chobani.com',
      linkedin: 'https://www.linkedin.com/company/chobani',
      description: 'Chobani is a food maker.',
    });
  });

  it('upgrades Apollo’s http links to https', () => {
    expect(apolloPatchFor(orgs[1]).website).toBe('https://www.mccain.com');
  });

  it('builds a partial patch when the record is partial', () => {
    // Balocco has no website_url or linkedin_url in this payload.
    const patch = apolloPatchFor(orgs[3]);
    expect(patch.type).toBe('confectionery_manufacturer');
    expect(patch.countryCode).toBe('IT');
    expect(patch.website).toBeUndefined();
    expect(patch.linkedin).toBeUndefined();
  });

  it('returns nothing for a shape it does not recognise, instead of throwing', () => {
    expect(parseApolloBulk(null)).toEqual([]);
    expect(parseApolloBulk({})).toEqual([]);
    expect(parseApolloBulk({ organizations: 'nope' })).toEqual([]);
  });
});

describe('narrowToGaps', () => {
  const full = apolloPatchFor(parseApolloBulk(LIVE)[0]);

  const gaps = (over: Partial<CompanyGaps> = {}): CompanyGaps => ({
    type: 'other',
    size: null,
    city: '',
    countryCode: 'XX',
    website: null,
    linkedin: null,
    description: null,
    logoUpdatedAt: null,
    ...over,
  });

  it('fills every blank on an untouched imported company', () => {
    const out = narrowToGaps(full, gaps());
    expect(out.type).toBe('fb_manufacturer');
    expect(out.city).toBe('New Berlin');
    expect(out.countryCode).toBe('US');
    expect(out.website).toBe('https://www.chobani.com');
  });

  it('never overwrites something a person already set', () => {
    // Apollo is evidence, but weaker than anything typed by hand.
    const out = narrowToGaps(
      full,
      gaps({
        type: 'dairy_manufacturer',
        city: 'Milano',
        countryCode: 'IT',
        website: 'https://chosen-by-hand.example',
        linkedin: 'https://linkedin.com/company/by-hand',
        description: 'Written by the account owner.',
      }),
    );
    expect(out.type).toBeUndefined();
    expect(out.city).toBeUndefined();
    expect(out.countryCode).toBeUndefined();
    expect(out.website).toBeUndefined();
    expect(out.linkedin).toBeUndefined();
    expect(out.description).toBeUndefined();
  });

  it('treats "other" and "XX" as blanks, because that is what they mean', () => {
    // The outreach importer writes both as placeholders for "unknown".
    const out = narrowToGaps(full, gaps({ type: 'other', countryCode: 'XX' }));
    expect(out.type).toBe('fb_manufacturer');
    expect(out.countryCode).toBe('US');
  });

  it('leaves a company with a real logo alone', () => {
    const out = narrowToGaps(
      { ...full, logoUrl: 'https://cdn.example/logo.png' },
      gaps({ logoUpdatedAt: new Date('2026-08-01') }),
    );
    expect(out.logoUrl).toBeUndefined();
  });

  it('produces an empty patch when there is nothing to fill', () => {
    const out = narrowToGaps(
      full,
      gaps({
        type: 'fb_manufacturer',
        size: 'enterprise',
        city: 'New Berlin',
        countryCode: 'US',
        website: 'https://www.chobani.com',
        linkedin: 'https://x',
        description: 'set',
      }),
    );
    expect(isEmptyPatch(out)).toBe(true);
  });
});

describe('failure classification', () => {
  it('separates a bad key from an endpoint outside the plan', () => {
    // 403 is what people/match returns on the free tier — a permanent fact
    // about the plan, not a credential problem.
    expect(apolloFailureFor(401)).toBe('unauthorized');
    expect(apolloFailureFor(403)).toBe('forbidden');
    expect(apolloFailureFor(429)).toBe('rate_limited');
    expect(apolloFailureFor(503)).toBe('unavailable');
  });

  it('stops the run on anything the next call would hit too', () => {
    expect(isFatalApolloFailure('unauthorized')).toBe(true);
    expect(isFatalApolloFailure('forbidden')).toBe(true);
    expect(isFatalApolloFailure('rate_limited')).toBe(true);
    expect(isFatalApolloFailure('unavailable')).toBe(false);
    expect(isFatalApolloFailure('network')).toBe(false);
  });
});
