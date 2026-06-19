import type { Company } from '@/lib/types';

/**
 * Distributor / agency partner companies (ids c_ag_*). These are FULL Company
 * objects (so they render anywhere a Company is expected) with type
 * 'distributor' or 'agency' and territory / distributionMarkets / cooperationModel
 * set. AGENCY_META carries the partner-network metadata keyed by company id.
 *
 * Note: c_ag_prinova / c_ag_disproquima are the *partner-network* records and are
 * distinct from the pipeline companies c_prinova / c_disproquima in companies.ts.
 */
export const AGENCY_COMPANIES: Company[] = [
  {
    id: 'c_ag_prinova', legalName: 'Prinova Europe Ltd', tradingName: 'Prinova', type: 'distributor', subtype: 'Global ingredient distributor',
    description: 'Global ingredient & premix distributor — partner-network record.',
    website: 'https://www.prinovaglobal.com', vatNumber: 'GB 712345679', initials: 'PN',
    headquarters: { line1: 'Towers Business Park', city: 'Stockport', postalCode: 'SK4 3GN', country: 'United Kingdom', countryCode: 'GB' },
    country: 'United Kingdom', countryCode: 'GB', city: 'Stockport', timezone: 'Europe/London',
    preferredLanguage: 'en', preferredCurrency: 'GBP', size: 'large', mainActivity: 'Ingredients & premixes',
    leadSource: 'event', firstContact: { date: '2026-04-12', channel: 'event', personName: 'Daniel Price' },
    accountOwnerId: 'u_ludwig', territory: 'UK & Ireland', distributionMarkets: ['United Kingdom', 'Ireland'],
    cooperationModel: 'distribution', relationshipStage: 'qualified', priority: 'medium',
    ndaStatus: 'under_review', tags: ['partner', 'distributor'], createdAt: '2026-04-12',
  },
  {
    id: 'c_ag_disproquima', legalName: 'Disproquima S.L.', tradingName: 'Disproquima', type: 'distributor', subtype: 'Ingredient distributor',
    description: 'Spanish ingredient distributor — partner-network record (Iberia).',
    website: 'https://www.disproquima.com', vatNumber: 'ESB60123457', initials: 'DQ',
    headquarters: { line1: "Carrer de l'Acer", city: 'Barcelona', postalCode: '08038', country: 'Spain', countryCode: 'ES' },
    country: 'Spain', countryCode: 'ES', city: 'Barcelona', region: 'Cataluña', timezone: 'Europe/Madrid',
    preferredLanguage: 'en', preferredCurrency: 'EUR', size: 'medium', mainActivity: 'Food ingredient distribution',
    leadSource: 'partner', firstContact: { date: '2026-01-31', channel: 'email', personName: 'Marta Soler' },
    accountOwnerId: 'u_ludwig', territory: 'Iberia', distributionMarkets: ['Spain', 'Portugal'],
    cooperationModel: 'distribution', relationshipStage: 'commercial_discussion', priority: 'high',
    ndaStatus: 'fully_signed', tags: ['partner', 'distributor'], createdAt: '2026-01-31',
  },
  {
    id: 'c_ag_imcd', legalName: 'IMCD Italia S.p.A.', tradingName: 'IMCD Italy', type: 'distributor', subtype: 'Speciality ingredient distributor',
    description: 'Italian arm of IMCD; speciality food ingredient distribution.',
    website: 'https://www.imcdgroup.com', vatNumber: 'IT 09876540151', initials: 'IM',
    headquarters: { line1: 'Via XXV Aprile 4', city: 'Sesto San Giovanni', region: 'MI', postalCode: '20099', country: 'Italy', countryCode: 'IT' },
    country: 'Italy', countryCode: 'IT', city: 'Sesto San Giovanni', region: 'Lombardia', timezone: 'Europe/Rome',
    preferredLanguage: 'it', preferredCurrency: 'EUR', size: 'large', mainActivity: 'Speciality ingredient distribution',
    leadSource: 'referral', firstContact: { date: '2026-03-05', channel: 'email', personName: 'Alessandro Bruni' },
    accountOwnerId: 'u_giuseppe', territory: 'Italy', distributionMarkets: ['Italy'],
    cooperationModel: 'distribution', relationshipStage: 'interested', priority: 'medium',
    ndaStatus: 'to_prepare', tags: ['partner', 'distributor'], createdAt: '2026-03-05',
  },
  {
    id: 'c_ag_brenntag', legalName: 'Brenntag France SAS', tradingName: 'Brenntag France', type: 'distributor', subtype: 'Chemical & ingredient distributor',
    description: 'French distribution arm of Brenntag; food ingredients.',
    website: 'https://www.brenntag.com', vatNumber: 'FR 33 552012345', initials: 'BR',
    headquarters: { line1: '21 rue du Pré Gauchet', city: 'Nantes', postalCode: '44000', country: 'France', countryCode: 'FR' },
    country: 'France', countryCode: 'FR', city: 'Nantes', timezone: 'Europe/Paris',
    preferredLanguage: 'en', preferredCurrency: 'EUR', size: 'large', mainActivity: 'Ingredient distribution',
    leadSource: 'partner', firstContact: { date: '2026-02-18', channel: 'email', personName: 'Camille Lefèvre' },
    accountOwnerId: 'u_ludwig', territory: 'France', distributionMarkets: ['France', 'Benelux'],
    cooperationModel: 'distribution', relationshipStage: 'qualified', priority: 'medium',
    ndaStatus: 'sent', tags: ['partner', 'distributor'], createdAt: '2026-02-18',
  },
  {
    id: 'c_ag_azelis', legalName: 'Azelis Iberia S.L.', tradingName: 'Azelis Iberia', type: 'distributor', subtype: 'Speciality distributor',
    description: 'Speciality chemicals & food ingredient distributor for Iberia.',
    website: 'https://www.azelis.com', vatNumber: 'ESB12345678', initials: 'AZ',
    headquarters: { line1: 'Calle de la Ciencia 12', city: 'Madrid', postalCode: '28021', country: 'Spain', countryCode: 'ES' },
    country: 'Spain', countryCode: 'ES', city: 'Madrid', timezone: 'Europe/Madrid',
    preferredLanguage: 'en', preferredCurrency: 'EUR', size: 'large', mainActivity: 'Speciality ingredient distribution',
    leadSource: 'event', firstContact: { date: '2026-04-02', channel: 'event', personName: 'Pablo Ruiz' },
    accountOwnerId: 'u_ludwig', territory: 'Iberia', distributionMarkets: ['Spain', 'Portugal'],
    cooperationModel: 'distribution', relationshipStage: 'lead', priority: 'low',
    ndaStatus: 'not_required', tags: ['partner', 'distributor'], createdAt: '2026-04-02',
  },
  {
    id: 'c_ag_barentz', legalName: 'Barentz GmbH', tradingName: 'Barentz DACH', type: 'distributor', subtype: 'Life-science ingredient distributor',
    description: 'DACH ingredient distributor; food & nutrition portfolio.',
    website: 'https://www.barentz.com', vatNumber: 'DE 312345678', initials: 'BZ',
    headquarters: { line1: 'Hansaallee 201', city: 'Düsseldorf', postalCode: '40549', country: 'Germany', countryCode: 'DE' },
    country: 'Germany', countryCode: 'DE', city: 'Düsseldorf', region: 'Nordrhein-Westfalen', timezone: 'Europe/Berlin',
    preferredLanguage: 'en', preferredCurrency: 'EUR', size: 'large', mainActivity: 'Food & nutrition ingredient distribution',
    leadSource: 'partner', firstContact: { date: '2026-02-25', channel: 'email', personName: 'Lena Schäfer' },
    accountOwnerId: 'u_ludwig', territory: 'DACH', distributionMarkets: ['Germany', 'Austria', 'Switzerland'],
    cooperationModel: 'distribution', relationshipStage: 'commercial_discussion', priority: 'high',
    ndaStatus: 'fully_signed', tags: ['partner', 'distributor', 'strategic'], createdAt: '2026-02-25',
  },
  {
    id: 'c_ag_quimdis', legalName: 'Quimdis SAS', tradingName: 'Quimdis', type: 'agency', subtype: 'Ingredient sourcing agency',
    description: 'French sourcing agency for food & nutrition ingredients.',
    website: 'https://www.quimdis.com', vatNumber: 'FR 12 391234567', initials: 'QD',
    headquarters: { line1: '12 rue de la Paix', city: 'Levallois-Perret', postalCode: '92300', country: 'France', countryCode: 'FR' },
    country: 'France', countryCode: 'FR', city: 'Levallois-Perret', timezone: 'Europe/Paris',
    preferredLanguage: 'en', preferredCurrency: 'EUR', size: 'medium', mainActivity: 'Ingredient sourcing & agency',
    leadSource: 'referral', firstContact: { date: '2026-03-20', channel: 'email', personName: 'Antoine Girard' },
    accountOwnerId: 'u_ludwig', territory: 'France', distributionMarkets: ['France'],
    cooperationModel: 'agency', relationshipStage: 'interested', priority: 'low',
    ndaStatus: 'to_prepare', tags: ['partner', 'agency'], createdAt: '2026-03-20',
  },
  {
    id: 'c_ag_gillco', legalName: 'Gillco Ingredients Inc.', tradingName: 'Gillco Ingredients', type: 'distributor', subtype: 'Nutritional ingredient distributor',
    description: 'US nutritional ingredient distributor.',
    website: 'https://www.gillco.com', vatNumber: 'US 95-1234567', initials: 'GC',
    headquarters: { line1: '7150 Convoy Court', city: 'San Diego', region: 'CA', postalCode: '92111', country: 'United States', countryCode: 'US' },
    country: 'United States', countryCode: 'US', city: 'San Diego', timezone: 'America/Los_Angeles',
    preferredLanguage: 'en', preferredCurrency: 'USD', size: 'medium', mainActivity: 'Nutritional ingredient distribution',
    leadSource: 'event', firstContact: { date: '2026-04-10', channel: 'event', personName: 'Brian Carter' },
    accountOwnerId: 'u_ludwig', territory: 'North America (West)', distributionMarkets: ['United States', 'Canada'],
    cooperationModel: 'distribution', relationshipStage: 'lead', priority: 'low',
    ndaStatus: 'not_required', tags: ['partner', 'distributor', 'americas'], createdAt: '2026-04-10',
  },
  {
    id: 'c_ag_connoils', legalName: 'Connoils LLC', tradingName: 'Connoils', type: 'distributor', subtype: 'Speciality ingredient distributor',
    description: 'US speciality ingredient distributor.',
    website: 'https://www.connoils.com', vatNumber: 'US 39-2345678', initials: 'CN',
    headquarters: { line1: 'W227N6275 Sussex Rd', city: 'Big Bend', region: 'WI', postalCode: '53103', country: 'United States', countryCode: 'US' },
    country: 'United States', countryCode: 'US', city: 'Big Bend', timezone: 'America/Chicago',
    preferredLanguage: 'en', preferredCurrency: 'USD', size: 'small', mainActivity: 'Speciality ingredient distribution',
    leadSource: 'inbound_web', firstContact: { date: '2026-05-01', channel: 'inbound_web', personName: 'Sarah Nolan' },
    accountOwnerId: 'u_ludwig', territory: 'North America', distributionMarkets: ['United States'],
    cooperationModel: 'distribution', relationshipStage: 'lead', priority: 'low',
    ndaStatus: 'not_required', tags: ['partner', 'distributor', 'americas'], createdAt: '2026-05-01',
  },
  {
    id: 'c_ag_univar', legalName: 'Univar Solutions B.V.', tradingName: 'Univar Solutions', type: 'distributor', subtype: 'Global distributor',
    description: 'Global chemical & ingredient distributor; food & beverage portfolio.',
    website: 'https://www.univarsolutions.com', vatNumber: 'NL 812345678B01', initials: 'UV',
    headquarters: { line1: 'Beneluxlaan 9', city: 'Utrecht', postalCode: '3527', country: 'Netherlands', countryCode: 'NL' },
    country: 'Netherlands', countryCode: 'NL', city: 'Utrecht', timezone: 'Europe/Amsterdam',
    preferredLanguage: 'en', preferredCurrency: 'EUR', size: 'enterprise', mainActivity: 'Ingredient distribution',
    leadSource: 'partner', firstContact: { date: '2026-03-28', channel: 'email', personName: 'Mark de Vries' },
    accountOwnerId: 'u_ludwig', territory: 'Benelux & EU', distributionMarkets: ['Netherlands', 'Belgium', 'EU'],
    cooperationModel: 'distribution', relationshipStage: 'qualified', priority: 'medium',
    ndaStatus: 'sent', tags: ['partner', 'distributor'], createdAt: '2026-03-28',
  },
  {
    id: 'c_ag_nactis', legalName: 'Nactis Flavours SAS', tradingName: 'Nactis', type: 'agency', subtype: 'Flavour & ingredient partner',
    description: 'French flavour house & ingredient partner for co-formulation.',
    website: 'https://www.nactis.fr', vatNumber: 'FR 21 481234567', initials: 'NC',
    headquarters: { line1: 'ZA des Aulnaies', city: 'Ormes', postalCode: '45140', country: 'France', countryCode: 'FR' },
    country: 'France', countryCode: 'FR', city: 'Ormes', timezone: 'Europe/Paris',
    preferredLanguage: 'en', preferredCurrency: 'EUR', size: 'medium', mainActivity: 'Flavours & co-formulation',
    leadSource: 'event', firstContact: { date: '2026-04-22', channel: 'event', personName: 'Hélène Marchand' },
    accountOwnerId: 'u_ludwig', territory: 'France', distributionMarkets: ['France'],
    cooperationModel: 'agency', relationshipStage: 'interested', priority: 'low',
    ndaStatus: 'to_prepare', tags: ['partner', 'agency'], createdAt: '2026-04-22',
  },
  {
    id: 'c_ag_ravago', legalName: 'Ravago Chemicals Italy S.p.A.', tradingName: 'Ravago Chemicals', type: 'distributor', subtype: 'Distributor',
    description: 'Italian distribution partner for food ingredients.',
    website: 'https://www.ravago.com', vatNumber: 'IT 04561230963', initials: 'RV',
    headquarters: { line1: 'Via San Bovio 3', city: 'Segrate', region: 'MI', postalCode: '20090', country: 'Italy', countryCode: 'IT' },
    country: 'Italy', countryCode: 'IT', city: 'Segrate', region: 'Lombardia', timezone: 'Europe/Rome',
    preferredLanguage: 'it', preferredCurrency: 'EUR', size: 'large', mainActivity: 'Ingredient distribution',
    leadSource: 'referral', firstContact: { date: '2026-05-12', channel: 'email', personName: 'Giorgio Fontana' },
    accountOwnerId: 'u_giuseppe', territory: 'Italy', distributionMarkets: ['Italy'],
    cooperationModel: 'distribution', relationshipStage: 'lead', priority: 'low',
    ndaStatus: 'not_required', tags: ['partner', 'distributor'], createdAt: '2026-05-12',
  },
];

