# Zoho-Simplicity CRM Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the authenticated CRM feel Zoho-simple (module → list → record → action) while making the public surface measurably lighter and visibly more premium — without regressing any working feature.

**Architecture:** Route-group split for i18n scoping; the world-map dot field becomes a committed static SVG painted via CSS mask; nav-config regroups to five groups with per-group collapse; Companies gains saved views + a logo pipeline copying the existing avatar (base64-in-DB, streamed route) pattern; StandardOverview is restructured around "what do I do today?". All motion follows one motion table. Rendered-browser verification with Playwright from the scratchpad (never a repo dependency).

**Tech Stack:** Next.js 16 App Router, next-intl, Tailwind + CSS variables, Prisma 7 (additive migration only), framer-motion/motion (already present), Playwright (scratchpad only).

**Spec:** docs/superpowers/specs/2026-08-13-zoho-crm-redesign-design.md

## Global Constraints

- **No new npm dependencies in the repo. package-lock.json must be byte-identical at the end** (`git diff --stat package-lock.json` empty). The npm-11-writes-what-npm-10-rejects trap burned two production deploys.
- Priority order: data safety > CRM usability > simplicity > accessibility > performance > polish > animation.
- **Do-not-regress list** (live-verified at 1cfa364): `/it` 200 · `/it/login` 200 · 59 map pins · localized map/nav/stats/partners aria-labels · `aria-label="59 località raggiunte"` (dynamic count) · author credit `Creato Da : Amine , con <3` · Bologna rail city · localized remember-me · hero overflow guard · warm `shadow-yellow-pin` glow · no "Parma, Italia" · no Changelog · no raw `sky-*` on public surfaces.
- Accent discipline (from 1cfa364, documented in app/[locale]/page.tsx header comment): `brand-molecular` #2563EB carries text/solid fills in light; `brand-blueBright` in dark; `brand-blue` #0284C7 is decoration only (3.95:1 — fails AA as text); `brand-navy` is structure. `brand-goldDark`≡`brand-blue`, `brand-gold`≡`brand-blueBright` (aliases).
- i18n: messages/it.json and messages/en.json keep identical key sets (parity script must print two empty arrays). Every new user-facing string goes through next-intl in BOTH languages. No hardcoded UI English in components.
- Status meaning stays state-semantic via `lib/labels.ts` getTone — do not re-hue statuses per module. Module identity color arrives via nav/dashboard icon tints only.
- DB: additive migration only; no destructive schema change; production data untouched; entrypoint auto-runs `prisma migrate deploy`.
- Motion table (D9): entrance fade-up 400ms editorial stagger ≤80ms; hover 150ms; modals 160ms scale+fade; sidebar 200ms width; tables hover-only; everything `motion-safe:`/`reducedMotion="user"`-guarded.
- Verification gates before merge: `npm run typecheck` clean · `npm run lint` 0 errors · `npm test` all pass · `npm run build` success · i18n parity script clean · Playwright visual pass done.
- Commits: implementers NEVER commit; the controller stages exact file lists and commits. The 5 document-access files do not exist in this worktree (they live only in the main checkout) — nothing to avoid, but stage explicit paths anyway.

---

### Task 1: Public payload — one route group, scoped providers, static map field

Recon-measured: map SVGs = 964,459 B URI-encoded × 2 themes = 1,928,918 B of the 2,625,374 B page; full it.json = 96,807 B serialized, public set = 9,983 B (10.3%). Expected result ≈ 600 KB.

**Files:**
- Create: `app/[locale]/(public)/layout.tsx`, `lib/i18n/public-namespaces.ts`, `scripts/generate-world-dots.mjs`, `public/marketing/world-dots.svg` (generated, committed), `tests/public-namespaces.test.ts`
- Move (`git mv`): `app/[locale]/{page.tsx,login,team-login,register,verify,forgot-password,activate}` → `app/[locale]/(public)/…`. **not-found.tsx, admin and portal do NOT move.**
- Modify: `app/[locale]/layout.tsx` (drop NextIntlClientProvider — recon proved Toaster/SessionProvider/TooltipProvider/MotionConfig consume no intl; keep locale validation + setRequestLocale + fonts + theme script), `app/[locale]/admin/layout.tsx` (add provider with FULL `getMessages()`), `app/[locale]/portal/layout.tsx` (add provider with `pickMessages(messages, PORTAL_NAMESPACES)`), `app/[locale]/not-found.tsx` (wraps its own tree in a provider with the public set — it sits outside every group and is the boundary for admin/[...rest], portal/[...rest] and unmatched deep paths), `components/ui/world-map.tsx`

