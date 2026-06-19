import { defineRouting } from 'next-intl/routing';

/**
 * Locale routing for ITALPROTEIN CRM.
 * English + Italian are first-class. The locale always prefixes the path so a
 * language switch can preserve the rest of the route (and any selected record).
 */
export const routing = defineRouting({
  locales: ['en', 'it'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

export const localeNames: Record<Locale, { label: string; flag: string }> = {
  en: { label: 'English', flag: '🇬🇧' },
  it: { label: 'Italiano', flag: '🇮🇹' },
};