export const AGENCY_META: Record<
  string,
  {
    territory: string;
    countriesCovered: string[];
    agencyType: string;
    agreementStatus: 'none' | 'draft' | 'active' | 'expired';
    companiesIntroducedIds: string[];
    activeLeads: number;
    conversionRate: number;
    lastInteractionAt: string;
    nextAction?: { label: string; dueDate?: string };
  }
> = {
  c_ag_prinova: {
    territory: 'UK & Ireland', countriesCovered: ['United Kingdom', 'Ireland'], agencyType: 'distributor',
    agreementStatus: 'draft', companiesIntroducedIds: ['c_proteinworks', 'c_suntory'], activeLeads: 2, conversionRate: 0.25,
    lastInteractionAt: '2026-05-31', nextAction: { label: 'Finalise distribution NDA', dueDate: '2026-06-24' },
  },
  c_ag_disproquima: {
    territory: 'Iberia', countriesCovered: ['Spain', 'Portugal'], agencyType: 'distributor',
    agreementStatus: 'active', companiesIntroducedIds: ['c_innofoods'], activeLeads: 3, conversionRate: 0.4,
    lastInteractionAt: '2026-06-12', nextAction: { label: 'Draft distribution terms', dueDate: '2026-06-28' },
  },
  c_ag_imcd: {
    territory: 'Italy', countriesCovered: ['Italy'], agencyType: 'distributor',
    agreementStatus: 'draft', companiesIntroducedIds: ['c_galbusera', 'c_colussi'], activeLeads: 2, conversionRate: 0.2,
    lastInteractionAt: '2026-05-20', nextAction: { label: 'Send partner deck', dueDate: '2026-06-25' },
  },
  c_ag_brenntag: {
    territory: 'France', countriesCovered: ['France', 'Belgium', 'Luxembourg', 'Netherlands'], agencyType: 'distributor',
    agreementStatus: 'draft', companiesIntroducedIds: ['c_yoplait', 'c_funkyveggie'], activeLeads: 4, conversionRate: 0.18,
    lastInteractionAt: '2026-06-02', nextAction: { label: 'Chase NDA signature', dueDate: '2026-06-22' },
  },
  c_ag_azelis: {
    territory: 'Iberia', countriesCovered: ['Spain', 'Portugal'], agencyType: 'distributor',
    agreementStatus: 'none', companiesIntroducedIds: [], activeLeads: 0, conversionRate: 0,
    lastInteractionAt: '2026-04-02', nextAction: { label: 'Qualify partnership fit', dueDate: '2026-06-30' },
  },
  c_ag_barentz: {
    territory: 'DACH', countriesCovered: ['Germany', 'Austria', 'Switzerland'], agencyType: 'distributor',
    agreementStatus: 'active', companiesIntroducedIds: ['c_ehrmann', 'c_layenberger', 'c_emmi', 'c_nom'], activeLeads: 5, conversionRate: 0.35,
    lastInteractionAt: '2026-06-11', nextAction: { label: 'Quarterly partner review', dueDate: '2026-07-05' },
  },
  c_ag_quimdis: {
    territory: 'France', countriesCovered: ['France'], agencyType: 'agency',
    agreementStatus: 'none', companiesIntroducedIds: ['c_bel'], activeLeads: 1, conversionRate: 0.1,
    lastInteractionAt: '2026-03-20', nextAction: { label: 'Prepare agency agreement', dueDate: '2026-07-10' },
  },
  c_ag_gillco: {
    territory: 'North America (West)', countriesCovered: ['United States', 'Canada'], agencyType: 'distributor',
    agreementStatus: 'none', companiesIntroducedIds: [], activeLeads: 0, conversionRate: 0,
    lastInteractionAt: '2026-04-10', nextAction: { label: 'Initial qualification call', dueDate: '2026-07-01' },
  },
  c_ag_connoils: {
    territory: 'North America', countriesCovered: ['United States'], agencyType: 'distributor',
    agreementStatus: 'none', companiesIntroducedIds: [], activeLeads: 0, conversionRate: 0,
    lastInteractionAt: '2026-05-01',
  },
  c_ag_univar: {
    territory: 'Benelux & EU', countriesCovered: ['Netherlands', 'Belgium', 'Germany', 'France'], agencyType: 'distributor',
    agreementStatus: 'draft', companiesIntroducedIds: ['c_nutrimuscle', 'c_funkyfat'], activeLeads: 2, conversionRate: 0.15,
    lastInteractionAt: '2026-05-25', nextAction: { label: 'Follow up on NDA', dueDate: '2026-06-26' },
  },
  c_ag_nactis: {
    territory: 'France', countriesCovered: ['France'], agencyType: 'agency',
    agreementStatus: 'none', companiesIntroducedIds: [], activeLeads: 1, conversionRate: 0,
    lastInteractionAt: '2026-04-22', nextAction: { label: 'Explore co-formulation scope', dueDate: '2026-07-08' },
  },
  c_ag_ravago: {
    territory: 'Italy', countriesCovered: ['Italy'], agencyType: 'distributor',
    agreementStatus: 'none', companiesIntroducedIds: [], activeLeads: 0, conversionRate: 0,
    lastInteractionAt: '2026-05-12', nextAction: { label: 'Send intro materials', dueDate: '2026-06-29' },
  },
};

export function getAgencyCompanies(): Company[] {
  return AGENCY_COMPANIES;
}
