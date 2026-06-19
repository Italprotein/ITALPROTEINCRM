import createMiddleware from 'next-intl/middleware';
import { routing } from './lib/i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for API, Next internals and static files.
  matcher: ['/', '/(en|it)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
