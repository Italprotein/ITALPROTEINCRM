import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware navigation primitives. Use these `Link`, `useRouter`,
 * `usePathname`, `redirect` instead of the next/* equivalents so locale
 * prefixes are handled automatically and language switches keep the route.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
