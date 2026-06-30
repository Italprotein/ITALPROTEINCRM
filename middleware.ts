import createMiddleware from "next-intl/middleware";
import NextAuth from "next-auth";

import { routing } from "@/lib/i18n/routing";
import { authConfig } from "@/auth.config";

const intlMiddleware = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

// Compose Auth.js (Edge-safe, via authConfig — JWT verification only) with the
// next-intl locale middleware. Protected areas (/admin, /portal) require a
// session; everything else passes straight through to locale handling.
export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = Boolean(req.auth?.user);
  const segments = nextUrl.pathname.split("/");
  const locale = segments[1] === "it" ? "it" : "en";
  const area = segments[2];
  const isProtected = area === "admin" || area === "portal";

  // Real-auth enforcement activates only after the backend cutover
  // (NEXT_PUBLIC_DATA_MODE=api). In mock mode the prototype still uses the demo
  // login (localStorage), so enforcing a real session here would break it.
  const enforceAuth = process.env.NEXT_PUBLIC_DATA_MODE === "api";
  if (enforceAuth && isProtected && !isLoggedIn) {
    const loginUrl = new URL(`/${locale}/login`, nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return Response.redirect(loginUrl);
  }

  return intlMiddleware(req);
});

export const config = {
  // Match all pathnames except API, Next internals and static files.
  matcher: ["/", "/(en|it)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
