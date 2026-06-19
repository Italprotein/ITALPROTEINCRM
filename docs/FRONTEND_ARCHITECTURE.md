# ITALPROTEIN CRM — Frontend Architecture

**Project:** ITALPROTEIN CRM — bilingual (EN/IT) B2B CRM prototype for **Italprotein Srl** and its **Proamina®** protein-sweetener business.
**Phase:** **Frontend-first prototype.** No production database, no real backend, no live integrations.
**Last updated:** 2026-06-16

> **Read this first — what "frontend-first" means here.**
> Everything in this document describes a working **frontend prototype**. All data flows through a typed **mock service layer** (`lib/mock-services`) that reads TypeScript **fixtures** with a **`localStorage` overlay** for demo mutations. Authentication is a **Demo Mode** shim (no passwords, no server sessions) and is clearly labelled in the UI as *not* a production security boundary.
>
> The marker **[Mock → Backend]** flags behaviour simulated in the frontend today that a real backend will own later. The companion document `docs/BACKEND_HANDOFF.md` specifies that future phase in full. **No backend, DB, API, or integration has been built.**

---

## Table of Contents

1. [Tech Stack & Rationale](#1-tech-stack--rationale)
2. [Folder Structure](#2-folder-structure)
3. [Mock Service / Repository Abstraction](#3-mock-service--repository-abstraction)
4. [Internationalization (next-intl)](#4-internationalization-next-intl)
5. [Design Token System](#5-design-token-system)
6. [Component System & Conventions](#6-component-system--conventions)
7. [State Management](#7-state-management)
8. [Permission Architecture](#8-permission-architecture)
9. [Data Modeling Overview](#9-data-modeling-overview)
10. [State Conventions — Loading / Empty / Error / Success](#10-state-conventions--loading--empty--error--success)
11. [Accessibility & Responsive Strategy](#11-accessibility--responsive-strategy)

---

## 1. Tech Stack & Rationale

| Concern | Choice | Why |
|---|---|---|
| **Framework** | **Next.js 14 (App Router)** + **TypeScript** | Server Components for fast, data-shaped pages; client islands only where interaction is needed; file-system routing maps cleanly to the locale + area structure; first-class i18n via middleware. End-to-end type safety from fixtures → services → UI. |
| **Styling** | **Tailwind CSS v3** with **CSS-variable design tokens** (shadcn/ui convention) | One source of truth for theming (re-theme/white-label from `globals.css` with zero component edits); utility classes keep the dense CRM UI consistent; tokens compose opacity because they are stored as raw HSL channels. |
| **UI primitives** | Hand-built **shadcn/ui-style** components on **Radix UI** | Accessible behaviour (focus management, ARIA, keyboard) from Radix; full styling control to match the premium navy/gold brand; we own the code (no opaque component library). |
| **Charts** | **Recharts** | Declarative React charting that reads brand tokens for colour; sufficient for pipeline, funnel, KPI, and operational charts. |
| **Tables** | **@tanstack/react-table** | Headless table engine (sorting, filtering, pagination, column visibility) styled with our own primitives and density tokens. |
| **i18n** | **next-intl** | App-Router-native locale routing (`/[locale]/...`), message namespaces, locale-aware date/number/currency formatting. |
| **Icons** | **lucide-react** | Consistent, tree-shakeable icon set. |
| **Utilities** | `clsx` + `tailwind-merge` (`cn()`), `class-variance-authority` (variants), `date-fns` (locale dates) | Standard, lightweight building blocks for the primitive layer. |
| **Animation** | `tailwindcss-animate` | Token-driven enter/fade/accordion/shimmer animations. |

**Versions** (see `package.json`): Next `14.2.18`, React `18.3`, `next-intl ^3.26`, Tailwind `^3.4`, `@tanstack/react-table ^8.20`, `recharts ^2.13`, `lucide-react ^0.460`, plus the Radix primitive packages (avatar, checkbox, dialog, dropdown-menu, label, popover, select, separator, slot, switch, tabs, tooltip).

**Path alias:** `@/*` → `./*` (root-relative imports, e.g. `@/lib/mock-services/companyService`).

---

## 2. Folder Structure

Root-level layout (the path alias `@/*` resolves from the repo root):

```
app/
  [locale]/                 # locale segment — 'en' (default) | 'it'
    layout.tsx              # NextIntlClientProvider, fonts, html lang
    page.tsx                # public marketing landing (Italprotein / Proamina®)
    login/                  # Demo Mode login + persona/role selection
    register/               # public registration → Registrations queue
    portal/                 # EXTERNAL company portal (company-scoped)
      layout.tsx            # portal shell (lighter chrome)
      dashboard/ company/ samples/ feedback/ projects/ documents/ support/ notifications/
    admin/                  # INTERNAL CRM
      layout.tsx            # admin shell (navy sidebar + topbar)
      overview/ companies/ contacts/ pipeline/ samples/ shipments/
      feedback/ projects/ products/ ndas/ documents/ finance/
      activities/ tasks/ calendar/ communications/ analytics/
      notifications/ registrations/ users/ import-export/ settings/ audit/

components/
  ui/          # shadcn/ui-style primitives (Button, Card, Dialog, Table, …)
  crm/         # internal CRM composites (record headers, 360 tabs, KPI cards)
  portal/      # external portal composites (company-scoped widgets)
  charts/      # Recharts wrappers (pipeline, funnel, KPI, trend) bound to tokens
  tables/      # @tanstack/react-table DataTable + column/filter helpers
  forms/       # form field wrappers, validation display, submit patterns
  navigation/  # sidebar, topbar, breadcrumbs, locale switcher, command palette
  status/      # StatusBadge + status taxonomies (sample/shipment/NDA/invoice/…)

features/      # feature modules: domain UI + hooks composing services
  companies/ contacts/ opportunities/ samples/ shipments/ feedback/
  projects/ ndas/ finance/ tasks/ notifications/

lib/
  mock-services/   # the data SEAM — async, typed, fixture-backed services
  permissions/     # single role→permission matrix + can()/canView()
  formatting/      # locale-aware date / number / currency / unit formatters
  validation/      # form/schema validation helpers
  i18n/            # next-intl config: request.ts, routing.ts, navigation.ts
  types/           # canonical TypeScript entity types (DTO contract)

fixtures/      # *.ts demo data (companies, contacts, users, …) — services only
messages/      # en.json + it.json (next-intl message catalogues)
app/globals.css        # design tokens (CSS variables) — single theming source
tailwind.config.ts     # tokens mapped into Tailwind + raw brand palette
```

**Responsibility per directory**

| Path | Responsibility |
|---|---|
| `app/[locale]/` | Routing + page composition. Public landing at the index; `login`/`register`; `portal/*` (external); `admin/*` (internal). Pages are **Server Components** that call services and pass data into client islands. |
| `components/ui` | Generic, app-agnostic accessible primitives. No domain knowledge, no service calls. |
| `components/crm` · `components/portal` | Domain-aware composites for the internal vs external surfaces (different chrome and density). |
| `components/charts` · `components/tables` · `components/forms` · `components/status` | Cross-cutting building blocks (visualization, data grids, form scaffolding, status badges). |
| `components/navigation` | Shell chrome: role-filtered sidebar, topbar, breadcrumbs, **locale switcher** (preserves route), command palette. |
| `features/*` | Feature modules that bind a domain (e.g. `samples`) to its services and present list/detail/drawer UI; the unit of vertical work. |
| `lib/mock-services` | **The only data seam.** All reads/writes pass through here; the backend later replaces these implementations behind identical interfaces. |
| `lib/permissions` | Single matrix + `can()`/`canView()` — the only source of role logic. |
| `lib/formatting` · `lib/validation` | Locale formatting and validation utilities. |
| `lib/i18n` | next-intl plugin/request config, locale routing, localized navigation helpers. |
| `lib/types` | Canonical entity types shared by fixtures, services, and UI. |
| `fixtures/*.ts` | Demo seed data. **Imported only by services**, never by components. |
| `messages/*.json` | Translation catalogues, namespaced by area/feature. |

> **Architectural rule (enforced):** components and pages **never import `fixtures/*` directly** — they reach data **only** through `lib/mock-services`. This single rule is what makes the backend swap a no-UI-change operation.

---

## 3. Mock Service / Repository Abstraction

### 3.1 The seam

`lib/mock-services` is the single boundary between the UI and "data." Every page, feature, and component reaches data through a **named, async, typed** service (`companyService`, `sampleService`, …). The contract — method names, argument shapes, and returned types — is what the UI depends on. Today the method *body* reads a fixture and applies a `localStorage` overlay; later, the body calls a real API or Next.js Server Action. **The signature and return shape do not change**, so the UI is untouched at cutover.

```
   TODAY        UI ── consumes typed services ──► lib/mock-services ──► fixtures/*.ts + localStorage overlay
   LATER        UI (UNCHANGED) ── same typed contracts ──► lib/services ──► fetch / Server Actions ──► Backend + DB
```

### 3.2 Generic `createRepository<T>()` factory

Most services are thin wrappers over a generic repository factory. It owns fixture seeding, the `localStorage` overlay (create/update/delete deltas merged over the immutable fixture baseline), id generation, simulated latency, and a reset/reseed for demos.

```ts
// lib/mock-services/createRepository.ts
export interface Repository<T extends { id: string }> {
  list(filter?: Partial<T> & ListOptions): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(input: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
}

export function createRepository<T extends { id: string }>(opts: {
  key: string;          // localStorage namespace, e.g. 'companies'
  seed: T[];            // fixture baseline (import lives INSIDE the service layer)
  latencyMs?: number;   // simulated network delay
}): Repository<T> {
  const read = (): T[] => mergeOverlay(opts.key, opts.seed);   // fixture + localStorage deltas
  const write = (rows: T[]) => saveOverlay(opts.key, rows, opts.seed);

  return {
    async list(filter) {
      await delay(opts.latencyMs);
      return applyFilter(read(), filter);
    },
    async get(id) {
      await delay(opts.latencyMs);
      return read().find((r) => r.id === id) ?? null;
    },
    async create(input) {
      await delay(opts.latencyMs);
      const row = { ...input, id: uuid(), createdAt: now(), updatedAt: now() } as T;
      write([...read(), row]);
      return row;
    },
    async update(id, patch) {
      await delay(opts.latencyMs);
      const rows = read();
      const next = rows.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: now() } : r));
      write(next);
      return next.find((r) => r.id === id)!;
    },
    async remove(id) {
      await delay(opts.latencyMs);
      write(read().filter((r) => r.id !== id));
    },
  };
}
```

### 3.3 Service interface + mock implementation example

Each service exposes a small, domain-specific interface — the **standard CRUD set plus the meaningful transitions** for that entity. Example for samples:

```ts
// lib/mock-services/sampleService.ts
import type { SampleRequest, SampleStatus } from '@/lib/types';
import { createRepository } from './createRepository';
import { sampleFixtures } from '@/fixtures/samples';   // fixtures imported ONLY here

export interface SampleService {
  list(filter?: SampleFilter): Promise<SampleRequest[]>;
  get(id: string): Promise<SampleRequest | null>;
  create(input: NewSampleRequest): Promise<SampleRequest>;
  update(id: string, patch: Partial<SampleRequest>): Promise<SampleRequest>;
  /** Drives the sample status taxonomy; in production also emits email/notifications. */
  changeStatus(id: string, status: SampleStatus, meta?: StatusMeta): Promise<SampleRequest>;
}

const repo = createRepository<SampleRequest>({
  key: 'sampleRequests',
  seed: sampleFixtures,
  latencyMs: 250,
});

export const sampleService: SampleService = {
  list: (filter) => repo.list(filter),
  get: (id) => repo.get(id),
  create: (input) => repo.create({ ...input, status: 'Requested' }),
  update: (id, patch) => repo.update(id, patch),

  // [Mock → Backend] today: overlay write + simulated activity entry.
  // later: server action that authorizes, transitions, emits email + notification + audit.
  async changeStatus(id, status, meta) {
    const updated = await repo.update(id, { status, ...statusFields(status, meta) });
    await activityService.create({                 // demo-only side effect
      entityType: 'SampleRequest', entityId: id,
      verb: 'status-change', summary: `Sample → ${status}`,
    });
    return updated;
  },
};
```

**The full service roster** (all async, typed, fixture-backed + overlay):
`companyService`, `contactService`, `opportunityService`, `sampleService`, `shipmentService`, `feedbackService`, `projectService`, `productService`, `ndaService`, `documentService`, `financeService`, `taskService`, `activityService`, `meetingService`, `notificationService`, `registrationService`, `authService`.

### 3.4 `localStorage` overlay strategy

- **Baseline immutable, deltas overlaid.** Fixtures are the read-only seed. Each service namespace stores its mutations under a key (e.g. `italprotein-crm:sampleRequests`). On read, deltas are merged over the seed; on write, the merged set is persisted.
- **Demo-grade only.** The overlay survives reloads (good for demos) and a **"Reset demo data"** action clears all namespaces to restore the pristine fixture state.
- **No security meaning.** Anything in `localStorage` (including the Demo session) is client-only and explicitly **not** a trust boundary.

### 3.5 How the backend replaces it without a UI rewrite

| Layer | Prototype | After backend | UI change? |
|---|---|---|---|
| Pages / components | Consume services | Consume services | **No** |
| Service signatures | `list/get/create/update/changeStatus/…` | Identical | **No** |
| Entity types (`lib/types`) | TS types over fixtures | Become DTOs / API response types | Shared, minimal drift |
| Data source | Fixtures + `localStorage` | Real DB via API / Server Actions | **Yes — behind the seam** |
| Auth | `authService` Demo Mode | Real auth provider | **Yes — behind the seam** |

The backend swaps each service body from "read fixture + overlay" to "call API / Server Action," preserving the interface. Full mapping of services → endpoints, email triggers, audit, and server-side permission enforcement is in `docs/BACKEND_HANDOFF.md`.

---

## 4. Internationalization (next-intl)

### 4.1 Locales & routing

- **Locales:** `en` (default) and `it`. Every route is under `/[locale]/...` (e.g. `/en/admin/companies`, `/it/portal/dashboard`).
- **Config files in `lib/i18n`:**
  - `request.ts` — next-intl request/plugin config (loads the correct message catalogue per request).
  - `routing.ts` — `defineRouting` with `locales: ['en','it']`, `defaultLocale: 'en'`.
  - `navigation.ts` — localized navigation helpers (`Link`, `redirect`, `usePathname`, `useRouter`) created from `routing` so all internal links stay locale-correct.
- Middleware handles locale negotiation/redirects so a bare path resolves to the default locale.

### 4.2 Message namespaces

Messages live in `messages/en.json` + `messages/it.json`, namespaced by area/feature so each component pulls only what it needs:

```jsonc
// messages/en.json
{
  "common":   { "save": "Save", "cancel": "Cancel", "loading": "Loading…" },
  "nav":      { "companies": "Companies", "samples": "Sample Requests" },
  "samples":  { "title": "Sample Requests", "status": { "Requested": "Requested", "Approved": "Approved" } },
  "status":   { "shipment": { "InTransit": "In transit", "CustomsHold": "Customs hold" } }
}
```

```tsx
const t = useTranslations('samples');     // client component
return <h1>{t('title')}</h1>;

const t = await getTranslations('samples'); // server component
```

- **Canonical-stored, localized-displayed.** Enum/status values are stored canonical; their labels come from `messages/*` keyed by enum — never per-locale free text in the data.
- **Locale-aware formatting** lives in `lib/formatting` (dates via `date-fns` locales; numbers, EUR/GBP/USD/CHF currency, and `g`/`kg` units via `Intl`).

### 4.3 Preserving route + selected record on language switch

The locale switcher (in `components/navigation`) uses the localized `usePathname`/`useRouter` from `lib/i18n/navigation` to **re-render the current path under the other locale**, keeping query params and the selected record id. Switching language on `/en/admin/companies/abc-123?tab=samples` lands on `/it/admin/companies/abc-123?tab=samples` — same record, same tab.

---

## 5. Design Token System

Tokens are the **single source of truth for theming**: HSL channels (no `hsl()` wrapper, so Tailwind composes opacity) declared in `app/globals.css` and mapped into `tailwind.config.ts`. Re-theming or white-labelling happens entirely in CSS variables with no component edits.

### 5.1 Brand palette

| Token | Value | Use |
|---|---|---|
| **Navy** (primary) | `#0a1628` (+ `navy800/700/600`) | Primary brand, internal sidebar chrome, headings |
| **Gold** (premium accent) | `#c9a227` (+ light `#e8c84a`, dark `#a07c1a`) | Premium accents, sidebar active, gradient text (sparingly) |
| **Teal** | `#0eb89a` (+ dark `#0a9980`) | Secondary accent, charts |
| **Cream** | `#f8f4ed` | Warm surfaces, light backgrounds |
| **Sage green** | `#6f8a6b` (+ dark) | Tertiary accent, charts/illustration |
| **Molecular blue** | `#2563eb` | Scientific/info accent, links, info status |

Raw brand colours are exposed under `brand.*` for accents/charts; semantic UI colours are CSS-variable driven.

### 5.2 Semantic + status + sidebar tokens

- **Semantic surfaces:** `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring` — each with `*-foreground` where relevant. Full **dark mode** variants (`.dark`).
- **Status tokens** (operational): `success`, `warning`, `danger`, `info`, each with `DEFAULT` / `foreground` / `subtle` for solid badges and tinted backgrounds.
- **Sidebar tokens** (navy chrome): `sidebar` + `foreground` / `muted` / `accent` / `border` / `active`.
- **Gold** has its own `--gold` / `--gold-foreground` for the premium accent.

### 5.3 Shape, elevation, density, type

| Token group | Values |
|---|---|
| **Radius** | `--radius: 0.625rem` → `sm/md/lg/xl` derived in Tailwind |
| **Shadows** | navy-tinted `xs → lg`, plus `ring` and `gold-glow` |
| **Table density** | `--row-height` (`3rem` default), `--cell-padding-x/-y`; `.density-compact` / `.density-comfortable` modifiers override per table |
| **Fonts** | `--font-sans` (**Inter**, UI) and `--font-display` (**Playfair Display**, headings) via `font-sans` / `font-display`; `--font-mono` for codes/references |
| **Helpers** | `.tabular` (tabular numerals for tables/KPIs/finance), `.eyebrow`, `.gradient-gold`, `.skeleton` shimmer, `.surface-quiet`, `.kbd`, `.scrollbar-thin`, `.bg-grid` |

```css
:root {
  --primary: 216 60% 10%;     /* navy */
  --gold: 45 68% 47%;
  --success: 160 72% 34%; --warning: 38 92% 48%;
  --danger: 0 72% 50%;    --info: 221 83% 53%;
  --radius: 0.625rem;
  --row-height: 3rem;
}
```

---

## 6. Component System & Conventions

A three-tier model: **primitives** (`components/ui`) → **cross-cutting building blocks** (`charts`, `tables`, `forms`, `status`, `navigation`) → **domain composites** (`components/crm`, `components/portal`, `features/*`).

### 6.1 UI primitives (`components/ui`)

Hand-built, accessible, shadcn/ui-style components on Radix: `Button`, `Card`, `Dialog`, `Drawer/Sheet`, `DropdownMenu`, `Select`, `Checkbox`, `Switch`, `Tabs`, `Tooltip`, `Popover`, `Avatar`, `Separator`, `Label`, `Input`, `Badge`, `Table`, `Skeleton`, `Toast`, etc.

Conventions:
- **`cn()`** (`clsx` + `tailwind-merge`) for class composition; **`cva`** for variants (e.g. button `variant` × `size`).
- `asChild` via Radix `Slot` for composition without wrapper elements.
- Tokens only — no hard-coded colours; primitives carry no domain logic and make no service calls.

### 6.2 Charts (`components/charts`)

Recharts wrappers (pipeline bar, funnel, KPI trend, status breakdown) that read **brand tokens** for series colour and a shared tooltip/legend style. Charts receive already-shaped data from server components/services.

### 6.3 Tables (`components/tables`)

A `DataTable` built on **@tanstack/react-table** (headless): sorting, column filters, pagination, column visibility, row selection. Styled with the `ui/Table` primitive and **density tokens** (`compact` / default / `comfortable`). Column/filter helpers are shared so every list page (Companies, Samples, Shipments, …) looks and behaves consistently.

### 6.4 Forms (`components/forms`)

Field wrappers (label + control + description + error), validation display from `lib/validation`, and consistent submit/pending patterns. Forms call services to persist (overlay today, server actions later) and surface success/error via toasts.

### 6.5 Status badges (`components/status`)

A single `StatusBadge` maps each entity's status enum to a `success/warning/danger/info` token and a localized label (from `messages/status.*`). One taxonomy per entity (sample, shipment, NDA, invoice, feedback, opportunity stage, …) — defined once, reused everywhere, so colour semantics never drift.

### 6.6 Navigation, drawers & shells (`components/navigation`)

- **Internal admin shell:** navy `sidebar` (role-filtered via `canView`) + topbar (search, notifications badge, locale switcher, Demo-Mode banner + persona switcher) + breadcrumbs.
- **External portal shell:** lighter, company-scoped chrome with a reduced nav set.
- **Record drawers/sheets:** detail and quick-edit open in a Radix `Dialog`/`Sheet` over list context, keeping the user oriented.
- **Command palette** for fast navigation (`kbd` hints).

**Conventions across the system:** token-driven styling only; localized labels via next-intl; permission-gated actions via `can()`; Server Components render data, client islands handle interaction; primitives stay domain-free.

---

## 7. State Management

The app favours **Server Components** for data and **small client islands** for interaction — no global client store for server data.

| Concern | Where it lives |
|---|---|
| **Page data (reads)** | **Server Components** call services and render. No client fetching for initial data. |
| **Interactive widgets** | **Client islands** (`'use client'`): tables, forms, drawers, switchers, charts that need handlers. They receive server-fetched data as props and call services for mutations. |
| **Mutations** | Service calls (overlay today → Server Actions later). After a write, the affected island refreshes (router refresh / local state) to reflect the new overlay state. |
| **Local UI state** | Component-local `useState`/`useReducer` and Radix-controlled state (open/selected/expanded). |
| **Demo session** | **`localStorage`** via `authService` (see below). |
| **Locale** | URL (`/[locale]`) + next-intl provider — not client state. |
| **Theme (light/dark)** | `class` on `<html>` (`darkMode: ['class']`) toggled client-side. |

**Demo session in `localStorage`.** `authService` stores the selected `DemoSession` (current `User`, role, and — for external users — `companyId`) under a namespaced key. The persona/role switcher updates it for fast demoing. `authService.getSession()` is the **only** way the UI learns "who am I and what role," and `can()`/`canView()` read from it. **[Mock → Backend]** this client-only Demo Mode is replaced by real server-issued sessions later; the `authService` contract is unchanged.

---

## 8. Permission Architecture

A **single role→permission matrix** in `lib/permissions` is the only place role logic lives. It drives **both** navigation visibility and action availability — no scattered `if (role === …)` checks.

### 8.1 Helpers

```ts
// lib/permissions
can(role, action): boolean        // e.g. can(role, 'sample.approve')
canView(role, section): boolean   // e.g. canView(role, 'finance')
```

- `canView(role, section)` → the **navigation/sidebar** filters sections and **route guards** redirect unauthorized access.
- `can(role, action)` → buttons/menu items are hidden or disabled, and mutation handlers refuse the action.

### 8.2 Roles

**Internal:** `SUPER_ADMIN`, `CRM_ADMIN`, `BUSINESS_DEV`, `RND_TECHNICAL`, `LOGISTICS`, `FINANCE`, `MANAGEMENT_READONLY`.
**External (company-scoped):** `COMPANY_OWNER`, `COMPANY_MEMBER`, `COMPANY_TECHNICAL`, `COMPANY_LOGISTICS`, `COMPANY_FINANCE`.

### 8.3 Route guards & scoping

- **Section guard:** `admin/*` and `portal/*` layouts check `canView` against the current session role and redirect on failure (admin areas reject external roles and vice-versa).
- **Company scoping (prototype):** external roles are scoped to their own `companyId`; the mock services filter list/get results by company id from the Demo session.
- **Confidentiality classes** (Public, Portal General, Pre-NDA, Post-NDA, Company Specific, Internal Only) gate document/record exposure in the UI.

> **[Mock → Backend]** Today all enforcement is **UI-only** (usability — hide what you can't do). In production the **same matrix is mirrored and enforced server-side** on every read/mutation, company scope is derived from the **verified session** (never a client-supplied id), and confidentiality is re-checked before any signed-URL issuance. The UI matrix is retained as the visibility layer. See `docs/BACKEND_HANDOFF.md` §9 and `docs/PERMISSIONS.md`.

---

## 9. Data Modeling Overview

Canonical TypeScript types live in `lib/types` and are shared by fixtures, services, and UI (they become DTOs at backend cutover). Conventions: every entity has `id` (uuid), `createdAt`, `updatedAt` (and `createdBy`/`updatedBy` where mutated); money is integer minor units + ISO `currency` (`EUR` primary; `GBP`/`USD`/`CHF`); quantities are numeric + unit (`g`/`kg`); enums are stored canonical, displayed localized.

### 9.1 Major record types & key relationships

| Type | Purpose | Key relationships |
|---|---|---|
| **Company** | The B2B account (distributor, F&B/bakery/dairy/confectionery manufacturer, HoReCa, retailer, …) | 1—* Contact, Opportunity, SampleRequest, Shipment, Feedback, ApplicationProject, NDA, Document, Quote, Order, Invoice, Activity; 1—* external User |
| **Contact** | Person at a company (commercial / technical / logistics / finance) | *—1 Company; referenced by Activity, Meeting, SampleRequest, Feedback |
| **Opportunity** | Sales pipeline item (Lead → Qualified → NDA → Sampling → Testing → Application Project → Commercial Discussion → Won/Lost) | *—1 Company; → Quote/Order; links SampleRequest, ApplicationProject |
| **SampleRequest** | Request for a Proamina® sample (Requested → … → Shipped → Delivered → Closed) | *—1 Company, Contact, Product; 1—1/1—* Shipment; → Feedback |
| **Shipment** | Physical dispatch + tracking (Pending → In Transit → Customs Hold → Delivered → Confirmed → Exception) | *—1 Company, SampleRequest; assigned LOGISTICS User |
| **Feedback** | Customer technical/sensory feedback on a sample/project | *—1 Company, Contact; → SampleRequest, ApplicationProject, Task (R&D) |
| **ApplicationProject** | R&D collaboration applying Proamina® to a customer product | *—1 Company, Product; *—* Feedback, SampleRequest; portal-visible to owning company only |
| **Product** | Proamina® catalogue item (sachet / kg / B2C box) + specs/attributes | referenced by SampleRequest, ApplicationProject, Quote/Order lines |
| **NDA** | Mutual NDA lifecycle (Drafted → Sent → … → Active → Expired) | *—1 Company; *—1 Document (signed file); gates Post-NDA document visibility |
| **Document** | File metadata + confidentiality class | *—1 Company (if scoped); referenced by NDA, ApplicationProject |
| **Quote** | Commercial quote with line items | *—1 Company, Opportunity; → Order |
| **Order** | Confirmed order | *—1 Company, Quote; → Invoice |
| **Invoice** | Billing doc (Draft → Issued → Partially Paid → Paid → Overdue → Cancelled) | *—1 Company, Order; 1—* Payment (+ CreditNote) |
| **Payment** | Payment against an invoice | *—1 Invoice |
| **Task** | Action item (incl. R&D-generated), polymorphic link | links to any entity; surfaced in Tasks + Overview |
| **Meeting** | Scheduled call/session | *—1 Company; *—* Contact, User |
| **Activity** | Unified timeline event (call/email/note/status-change) | polymorphic across all entities |
| **Notification** | In-app notification (internal or company scope) | *—1 User; mirrors lifecycle events |
| **Registration** | Public sign-up awaiting approval | on approval → provisions Company + COMPANY_OWNER User |
| **User / DemoAccount** | Identity + role; external users carry `companyId`. Demo accounts in `fixtures/users.ts` | *—1 Role; external *—1 Company; author of many entities |

> The finance chain (Quote → Order → Invoice → Payment) is **illustrative only** in the prototype — no money moves. Full field lists are in `docs/DATA_MODEL.md`; the backend persistence contract is in `docs/BACKEND_HANDOFF.md` §3.

---

## 10. State Conventions — Loading / Empty / Error / Success

Because all data is async (services await simulated latency), every data surface handles four states consistently:

| State | Convention |
|---|---|
| **Loading** | App Router `loading.tsx` + Suspense for route-level; **skeleton** placeholders (`.skeleton` shimmer) matching the final layout for in-island loads; buttons show a pending/disabled state during mutations. No layout shift. |
| **Empty** | Purposeful empty state in a `.surface-quiet` panel: icon + localized title + one-line guidance + a primary action when the user can create (`can(...)`). Distinct from loading. |
| **Error** | App Router `error.tsx` boundaries for route failures; inline error messages for failed mutations/forms (via `lib/validation` display); a **destructive toast** with a retry where sensible. Errors are localized. |
| **Success** | A **success toast** confirms mutations; the affected list/detail refreshes from the overlay so the change is immediately visible; optimistic UI only where safe to roll back. |

All four states are localized (EN/IT) and token-styled. **[Mock → Backend]** error handling currently reflects simulated/overlay failures; real network/authorization errors map onto the same patterns later.

---

## 11. Accessibility & Responsive Strategy

### 11.1 Accessibility

- **Radix-backed primitives** provide focus management, ARIA roles/states, and full keyboard support (dialogs trap focus and restore it; menus/selects are arrow-key navigable; tooltips are keyboard-reachable).
- **Visible focus** via the `ring` token; never `outline: none` without a replacement.
- **Semantic structure:** one `<h1>` per page, ordered headings, landmarks (`nav`/`main`), labelled form controls (Radix `Label`), and `aria-live` regions for toasts/async updates.
- **Colour is never the only signal:** status badges pair colour with a localized text label and (where useful) an icon; token contrast targets WCAG AA, verified in light and dark.
- **Locale correctness:** `<html lang>` reflects the active locale; numbers/dates/currency formatted via `Intl`/`date-fns`.

### 11.2 Responsive (desktop priority → tablet → mobile)

This is a data-dense B2B tool, so **desktop is the priority surface**, degrading gracefully:

| Breakpoint | Behaviour |
|---|---|
| **Desktop (≥1024px)** | Primary target. Persistent navy sidebar; multi-column 360 layouts; full-width data tables (default/comfortable density); side drawers over list context. Container max `1440px`. |
| **Tablet (≥640px)** | Collapsible sidebar; two→one column reflow; tables switch to **compact density** with horizontal scroll (`.scrollbar-thin`) for wide grids. |
| **Mobile (<640px)** | Off-canvas nav; single-column stacks; the densest tables fall back to **card/list summaries** with detail in a full-height sheet; touch-sized targets. |

Layout is Tailwind utility-driven (`container`, responsive variants) on top of the token system, so density and spacing stay consistent across breakpoints.

---

> **Cross-references:** `docs/BACKEND_HANDOFF.md` (future backend contract), `docs/DATA_MODEL.md` (full entity fields), `docs/DESIGN_SYSTEM.md` (palette/components), `docs/PERMISSIONS.md` (role matrix), `docs/IMPLEMENTATION_PLAN.md` (build checklist), `docs/ASSET_INVENTORY.md` (source assets & confidentiality).
