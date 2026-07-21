# Italprotein CRM — Implementation Plan

> **⚠️ STATUS UPDATE — 2026-07-10 (backend now built).** The "Phase status" note below ("no production database, no real backend, and no live integrations") is **outdated.** The backend is now real: PostgreSQL + **Prisma**, **Auth.js** login, **22 server-action services** (switchable via `NEXT_PUBLIC_DATA_MODE=api`), and live **Gmail**. The unchecked Phase B–E boxes below no longer reflect reality — for the authoritative current state and remaining launch tasks, use [`README.md`](../README.md) and [`docs/LAUNCH_RUNBOOK.md`](./LAUNCH_RUNBOOK.md).

> **Living checklist.** This document is updated **after every completed section**. When a section is finished, tick its box, add the completion date in the changelog, and confirm any downstream sections it unblocks. Treat unchecked items as not-yet-started or in-progress.
>
> **Phase status:** This is a **frontend-first prototype**. There is **no production database, no real backend, and no live integrations**. All data is served by an async, typed **mock service layer** that reads TypeScript/JSON fixtures with a **localStorage overlay** for demo mutations. Wherever a checklist item touches data, it is mocked today; "Backend handoff" (Phase E) records exactly where a real backend, auth provider, file store, payment/finance system, carrier tracking, and email/notification service will later connect.

---

## Canonical Stack (all work must conform)

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS v3 with CSS-variable design tokens (shadcn/ui convention); hand-built accessible shadcn/ui-style primitives
- **Charts:** Recharts · **Icons:** lucide-react · **i18n:** next-intl
- **Locales:** `en` (default) and `it`; routing `/[locale]/...`; language switch preserves current route + selected record
- **Areas:** `app/[locale]/` → public landing, `/login`, `/register`, `/portal/*` (external), `/admin/*` (internal CRM)
- **Components:** `components/{ui,crm,portal,charts,tables,forms,navigation,status}`
- **Features:** `features/{companies,contacts,opportunities,samples,shipments,feedback,projects,ndas,finance,tasks,notifications}`
- **Libraries:** `lib/{mock-services,permissions,formatting,validation,i18n}` · **Data:** `fixtures/*.ts`
- **Rule:** Components **never** import fixtures directly — only via services. Permissions flow from a **single role→permission matrix** in `lib/permissions` via `can(role, action)` / `canView(role, section)`. No scattered role checks.

---

## Suggested Vertical Slices

To de-risk integration early, build these four end-to-end slices (UI → service → fixture → localStorage overlay → back to UI) before broadening each module. Each slice exercises auth/role gating, i18n, a list + detail view, at least one mutation, and the relevant status component.

1. **Company 360 slice** — Login as `BUSINESS_DEV` → Companies list → open one Company 360 (profile, contacts, opportunities, samples tabs) → edit a field and see it persist via localStorage overlay. Proves the core internal data model, navigation, permissions, and the read/write mock pattern.
2. **Sample → Shipment → Delivery slice** — Approve a sample request → mark "to send" → create a shipment → advance the tracking timeline → confirm delivery. Proves the operational workflow chain and status transitions across multiple services.
3. **Feedback → R&D review slice** — External portal user submits feedback/technical results on a delivered sample → internal `RND_TECHNICAL` reviews and dispositions it → result reflected in the linked Application Project. Proves the portal↔admin round-trip and confidentiality gating.
4. **Registration → Approval → Portal access slice** — Public `/register` submission → internal Registrations queue → `CRM_ADMIN` approves → company + owner contact provisioned → external `COMPANY_OWNER` logs into the portal Dashboard. Proves onboarding, role provisioning, and the public/external boundary.

---

## Phase A — Foundation

