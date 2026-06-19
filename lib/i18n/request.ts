import { getRequestConfig } from 'next-intl/server';
import { routing, type Locale } from './routing';

/**
 * next-intl request config — resolves the active locale and loads its messages.
 * Messages live in /messages/{locale}.json so translators (and a future CMS)
 * can edit copy without touching components.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
