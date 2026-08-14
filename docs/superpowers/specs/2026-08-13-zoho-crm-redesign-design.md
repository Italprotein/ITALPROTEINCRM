# Zoho-Simplicity CRM Redesign + Public Expressiveness — Design

Date: 2026-08-13 · Author: Claude (brief supplied and pre-approved by Giuseppe
Minelli in chat; the brief is the binding requirements document, this spec
records the decisions taken against the existing codebase).

## Intent

Two related but visually different moves:

1. **Internal CRM** → Zoho-level simplicity: module → list → record → related
   info → action. Dense, fast, obvious. Micro-interactions only.
2. **Public surface** → more expressive: premium, animated (restrained,
   scientific — not crypto), Aceternity-inspired where it earns its place.

Priority order (binding): data/functionality safety > CRM usability >
simplicity > accessibility > performance > visual polish > animation.

## What already exists (recon evidence — do not rebuild)

- Sidebar with groups, RBAC filtering (`canView`), collapse + tooltips,
  mobile drawer, active rail: `components/navigation/sidebar.tsx`,
  `nav-config.ts` (7 groups, 22 items).
- Topbar with Cmd/Ctrl+K `GlobalSearch` across 8 entity types (companies,
  agencies, contacts, NDAs, samples, shipments, documents, tasks), keyboard
  navigation, grouped results: `components/navigation/global-search.tsx`.
  Gap: its UI strings are hardcoded English; no quick-create.
- Theme toggle with persistence (`ui:theme`), anti-flash script, tokens for
  light/dark in `app/globals.css`.
- `Company.logoUrl`, `Company.initials`, `Company.accentColor` already in the
  Prisma schema; avatar upload endpoints exist (pattern to copy for logos).
- Docker entrypoint runs `prisma migrate deploy` on every boot → additive
  migrations apply automatically on deploy.
- Public page: 59 map pins with localized labels, partner marquee (seam
  verified), journey list, tinted bands. All in the do-not-regress list.

## Key measured facts driving the design

- `/it` document is ~2.6 MB. Two costs: (a) ALL 51 i18n namespaces serialized
  into public HTML by `app/[locale]/layout.tsx` (`getMessages()` unfiltered);
  (b) the world map inlines the dotted-map SVG TWICE (light+dark) as data
  URIs in the HTML.
- Local dev DB is api-mode; Docker Desktop on this machine stops on its own —
  visual verification uses `NEXT_PUBLIC_DATA_MODE=mock` dev server instead
  (mock services are fully seeded; login is email-only in mock mode).
- npm-version lockfile trap (hit twice historically): NO new npm dependencies
  in this redesign. Playwright is installed in the session scratchpad, not in
  the repo. Aceternity patterns are adapted as owned components (the repo
  already vendors them under components/ui), motion via existing
  framer-motion/motion deps.

## Decisions

### D1 — Public payload (the "2.6 MB" fix, done properly)

Route groups, provider scoping, and the map SVG moved out of HTML:

- `app/[locale]/(public)/…` ← landing `page.tsx`, `login`, `team-login`,
  `register`, `verify`, `forgot-password`, `activate`, plus a group
  `not-found.tsx`. Its `layout.tsx` provides `NextIntlClientProvider` with
  ONLY the public namespace set (computed by script, verified by grep in CI
  of the task).
- `app/[locale]/(app)/…` ← `admin`, `portal`. Its `layout.tsx` provides the
  full catalogue (portal scoping is a follow-up, recorded in the report).
- Root `[locale]/layout.tsx` keeps html/body/fonts/theme-script and any
  provider that does NOT serialize messages. If Toaster/providers consume
  intl, they move into the group layouts (recon Q2 decides).
- World map: the dotted-map SVG is generated once at build time by a script
  into `public/marketing/world-dots.svg`; the component paints it via CSS
  `mask-image` with `background-color` driven by theme tokens — one asset,
  both themes, zero HTML weight, cacheable. Pins/labels/tooltips unchanged.
- Measured before/after (document bytes, namespace count, admin-string
  absence) goes in the final report.

### D2 — Admin accessibility

Sweep the authenticated CRM for AA failures in both themes; the public
surface was fixed in 1cfa364. Known offenders: `text-destructive` /
`text-danger` as copy on dark surfaces (2.9–3.1:1) → `text-danger-text`
token (exists); any `focus-visible:ring-brand-gold` remnants → `ring-ring`;
`text-warning`/`text-success` as copy on subtle fills get `-text` variants
added and applied where failing, measured by the same WCAG script used in
1cfa364. Filled chips (`bg-danger text-danger-foreground` etc.) stay.

### D3 — Navigation IA (Zoho five-group model)

`nav-config.ts` regrouped from 7 groups to 5 (labels via existing Nav
namespace, new keys added it+en):

- **Main**: Overview, Companies, Contacts, Pipeline, Tasks, Calendar
- **Operations**: Samples, Shipments, NDAs, Feedback, Projects, Products
- **Intelligence**: Analytics, Communications, Activities
- **Partnerships**: Agencies, Registrations
- **Administration** (role-gated already): Users, Import/Export,
  Integrations, Settings, Audit, Finance*

*Finance placement decided at implementation against `lib/permissions.ts`
sections; if finance is a commercial-role section it stays under Operations.