- [x] **Repository & asset inspection** — Inspected repo root, `assets/`, `assets/PROAMINA/` (existing Vite + React landing prototype with brand Tailwind config and EN/IT translations), and `assets/CLIENTI/` client folders. Confirmed: no production app, no backend, empty `docs/` folder; brand tokens and i18n patterns already prototyped in PROAMINA and reusable as reference.
- [x] **Asset inventory** — Catalogued all source assets (see "Asset Inventory" section below): brand logos, Proamina product imagery, PROAMINA landing prototype, real client NDAs/pitches/TDS (Internal Only — must be anonymized for fixtures), business plan / one-pager / investor deck (Internal Only), and the approved initial-admin email list (Internal Only).
- [x] **Documentation set (7 files)** — Authored the canonical documentation suite (all present in `docs/`):
  - [x] `docs/PRODUCT_SPEC.md` — vision, two products, personas, lifecycle, demo scenarios, status taxonomies, acceptance criteria
  - [x] `docs/FRONTEND_ARCHITECTURE.md` — stack, folder structure, mock-service abstraction, i18n, tokens, components, data model
  - [x] `docs/USER_FLOWS.md` — step-by-step flows (login, registration, sample→shipment→delivery, feedback→R&D, NDA, import, etc.)
  - [x] `docs/PERMISSION_MATRIX.md` — 7 internal + 5 external roles × sections/actions; `can`/`canView`
  - [x] `docs/ASSET_INVENTORY.md` — every `/assets` file classified (type, use, confidentiality, portal-safe, NDA)
  - [x] `docs/BACKEND_HANDOFF.md` — entities, endpoints, Gmail triggers, audit, protected storage, scheduled jobs
  - [x] `docs/IMPLEMENTATION_PLAN.md` — this living checklist
- [x] **Project scaffold** — Next.js 14 App Router + TypeScript + Tailwind v3 initialized; `next-intl` plugin + middleware, `@/*` path alias, ESLint (`next/core-web-vitals`); `app/[locale]/` shell. **Production build, type-check and lint all pass.**
- [x] **Design tokens** — Brand palette ported to HSL CSS variables in `app/globals.css` (navy/gold/teal/cream + sage + molecular blue), status tokens (success/warning/danger/info each with DEFAULT/foreground/subtle), sidebar (navy chrome) tokens, radius/shadows/table-density tokens; Inter + Playfair Display via `next/font`. Wired into `tailwind.config.ts` (shadcn convention).
- [x] **EN/IT i18n foundation** — `lib/i18n/{routing,navigation,request}.ts` + `middleware.ts`; `messages/en.json` + `messages/it.json`; locale routing `/[locale]/...`, default `en`; locale-aware formatting helpers in `lib/formatting` (dates, EUR/GBP/USD/CHF, numbers, quantities, relative time, flags). `LanguageSwitcher` preserves route + selected record.
- [x] **Mock service architecture** — `lib/mock-services` with a generic `createRepository<T>()` (fixture read + localStorage create/update/delete overlay + reset) and SSR-safe storage helpers. `authService` + `companyService` implemented; remaining services follow the same factory. "No direct fixture imports" enforced (components use services only).
- [x] **Demo users & role switcher** — `fixtures/users.ts` covers all 7 internal + 5 external roles; `authService` manages `DemoSession` in localStorage; clearly labelled **Demo Mode**; in-app role switcher in the account menu. Internal staff use `@italprotein.com` (never the real personal admin emails).
- [x] **Permissions matrix** — Single role→permission matrix in `lib/permissions`; `can(role, action)`, `canView(role, section)`, `canEdit`, `accessLevel`, `isInternal`/`isExternal` helpers; drives sidebar/portal-nav visibility and shell route guards. (Document confidentiality classes are modeled in types; per-document gating arrives with the Documents module.)
- [x] **Main layouts & navigation** — Internal admin shell (collapsible navy sidebar + topbar with search/lang/notifications/account menu, role-filtered sections, mobile drawer) and simpler external portal shell (top navbar); responsive; `PageHeader` pattern; UI primitives (button, card, badge, avatar, dropdown, tooltip, separator, skeleton). Both shells guard by workspace.
- [x] **Public landing** — `/[locale]` premium navy hero introducing the two products, feature grid, brand imagery from `/assets`; entry points to login/register.
- [x] **Demo login & role selection** — `/login` with internal/external tabs, seeded account cards (avatar, role badge, blurb); selecting one signs in via `authService` and redirects to `/admin` or `/portal`. Demo-mode notice + future-auth note shown.

