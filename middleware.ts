import createMiddleware from "next-intl/middleware";
import NextAuth from "next-auth";

import { routing } from "@/lib/i18n/routing";
import { authConfig } from "@/auth.config";
import { isApiMode } from "@/lib/data-mode";

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

  // Production always enforces real auth. Development may still opt into the
  // fixture/localStorage demo with NEXT_PUBLIC_DATA_MODE=mock.
  const enforceAuth = isApiMode;
  if (enforceAuth && isProtected && !isLoggedIn) {
    const loginPath = area === "admin" ? "team-login" : "login";
    const loginUrl = new URL(`/${locale}/${loginPath}`, nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return Response.redirect(loginUrl);
  }

  if (enforceAuth && isProtected && isLoggedIn) {
    const kind = req.auth?.user?.kind;
    if (area === "admin" && kind !== "internal") {
      return Response.redirect(new URL(`/${locale}/portal`, nextUrl));
    }
    if (area === "portal" && kind !== "external") {
      return Response.redirect(new URL(`/${locale}/admin`, nextUrl));
    }
  }

  return intlMiddleware(req);
});

export const config = {
  // Match all pathnames except API, Next internals and static files.
  matcher: ["/", "/(en|it)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