Sidebar gains per-group collapse (chevron, persisted per group in
localStorage under `ui:nav-groups`), preserving RBAC filtering, tooltips,
mobile drawer. Active-item indicator gets a soft 150ms transition. No
routes change.

### D4 — Top bar: quick-create and search polish

- New `QuickCreate` (+) menu in the topbar: Company, Contact, Task —
  linking to the existing create affordances recon Q6 finds (dialog or
  route). No new backend.
- `GlobalSearch` UI strings i18n'd (new `Search` namespace keys it+en),
  group labels via existing `Nav` keys where possible.
- Recent records: the palette shows the last 8 visited records (stored
  client-side `ui:recent-records`, written by company/agency/sample/shipment
  detail pages) when the query is empty — replaces the current empty-state
  sentence.

### D5 — Companies module (flagship list)

Keep the existing page's data flow (mock|api services). Add, in order of
user value:

1. **Saved views** — compact dropdown (not tabs) left of the search box:
   All companies, My companies, Recently contacted (≤7d), No activity 10+
   days (reuses `lib/follow-up.ts` quiet logic), NDA pending, NDA signed,
   Samples sent, Active customers, Distributors, Europe, Middle East, ANZ.
   Views are client-side predicates over the loaded list (the page already
   loads the list); selection persisted in `ui:companies-view`.
2. **Action bar** — one row: view switcher · search · filter · sort ·
   column visibility (if cheap with existing table) · Import (links to
   existing import-export page) · `+ Company`.
3. **Table polish** — sticky header, density, row hover, tabular numerals,
   status chips using the shared mapping, pagination if the page lacks it.
4. **CompanyLogo component** — renders `logoUrl` if set else colored
   initials (uses `initials` + `accentColor` fields); used in list rows,
   detail header, and search results.

### D6 — Logo pipeline (schema + fetch + admin op)

- Additive migration: `logoSource String?`, `logoVerified Boolean @default(false)`,
  `logoUpdatedAt DateTime?` on Company. No destructive change.
- Fetch chain (server-side only, never at render): company domain (from
  `website`) → Google favicon service (128px) → DuckDuckGo icons →
  give up → initials fallback (client component). Bytes stored via the same
  mechanism the avatar endpoints use (recon Q7).
- Admin operation "Import missing logos" on the companies page (visible to
  admin roles): server action iterating companies with a domain and no
  verified logo; skips `logoVerified`. Auto-fetch fire-and-forget on company
  create when a website is present.
- If external fetch fails or no domain: initials. No cron, no external dep.

### D7 — Home dashboard (answer "what do I do today?" in 5s)

`operational-overview.tsx` restructured to: **My Day** (tasks due today,
overdue, calendar events today) · **Needs Attention** (follow-up candidates
≥10d quiet, NDAs pending, samples awaiting feedback) · **Pipeline** mini
(stage counts bar) · **Recent activity** (existing feed, trimmed) · **KPI
row** (4 numbers max). Amine's bespoke dashboard is untouched.

### D8 — Public expressiveness (restrained)

- Hero: dot-grid + radial glow backdrop (CSS only), pointer-tracking
  spotlight on the hero figure (small client wrapper, `motion-safe` only).
- Offer cards → bento treatment: border-gradient hover, slight lift, icon
  micro-animation. CSS-first.
- Partner logos: grayscale→color on hover, existing marquee kept.
- CTA band: animated gradient sheen (CSS keyframe, respects reduced motion).
- Map pins: entrance stagger kept, pulse kept subtle (existing map-pulse).
- No new deps; Aceternity patterns re-implemented small.

### D9 — Motion language (one table, applied everywhere touched)

- entrance: fade-up 400ms editorial ease, staggered ≤80ms — existing tokens
- hover: 150ms color/border/shadow
- modals: 160ms scale+fade (existing GlobalSearch values are the reference)
- sidebar collapse: 200ms width (existing)
- tables: hover only, no entrance animation
- reduced motion: all of the above collapse to opacity or nothing
  (`motion-safe:` discipline, `MotionConfig reducedMotion="user"` exists)

### D10 — Visual verification (rendered, not structural)

Playwright installed in the scratchpad (NOT the repo). Dev server in mock
mode. Screenshot matrix: public `/it`, `/it/login` (light+dark ×
390/1100/1440) and authenticated dashboard, companies, company detail,
contacts, pipeline, samples, NDAs, shipments, settings (light+dark ×
390/1440). I read the key screenshots and fix defects before deploy.

### D11 — Ship

Branch `worktree-crm-zoho-redesign` → merge into `backend-phase-1` → push
`backend-phase-1` + `main` → SSH deploy (existing procedure) → live
verification (payload sizes, namespace absence, do-not-regress list) →
final engineering report in the requested format.

## Out of scope (recorded honestly in the final report)

- Record-detail re-architecture beyond header/related polish, if time-boxed
  out by verification findings.
- Portal namespace scoping (follow-up).
- Kanban rework of pipeline if drag-drop backend reliability is unproven —
  the tasks board already has drag-drop; pipeline gets list polish first.
- External logo provider with credentials (Brandfetch etc.) — architecture
  supports it via `logoSource`, integration deferred.