---

## Phase B — Core CRM (Internal)

- [ ] **Overview dashboard** — `/admin` KPIs (companies, open opportunities, samples in flight, shipments, pending feedback), pipeline snapshot, recent activity, role-aware widgets. Recharts visualizations.
- [ ] **Company list** — Sortable/filterable table (type, country, segment, status), search, pagination; company type facets (Distributor, Food & Beverage Manufacturer, HoReCa, Bakery, Dairy, Confectionery, Ingredient Company, Retailer, Agency, Laboratory, Consultant, Other).
- [ ] **Company 360** — Profile header + tabbed detail: contacts, opportunities, samples, shipments, feedback, projects, NDAs/documents, activities, finance. Edit via service + localStorage overlay.
- [ ] **Contacts** — Contact list + detail; link to companies; role/title; primary-contact handling; quick actions (log activity, schedule meeting).
- [ ] **Pipeline** — Opportunities board/list by stage; reflects B2B engagement flow (video call → mutual NDA → technical docs → trial samples + formulation support → application testing → feedback → commercial discussion); value in EUR with multi-currency display; stage transitions.
- [ ] **Activities & tasks** — Activity timeline (calls, emails, meetings, notes) and task list (assignee, due date, status); link to companies/contacts/opportunities; `activityService` + `taskService`.

---

## Phase C — Operational Workflow

- [ ] **Sample request** — Capture/intake of sample requests (from portal or internal); product, quantity (g/kg), destination, intended application; statuses.
- [ ] **Samples to send** — Internal queue of approved requests ready for fulfillment; pick/prepare; assign to LOGISTICS.
- [ ] **Shipments** — Create shipment from sample(s); carrier, destination (Italy + UK, Sweden, Switzerland, Austria, France, UAE), customs flag for extra-EU; link to sample request and company.
- [ ] **Tracking timeline** — Visual shipment status timeline (prepared → dispatched → in transit → customs → delivered); mocked status advancement.
- [ ] **Delivery confirmation** — Mark delivered; capture proof/notes; trigger downstream feedback prompt; reflect on Company 360 and portal.
- [ ] **Feedback submission** — External (portal) and internal capture of trial feedback / technical results against a delivered sample; structured fields + free text; attachments (mocked).
- [ ] **R&D review** — `RND_TECHNICAL` review/disposition of feedback; outcome routing into Application Projects; status and visibility per confidentiality class.

---

## Phase D — Extended Modules

- [ ] **Registration approval** — Public `/register` intake → internal Registrations queue → approve/reject → provision company + owner contact + external portal access. `registrationService`.
- [ ] **NDAs & documents** — NDA lifecycle (draft → sent → signed) and document library with confidentiality classes; real client NDAs / investor deck / business plan / one-pager financials / admin email list remain **Internal Only** and must **never** appear in the portal. `ndaService` + `documentService`.
- [ ] **Application projects** — Joint development/application projects linking company, product, samples, feedback; milestones/status; external visibility for the owning company only.
- [ ] **Products** — Proamina product catalogue and commercial segments (Bar/HoReCa ~EUR 600 / 2,500-sachet pack; Pasticcerie/Bakeries ~EUR 32/kg; Export ~EUR 26–28/kg, 0% duty; E-commerce B2C ~EUR 39.90 / 50-sachet box); attributes/specs surface (TDS-style). `productService`.
- [ ] **Finance** — Quotes/orders, line items, currency (EUR primary; GBP/USD/CHF), totals; status; link to company/opportunity. `financeService`. (Mock only — no payment processing.)
- [ ] **Analytics & reports** — Cross-module dashboards (pipeline conversion, samples→feedback funnel, shipments by country, segment mix) with Recharts; role-gated (incl. MANAGEMENT_READONLY).
- [ ] **Import wizard** — Import/Export flow: upload → map columns → preview/validate → commit to localStorage overlay; export current datasets. (Parsing/validation mocked; no server ingest.)
- [ ] **Notification centre** — In-app notifications list + unread badge; per-event types (new registration, sample approved, shipment delivered, feedback received); `notificationService`. (No real email/push yet.)