**Exact values:**
- `PUBLIC_NAMESPACES = ['Common','Landing','Public','Access','Login','TeamLogin','Register','Verify','ForgotPassword','ActivateAccount','Errors']` (recon-traced union incl. PublicShell→Rail's Public/Landing/Access on every route).
- `PORTAL_NAMESPACES = ['PortalNav','Common','Roles','Amina']` (portal pages use getLabel(), not next-intl; chrome needs these four — external customers stop receiving admin vocabulary).
- Map dot field: parent div keeps the vertical fade mask `[mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]`; child paints `mask-image:url('/marketing/world-dots.svg')` + `mask-size:100% 100%` (with `-webkit-` prefixes), `background-color` light `hsl(var(--brand-navy)/0.17)` ≙ today's `#0A16282B`, dark `rgb(215 232 246/0.15)` ≙ `#D7E8F626`, keeping the existing `opacity-80`. Pins, tooltips, aria-labels, props untouched. `dotted-map` import leaves the component (script keeps using the package).
- Each provider passes `locale` explicitly. `(public)/layout.tsx` and both existing layouts call `setRequestLocale(locale)` before `getMessages()`.

**Steps:**
- [ ] Write `tests/public-namespaces.test.ts`: `pickMessages({A:{x:1},B:{y:2}}, ['A'])` returns only A; PUBLIC_NAMESPACES contains 'Landing','Login','TeamLogin','Errors' and does NOT contain any namespace starting with 'Admin'. Run: fails (module missing).
- [ ] Implement `lib/i18n/public-namespaces.ts` (list from recon Q1 + pick util). Test passes.
- [ ] `scripts/generate-world-dots.mjs`: uses `dotted-map` exactly as world-map.tsx does today (height 100, grid diagonal, equirectangular; radius 0.22, circle, transparent bg, color `#000`), writes `public/marketing/world-dots.svg`. Run it; commit the artifact. The SVG must be deterministic (re-run → identical bytes).
- [ ] Rewrite the dot-field rendering in `world-map.tsx`: parent keeps the vertical fade via `[mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]`; child div paints `background-color: hsl(var(--brand-navy)/0.17)` (dark: light-blue token at 0.15 as today's `#D7E8F626`) with `mask-image:url('/marketing/world-dots.svg')`, `mask-size:100% 100%`. Pins/tooltips/labels/props untouched. Remove `dotted-map` import + `makeMap` from the component (script still uses the package).
- [ ] Route-group moves via `git mv`; write group layouts; root layout slimmed. Group layouts call `setRequestLocale(locale)`. `(public)` provider gets `pickMessages(await getMessages(), PUBLIC_NAMESPACES)`; `(app)` provider gets full messages. Place `not-found.tsx` per recon so notFound() callers still resolve to the branded page.
- [ ] Gates: typecheck, lint, `npm test`, `npm run build` (all routes still listed, `/[locale]` still ●/SSG). Then measure: `npm start` + `curl -s -o /dev/null -w '%{size_download}' localhost:3000/it` before (baseline from git stash of the change is unnecessary — production 2,625,374 B is the before) and after; grep rendered HTML for an admin-only string (e.g. from AdminCompanies namespace) → must be absent; count namespaces in `__NEXT_DATA__`/flight payload → equals PUBLIC_NAMESPACES length.
- [ ] Controller commits (exact paths).

### Task 2: Admin accessibility sweep (AA, both themes)

**Files:**
- Modify: `app/globals.css` (add `--warning-text`, `--success-text` if failures confirmed), `tailwind.config.ts` (expose as `warning.text`, `success.text`), admin components flagged by the sweep (list produced by the sweep script; expected: `text-destructive`/`text-danger` as copy, `focus-visible:ring-brand-gold` remnants, low-contrast muted-on-subtle pairs)
- Create: `scripts/check-contrast.mjs` (pure-node WCAG calculator over the token pairs used, reusable in the report)

**Steps:**
- [ ] Script computes ratios for every (text-token, surface-token) pair in a hardcoded pair list covering: danger/destructive/warning/success/info text on card/background/subtle fills, muted-foreground on background/card/muted, ring tokens on background — light and dark. Output: PASS/FAIL table.
- [ ] Grep the admin tree (`app/[locale]/(app)/admin`, `components/{admin,crm,dashboard,navigation,shared,ui}`) for failing usages; apply fixes: error copy → `text-danger-text`; add `--warning-text` (light `30 85% 34%` ≈5.4:1 on warning-subtle, dark `40 95% 62%`) and `--success-text` (light `160 84% 24%`, dark `150 65% 62%`) only if the script proves current pairs fail; `focus-visible:ring-brand-gold`→`focus-visible:ring-ring`; verify InlineSelect/StatusBadge tone pairs (badge variants use foreground-on-subtle — check each of the 9 variants both themes).
- [ ] Re-run script: all listed pairs PASS. Gates: typecheck/lint/test. Controller commits.

### Task 3: Navigation IA + quick-create + search polish

**Files:**
- Modify: `components/navigation/nav-config.ts` (5 groups), `components/navigation/sidebar.tsx` (per-group collapse, persisted `ui:nav-groups`; module icon tints), `components/navigation/topbar.tsx` (+ QuickCreate), `components/navigation/global-search.tsx` (i18n + recents), `messages/it.json`+`messages/en.json` (Nav group keys add `group_main`,`group_intelligence`,`group_partnerships`; delete orphaned `group_commercial`,`group_technical`,`group_legal_finance`,`group_productivity`,`group_insights`; new `Search` namespace; `QuickCreate` keys), pages that honor `?new=1`: `app/[locale]/(app)/admin/{companies,tasks,pipeline,samples}/page.tsx` (open their existing create dialog when the param is present, then strip it)
- Create: `components/navigation/quick-create.tsx`, `lib/recent-records.ts` (+ `tests/recent-records.test.ts`)

**Grouping (exact):** Main: overview, companies, contacts, pipeline, tasks, calendar · Operations: samples, shipments, ndas, feedback, projects, products, finance · Intelligence: analytics, communications, activities · Partnerships: agencies, registrations · Administration: users, import_export, integrations, settings, audit. RBAC filtering (`canView`) unchanged; a group with zero visible items renders nothing (existing behavior).

**Icon tints (module identity color, nav + dashboard only):** ndas violet (`text-violet-500 dark:text-violet-400`), samples amber-500, shipments cyan-500, feedback purple-500, pipeline emerald-500, companies brand-molecular/blueBright — applied to ICONS only, never text, only when item is inactive-idle→hover/active keeps current behavior.

**Steps:**
- [ ] `lib/recent-records.ts`: `pushRecent({type,id,label,href})` capped at 8, deduped by href, localStorage `ui:recent-records`; `readRecents()`. Test: push 10 → 8 kept, most-recent first, dedupe works. TDD.
- [ ] nav-config regroup + message keys (it+en, parity). Sidebar: group headers become buttons with chevron (aria-expanded, Enter/Space), collapse state persisted per group key; collapsed sidebar (rail mode) unchanged.
- [ ] QuickCreate: topbar `+` button (min 44px), menu: Company/Task/Opportunity/Sample → router.push(`…?new=1`); role-gated with existing `can()` checks used by each page's create button.
- [ ] Each `?new=1` page: `useSearchParams` once on mount → open existing dialog, `router.replace` to strip param. No dialog logic duplicated.
- [ ] GlobalSearch: replace hardcoded strings with `Search.*` keys (it+en); group labels via Nav keys + `Search.documents`; empty state shows recents (readRecents) under a `Search.recent` header; company detail page calls `pushRecent` on mount.
- [ ] Gates + controller commit.

### Task 4: Companies module — saved views, logos, action bar

**Files:**
- Create: `lib/company-views.ts` (+ `tests/company-views.test.ts`), `components/shared/company-logo.tsx`, `prisma/migrations/<ts>_company_logo_pipeline/migration.sql`, `app/api/companies/[id]/logo/route.ts`, `lib/services/logo.actions.ts`
- Modify: `prisma/schema.prisma` (Company + `logoSource String?`, `logoVerified Boolean @default(false)`, `logoUpdatedAt DateTime?`), `lib/services/company.mapper.ts` (+logoUpdatedAt in list shape; never the bytes), `lib/types.ts` (Company + optional logo fields), `app/[locale]/(app)/admin/companies/page.tsx` (view switcher in toolbar, Import-logos button, CompanyLogo in rows/mobile cards), `app/[locale]/(app)/admin/companies/[id]/page.tsx` (CompanyLogo in header), `components/navigation/global-search.tsx` (CompanyLogo in company results), messages it+en (`CompanyViews` + logo action keys)

**Saved views (exact predicates over the loaded Company[]; `lib/company-views.ts` exports `COMPANY_VIEWS: {key, predicate(c, ctx)}[]`, ctx = {accountId, now}):** all (true) · mine (`c.owner?.id===ctx.accountId`) · recent7 (lastActivity ≥ now−7d) · quiet10 (lastActivity ≤ now−10d AND stage ∉ {lost,dormant}) · ndaPending (ndaStatus ∈ {to_prepare,sent,under_review,awaiting_counterparty_signature,awaiting_internal_signature,partially_signed,changes_requested}) · ndaSigned (ndaStatus ∈ {approved,fully_signed}) · samplesSent (latestSampleStatus ∈ {shipped,in_transit,delivered,testing,feedback_requested}) · customers (relationshipStage === 'customer') · distributors (type === 'distributor') · europe/middleEast/anz (countryCode ∈ fixed lists: EU set {IT,DE,CH,GB,FR,ES,NL,BE,AT,DK,FI,SE,AL,PT,IE,PL,CZ,GR,NO}; ME {SA,AE,TR,QA,KW,BH,OM,JO,EG,IL}; ANZ {AU,NZ}). Implementer MUST verify enum literals against lib/types.ts / schema and adjust to the real values, updating tests accordingly. TDD: table-driven vitest with fixture companies per view.
- [ ] View switcher: compact Select before search in the toolbar (shows "View: My companies · 42"), counts computed from predicates, persisted `ui:companies-view`, composes WITH existing type/country/stage/priority filters (AND).
- [ ] Migration (additive) + `prisma generate`; mapper/types wire `logoUpdatedAt` (+`logoUrl` only in detail shape).
- [ ] `app/api/companies/[id]/logo/route.ts`: copy of users/[id]/avatar mechanics (auth: internal-only; decode data-URI from `company.logoUrl`; stream with etag from logoUpdatedAt, cache-control private max-age=3600; 404 when absent).
- [ ] `logo.actions.ts` (`'use server'`): `importMissingLogos()` — requireInternal + admin gate; companies with website, `logoVerified=false`, `logoUrl=null`; domain = hostname of website; try `https://www.google.com/s2/favicons?domain=${domain}&sz=128` then `https://icons.duckduckgo.com/ip3/${domain}.ico`; accept content-type image/*, 500B < bytes ≤ 512KB; store data-URI + `logoSource:'favicon'` + `logoUpdatedAt`; concurrency 4; returns `{updated,skipped,failed}`. `fetchLogoFor(companyId)` single-company variant; company create action fires it void-and-catch when website present. NEVER overwrite `logoVerified:true` rows.
- [ ] `CompanyLogo` ({company,size}): if `logoUpdatedAt` (api mode) → `<img src="/api/companies/${id}/logo">` with `onError` → initials; else initials span (accentColor bg — current markup, extracted). Used in list column, mobile card, detail header, search results.
- [ ] Companies toolbar: "Import logos" button (admin-gated) → action → toast with counts.
- [ ] Gates + parity + controller commit. In mock mode everything renders initials (no API) — Playwright will show initials, correct by design.

### Task 5: StandardOverview → "what do I do today?"

**Files:**
- Modify: `app/[locale]/(app)/admin/page.tsx` (StandardOverview restructure; keep Amine routing line untouched), messages it+en (`Overview` namespace additions/removals)
- Delete: `components/dashboard/amine-dashboard.tsx` (dead code — zero importers; verify again before deleting)

**Layout (exact order):** header (welcome + date) → **KPI row (4 max):** companies · open opportunities (count+value if available) · NDAs awaiting action · samples in testing/awaiting feedback → **My Day** (tasks due today + overdue, next 3 calendar events; each row links to its module) → **Needs Attention** (NDA pending list ≤5 · samples feedback_requested ≤5 · overdue tasks ≤5 · follow-up candidates panel only when `isApiMode`) → **Pipeline mini** (horizontal stage bar with counts, links to /admin/pipeline) → **Recent activity** (existing feed, 8 rows). Everything from existing services; no new backend. Entrance: single stagger container (motion table); numbers use existing count-up only if already present, else static.
- [ ] Gates + parity + controller commit.

### Task 6: Public expressiveness (restrained)

**Files:**
- Modify: `app/[locale]/(public)/page.tsx`, `app/globals.css` (hero dot-grid utility, CTA sheen keyframe), `components/ui/infinite-moving-cards.tsx` (grayscale→color hover), possibly small new client component `components/landing/spotlight-card.tsx`
- Constraint: hero stays server-rendered/static; spotlight is a leaf client wrapper; LCP element (h1) untouched by JS.

- [ ] Hero: layered CSS backdrop — dot grid (radial-gradient dots, token color at low alpha) + existing radial glow; `motion-safe` pointer spotlight on the hero figure only (CSS var --x/--y radial overlay, rAF-throttled).
- [ ] Offer cards → bento polish: border-gradient on hover (conic border via padding-box trick or existing hover-border pattern), translate-y already exists on some cards — unify to motion table (150ms), icon micro-scale on hover.
- [ ] CTA band: slow gradient sheen sweep (background-position keyframe 8s, paused under reduced motion).
- [ ] Partner tiles: `grayscale` → color + slight scale on hover (`motion-reduce` keeps color static); marquee timing untouched.
- [ ] Verify do-not-regress list locally (grep rendered HTML). Gates + controller commit.

### Task 7: Rendered visual verification (Playwright, scratchpad)

- [ ] Scratchpad: `npm init -y && npm i playwright && npx playwright install chromium` (NOT in repo).
- [ ] Repo worktree: `NEXT_PUBLIC_DATA_MODE=mock npx next dev -p 3210` (mock mode; login is email-only with seeded team account — find one in fixtures/TEAM_ACCOUNTS).
- [ ] Script captures matrix: public `/it` + `/it/login` (light/dark × 390/1100/1440) · authenticated `/admin` dashboard, companies, company detail, contacts, pipeline, samples, ndas, shipments, settings (light/dark × 390/1440); auth via UI login flow once, storageState reuse; dark via `localStorage ui:theme=dark` init script.
- [ ] Controller reads the key screenshots, files defects, dispatches one fix wave, re-captures affected shots.

### Task 8: Ship

- [ ] Full gates: typecheck/lint/test/build + i18n parity + `git diff --stat package-lock.json` empty + contrast script PASS.
- [ ] requesting-code-review: reviewer subagent over the whole branch diff (review package file); ONE fix wave; scoped re-review.
- [ ] Payload measurement (build + start local, curl sizes) recorded for the report.
- [ ] Merge branch → `backend-phase-1` in main checkout, push `backend-phase-1` + `main`, SSH deploy (existing procedure), watch entrypoint apply the migration, live-verify: `/it` size + namespace absence + do-not-regress greps + `/it/login` + new chunks served.
- [ ] Final engineering report in the user's requested format. finishing-a-development-branch (worktree keep/remove decision).
