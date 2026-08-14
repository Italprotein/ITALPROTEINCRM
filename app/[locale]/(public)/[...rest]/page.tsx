import { notFound } from 'next/navigation';

// Mirrors `app/[locale]/admin/[...rest]/page.tsx` for the public surface. The
// landing page and the six auth screens are the whole public site, so any other
// `/:locale/...` path is a genuine 404 — but without this route Next answered
// those paths with its own unstyled framework 404, outside the locale layout
// and therefore in the wrong language. Routing it through `notFound()` sends it
// to `app/[locale]/not-found.tsx`, the branded boundary the rest of the app
// already uses.
//
// Static segments win over a catch-all in Next's route ranking, so /admin,
// /portal, /login and friends are unaffected by this file.
export default function PublicCatchAll() {
  notFound();
}