---

## Phase E — Polish

- [ ] **Responsive** — Verify all admin + portal screens across breakpoints; collapsible nav; responsive tables/cards.
- [ ] **Accessibility** — Keyboard nav, focus states, ARIA on primitives, color-contrast against tokens, semantic landmarks; verify status colors are not the sole signal.
- [ ] **Loading / empty / error states** — Skeletons, empty-state illustrations/CTAs, and error fallbacks for every list/detail/form; service-latency and failure simulation.
- [ ] **Translation review** — Full EN/IT parity pass; terminology consistency (glossary); no hardcoded strings; locale-aware formatting verified.
- [ ] **Interaction polish** — Transitions, toasts, optimistic updates, form UX, table affordances; consistent badge/status usage.
- [ ] **Demo walkthrough** — Scripted end-to-end demo path(s) covering the four vertical slices; seed/reset control; "Demo Mode" labelling verified throughout.
- [ ] **Backend handoff** — Document every mock seam and where real systems connect later: backend API (replace mock services preserving signatures), auth provider (replace `authService`/`DemoSession`), database (replace fixtures), file/object storage (documents, NDAs, attachments), carrier tracking (shipment timeline), payment/finance system, and email/push notification service. Note data-migration and confidentiality-enforcement requirements.

---

## Asset Inventory (reference — completed during inspection)

> All real client material below is **Internal Only / Confidential**. Seed/fixture data must be **fictional and anonymized** — never reuse real client names, NDAs, or pricing verbatim.

### Brand & product imagery
- **Logos:** `assets/LOGO .jpeg`, `assets/Logo Officiale.png`, `assets/PROAMINA/Logo.png`, `assets/PROAMINA/Logo Officiale.png`, `assets/PROAMINA/Proamina*.png`, `assets/PROAMINA/Proamina-removebg-preview.png` (Italprotein wordmark, Proamina leaf mark).
- **WhatsApp brand images:** `assets/WhatsApp Image 2026-05-26 at 11.58.19.jpeg`, `assets/WhatsApp Image 2026-05-28 at 14.44.21.jpeg`.
- **Proamina product/lifestyle imagery (`assets/PROAMINA/`):** `Crema Caffé.png`, `Proamina Da Sola.png`, `Proamina Products.png`, `Sacco_pasticceria.png`, `Sostituto dolcificante in busta elegante.png`, `barattolo*.{png,jpg}`, `bustina-cappuccino.jpg`, `desserts.jpg`, `dispenser_rosso_final-removebg-preview.png`, `espresso_cuore.jpg`, `fronte_bustina.jpg` / `retro_bustina.jpg`, `hero-powder-gold.jpg`, `proamina-powder-marble.jpg`, `4cappuccini.jpg`, `sacchetti 100% proteine e logo.png`, `shot.jpg`, `logo.jpg`.

### Existing prototype (reference for tokens + i18n)
- **PROAMINA landing app (`assets/PROAMINA/`):** Vite + React 18 + Tailwind v3 + framer-motion + lucide-react. Components: `Hero`, `WhatIsProamina`, `Benefits`, `Applications`, `B2BProcess`, `Regulatory`, `MarketOpportunity`, `TargetClients`, `ContactForm`, `Header`, `Footer`. `src/contexts/LanguageContext.jsx` + `src/translations/index.js` (EN/IT). `tailwind.config.js` already defines the brand palette and Inter/Playfair fonts — **directly reusable as the token reference.**

### Internal-Only company documents (do NOT expose in portal; anonymize for fixtures)
- **Business / investor material (`assets/`):** `Italprotein_BusinessPlan_3Anni_v3 (1) (1).docx`, `Italprotein_BusinessPlan_v2_2026-2028.xlsx`, `Italprotein_OnePager_FINAL_v7 (1) (1).pdf` (+ `.docx`), `Italprotein_Proamina_InvestorDeck_2026_modificato...pptx.pdf`, `Italprotein_Team_AdvisoryBoard_2026 (1) (2).pptx`.
- **Approved initial admin users:** `assets/list of approved initial admin users.txt` (Superadmin + 5 admins — Internal Only; informs `fixtures/users.ts` role design but **not** verbatim exposure).
- **Sample routing:** `assets/CLIENTI/Clienti Industriali/Proamina_Rotta_Campioni_04-06-2026.pdf` (sample shipment routing — informs shipments/samples model).

### Real client folders (Confidential — fictional analogues only in fixtures)
- **`assets/CLIENTI/Bar & Pasticcerie/`:** Vegamore (incl. NDA images).
- **`assets/CLIENTI/Clienti Industriali/` (43 folders):** ABS Food, Al Ain Farms, Almarai (Bakemart), Ascom Gum, Barilla, Bel Groupe, Bledar Albania, Casillo Group, Colussi, Crave Eatables, Disproquima, Ehrmann, Eurosup, Fabbri 1905, Foodness, Funkie (Funky Veggie), Funky Fat Foods, Galbusera, Gruppo AFR, Icedog, Incredo, Innofoods, LEC, Layenberger, Milaf Global Food Company, N!CK_S, NUTRIMUSCLE, Nando Europe, NaturaSì, Nourish You, Possible Foods, Prinova, Prontofoods, Silvio Panettieri pasticceria, Suntory, Südzucker, ToSeed, UnionPlus, VENCHI, Yoplait Liberté, emmi, nom, proteinworks.
- **Document types observed:** signed/unsigned mutual NDAs (PDF/DOCX, IT/EN/FR), client pitch decks (PPTX), comparative TDS (`Proamina_vs_Sucrose_Comparative_TDS_v2.pdf`), R&D briefings. These map to the **NDAs & Documents** and **Application Projects** modules and confirm confidentiality-class requirements.

---

## Risks & Assumptions

**Assumptions**
- Prototype scope only: no production database, no real backend, no live third-party integrations. Mock services + fixtures + localStorage overlay are the source of truth for the demo.
- Demo Mode auth is **not** production security; it exists to switch personas/roles for demonstration.
- The PROAMINA Vite prototype is reference material; the deliverable is a **new Next.js 14 App Router** app — content/tokens are reused, code is not lifted wholesale.
- Demo data volumes are the target (36 companies, 75 contacts, 20 opportunities, 18 sample requests, 14 shipments, 12 feedback, 10 NDAs, 15 application projects, 12 products, 25 tasks, 15 meetings/calls, 10 quotes/orders, 20 notifications) and are fully fictional/anonymized.
- EUR is the primary currency; GBP/USD/CHF are display/secondary. Units in grams/kg for samples/shipments.
- Default locale is `en`; full EN/IT parity is required at handoff.

**Risks**
- **Confidentiality leakage:** Real client names, NDAs, business plan, investor deck, one-pager financials, and the admin email list are Internal Only. Risk of accidentally seeding real names or exposing Internal-Only docs in the portal — mitigated by the confidentiality-class enforcement in `lib/permissions` and an anonymized-fixtures rule.
- **Mock/real seam drift:** If service signatures aren't kept stable and backend-shaped, the later backend swap (Phase E handoff) becomes costly. Mitigate by designing async typed services up front.
- **localStorage overlay limits:** No multi-user sync, possible quota/staleness; reset/seed control needed; not representative of real persistence/concurrency.
- **Permission-matrix fragmentation:** Scattered role checks would undermine the single-matrix rule and produce inconsistent nav/action gating. Mitigate by routing all checks through `can`/`canView`.
- **i18n debt:** Hardcoded strings or EN-only flows accumulate; mitigate with the translation-review gate and a terminology glossary.
- **Asset/regulatory accuracy:** Product claims (Non-Novel Food, allergen-free, 0% duty, pricing) must stay consistent with source material; avoid inventing specs beyond inspected facts.
- **Scope creep into "real" features:** Finance, tracking, notifications, and import can tempt real integrations; keep them mocked until the explicit backend phase.

---

## Changelog

- **2026-06-16** — Phase A documentation workstream complete: repository & asset inspection, asset inventory, and the 7 documentation files authored. All implementation (build) items remain unchecked.
