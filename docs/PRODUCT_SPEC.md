# ITALPROTEIN CRM — Product Specification

> **⚠️ STATUS UPDATE — 2026-07-10 (backend now built).** The "Phase" label and prototype disclaimer below ("no production database, no real backend, and no live third-party integrations") are **outdated.** The product now has a real PostgreSQL/**Prisma** backend, **Auth.js** login, and live **Gmail**. The personas, lifecycle, statuses, and taxonomy in this spec remain accurate and canonical — only the phase framing is stale. See [`docs/LAUNCH_RUNBOOK.md`](./LAUNCH_RUNBOOK.md) for launch status.

**Project:** ITALPROTEIN CRM (working prototype)
**Owner:** Italprotein Srl — Proamina&reg; commercial operations
**Phase:** Frontend-first prototype (mock service layer, no production backend)
**Document status:** Canonical product specification
**Last updated:** 2026-06-16

> **Prototype disclaimer.** This document specifies a **frontend-first prototype**. There is **no production database, no real backend, and no live third-party integrations**. All data is served by a typed mock service layer that reads TypeScript/JSON fixtures with a `localStorage` overlay for demo mutations. Every place that will later connect to a real backend is marked **[Mock → Backend]**. Demo Mode is clearly labelled in the UI and is **not** a production security boundary.

---

## 1. Product Vision & Goals

### 1.1 Vision

Italprotein Srl is an innovative startup (HQ Bologna, founded 2026) holding the exclusive commercial rights to the **Proamina&reg;** patent (patent held by NH2 Tech Srl, Milano). Proamina&reg; is the first 100% protein-based sweetener patented in Italy, classified as nutraceutical/pharmaceutical, with an active international patent.

Selling a patented, technically differentiated B2B ingredient is a **relationship- and evidence-driven** process: it runs through introductory calls, mutual NDAs, technical documentation, physical sample shipments (often cross-border), formulation support, application testing, and structured feedback before any commercial discussion. The vision for ITALPROTEIN CRM is a **single bilingual platform that orchestrates this entire commercial lifecycle** — giving the internal team operational control while giving prospective and active customers a transparent, branded self-service window into their own relationship.

### 1.2 Goals

1. **Model the real commercial lifecycle** — from first contact to repeat customer — as first-class, status-tracked workflow rather than free-text notes.
2. **Two connected experiences, one data model** — an internal CRM for the Italprotein team and an external portal for customer companies, both reading the same fixtures via the same services.
3. **Make confidentiality explicit** — NDAs, technical documents, and commercial materials are classified and gated; Internal Only material (real NDAs, investor deck, business plan, financials, admin email lists) never reaches the portal.
4. **Bilingual by design** — full English/Italian parity, with language switching that preserves the current route and selected record.
5. **Role-appropriate everything** — a single permission matrix drives both navigation visibility and action availability, for 7 internal and 5 external roles.
6. **Demonstrable end-to-end** — a curated fixture set proves every lifecycle state and edge case (delays, customs holds, R&D loops) without a backend.
7. **Backend-ready** — the mock service contracts are shaped so a real backend can be dropped in behind them with minimal UI change.

### 1.3 Non-Vision (this phase)

This phase is **not** about production hardening, real authentication, payments, or live carrier/email integrations. See [Section 9 — Non-Goals](#9-non-goals--out-of-scope-this-phase).

---

## 2. The Two Connected Products

ITALPROTEIN CRM is delivered as **two connected applications on one codebase and one data model**, separated by route group and gated by role.

| Aspect | Internal CRM (`/admin/*`) | External Portal (`/portal/*`) |
|---|---|---|
| **Audience** | Italprotein staff (7 internal roles) | Customer/prospect company users (5 external roles) |
| **Purpose** | Operate and manage the full pipeline and back-office | Self-service window into *their own* company relationship |
| **Data scope** | All companies, all records, internal metadata | Scoped to the signed-in user's own company only |
| **Confidentiality ceiling** | Up to **Internal Only** | Up to **Company Specific** / **Post-NDA**; never Internal Only |
| **Sections** | 22 sections (Overview … Audit Log) | 8 sections (Dashboard … Notifications) |
| **Tone** | Operational, dense, action-rich | Branded, reassuring, transparent, low-friction |
| **Write actions** | Create/update across the lifecycle | Limited: raise sample requests, submit feedback, upload required documents, open support requests |
| **Entry** | `/login` → internal landing → `/admin/overview` | `/register` or `/login` → `/portal/dashboard` |

**Shared foundations:** identical design tokens and brand identity, the same `lib/` (permissions, formatting, validation, i18n), the same fixtures, and the same mock services. The two products differ in **which sections render**, **which data is visible**, and **which actions `can(role, action)` permits** — not in their underlying data. **[Mock → Backend]** Row-level scoping that is enforced in the mock services by company id will move to real server-side authorization.

### 2.1 How they differ in practice

- A **shipment** in the internal CRM exposes carrier, internal cost, customs paperwork, and the assigned LOGISTICS owner. The same shipment in the portal shows the customer only: status, tracking reference, expected delivery, and contents at the line-item level.
- **Feedback** internally carries R&D triage, owner, and a possible "requires R&D action" flag with linked tasks. In the portal the company sees their submitted feedback and the technical results shared back to them.
- **NDAs** internally track both parties, internal status transitions, and the stored signed file (Internal Only); the portal shows the company its own NDA status and lets authorized portal users complete required signing/upload steps.

---

## 3. Target Users & Personas

Roles map 1:1 to the permission matrix in `lib/permissions`. Each role resolves to a set of `can(role, action)` and `canView(role, section)` grants; there are **no scattered role checks** elsewhere.

### 3.1 Internal personas (7 roles)

| Role | Persona & context | Primary goals | Key tasks |
|---|---|---|---|
| **SUPER_ADMIN** | Platform owner / founder-operator. Full trust. | Keep the system and data coherent; manage everyone | Manage users & roles, settings, import/export, read audit log; full CRUD everywhere |
| **CRM_ADMIN** | CRM operations lead; data stewardship. | Clean pipeline data; onboard companies/contacts; approve registrations | Manage companies/contacts, approve registrations, configure lists, run import/export |
| **BUSINESS_DEV** | Commercial / sales development. | Move leads to customers; run the engagement flow | Manage opportunities, schedule calls/meetings, drive NDAs, request samples, run commercial discussions, log activities |
| **RND_TECHNICAL** | R&D / application technologist. | Make Proamina&reg; work in the customer's formulation | Review feedback, triage R&D actions, manage application projects, maintain product/technical docs, support trials |
| **LOGISTICS** | Shipping & customs coordinator. | Get samples delivered, handle cross-border | Prepare/ship samples, manage shipments & tracking, handle delays/customs holds, confirm delivery |
| **FINANCE** | Finance & order administration. | Quote, invoice, track payment | Manage quotes/orders, set payment status, view finance analytics |
| **MANAGEMENT_READONLY** | Executive / investor-facing management. | See the whole picture without changing it | View analytics, pipeline, and reports across all modules (read-only) |

### 3.2 External personas (5 roles)

| Role | Persona & context | Primary goals | Key tasks |
|---|---|---|---|
| **COMPANY_OWNER** | Decision-maker / account principal at the customer company. | Evaluate Proamina&reg;; control their company's access | Full portal access for their company; manage company members, accept NDAs, see commercial discussion |
| **COMPANY_MEMBER** | General employee at the customer company. | Stay informed; participate in evaluation | View dashboard, profile, sample requests, projects, notifications |
| **COMPANY_TECHNICAL** | R&D / quality contact at the customer company. | Run trials; exchange technical results | Submit/track feedback & technical results, view application projects & products, access Post-NDA technical docs |
| **COMPANY_LOGISTICS** | Receiving / supply-chain contact at the customer company. | Receive samples; confirm delivery | Track shipments, see tracking & expected delivery, confirm receipt |
| **COMPANY_FINANCE** | Accounts contact at the customer company. | Handle quotes/orders & payment | View quotes/orders and payment status, access finance documents |

---

## 4. End-to-End Commercial Lifecycle

The CRM models the B2B engagement flow as a connected sequence of status-tracked records. The arrows are the canonical "happy path"; real records branch and loop (notably the feedback ↔ R&D loop).

```
Lead (company + contact)
   → Opportunity opened (pipeline)
      → Introductory video call (meeting)
         → Mutual NDA (drafted → sent → signed)
            → Technical documentation shared (Post-NDA documents)
               → Sample request raised (sample)
                  → Sample approved & prepared
                     → Shipment created + tracking
                        → In transit → (delay / customs hold) → Delivered
                           → Delivery confirmed by company
                              → Feedback submitted (technical results)
                                 → R&D triage → (requires R&D action ↺)
                                    → Application project (formulation work)
                                       → Successful application outcome
                                          → Commercial discussion (quote/order)
                                             → Customer / repeat customer
```

### 4.1 Stage descriptions

1. **Lead** — A company and contact enter the system (manual entry, import, or portal registration awaiting approval). Company typed by segment (Distributor, Manufacturer, HoReCa, Bakery, Dairy, Confectionery, Ingredient Company, Retailer, Agency, Laboratory, Consultant, Other).
2. **Opportunity** — A pipeline record opens, attached to a commercial segment (Bar/HoReCa, Pasticcerie/Bakeries, International Export, E-commerce B2C) and value in EUR (or GBP/USD/CHF for international).
3. **Introductory call** — A meeting/call is scheduled and logged; the engagement flow formally begins.
4. **Mutual NDA** — A reciprocal NDA moves through its status taxonomy; the signed file is stored Internal Only.
5. **Technical documentation** — Post-NDA, technical docs (TDS, comparative data, briefings) become available to the company's technical users.
6. **Sample request** — A request for physical Proamina&reg; samples (quantities in g/kg) is raised and routed for approval.
7. **Sample preparation** — On approval, the sample is prepared for dispatch (LOGISTICS).
8. **Shipment & tracking** — A shipment is created with carrier and tracking; extra-EU shipments are customs-relevant (0% EU customs duty, but customs handling still applies).
9. **Transit, delay, customs hold** — Real states the system represents explicitly, including delayed and customs-held shipments.
10. **Delivery & confirmation** — Delivery is recorded; the company confirms receipt via the portal.
11. **Feedback / technical results** — The company (technical contact) submits structured feedback after testing.
12. **R&D triage & loop** — RND_TECHNICAL reviews; feedback may be flagged **requires R&D action**, generating tasks and possibly looping back to a new sample/trial.
13. **Application project** — Formulation/application work is tracked as a project with status, linked product, and outcome.
14. **Commercial discussion** — On a positive outcome, a quote/order is created and negotiated (FINANCE).
15. **Customer / repeat** — The relationship converts; repeat orders and reorders continue the cycle.

**[Mock → Backend]** Every transition is currently a fixture/`localStorage` mutation via the relevant service. In production these become persisted, auditable state changes with notifications fired through real channels.

---

## 5. Feature Inventory by Module

Each capability below is served by its named mock service (`companyService`, `sampleService`, etc.). Components never import fixtures directly.

### 5.1 Internal CRM sections (22)

| # | Section | Capabilities |
|---|---|---|
| 1 | **Overview** | Role-aware home: KPIs, pipeline snapshot, recent activity, my open tasks, alerts (delays, customs holds, NDAs awaiting signature). |
| 2 | **Companies** | List/detail of 36 fictional companies by type/segment/country; relationship timeline; linked contacts, opportunities, samples, NDAs, projects. |
| 3 | **Contacts** | 75 contacts with role, company, language, channel; quick actions (schedule call, request sample). |
| 4 | **Pipeline** | 20 opportunities across pipeline stages; value in EUR/GBP/USD/CHF; segment tagging; drag-or-edit stage transitions. |
| 5 | **Samples** | 18 sample requests through the full sample taxonomy; approval workflow; link to shipment; quantities in g/kg. |
| 6 | **Shipments / Logistics** | 14 shipments with carrier, tracking, expected/actual delivery, delay & customs-hold handling; cross-border (UK, SE, CH, AT, FR, UAE). |
| 7 | **Feedback & R&D** | 12 feedback records; technical results capture; R&D triage; "requires R&D action" flag spawning tasks. |
| 8 | **Application Projects** | 15 formulation/application projects with status, linked product, technical owner, outcome. |
| 9 | **Products** | 12 products: Proamina&reg; SKUs/formats and segment pack definitions (sachets, kg, B2C boxes); attributes & specs. |
| 10 | **NDAs & Documents** | 10 NDAs through the NDA taxonomy; document library with confidentiality class; Internal Only storage of signed files. |
| 11 | **Quotes/Orders & Finance** | 10 quotes/orders; line items in EUR primary; payment status taxonomy; finance views. |
| 12 | **Activities** | Unified activity log (calls, emails, notes, status changes) across records. |
| 13 | **Tasks** | 25 tasks with owner, due date, linked record; R&D-generated tasks surface here. |
| 14 | **Calendar** | 15 meetings/calls; introductory video calls and technical sessions; scheduling. |
| 15 | **Communications** | Threaded message/email log per company/contact (mock); templates for the engagement flow. |
| 16 | **Analytics & Reports** | Recharts dashboards: pipeline, conversion, samples-to-orders, shipment SLA, R&D loop rate. |
| 17 | **Notifications** | 20 notifications: NDA signed, sample approved, shipment delayed, customs hold, feedback received, payment due. |
| 18 | **Registrations** | Inbound portal registrations awaiting CRM_ADMIN approval; approve/reject + role assignment. |
| 19 | **Users & Roles** | Manage internal/external users; assign roles; view the permission matrix. |
| 20 | **Import/Export** | Bulk import/export of companies/contacts (CSV-style, mock). |
| 21 | **Settings** | Locale defaults, lists/taxonomies, branding, Demo Mode banner. |
| 22 | **Audit Log** | Chronological record of changes (mock), demonstrating future auditability. |

### 5.2 External portal sections (8)

| # | Section | Capabilities |
|---|---|---|
| 1 | **Dashboard** | Company-scoped overview: current stage, open sample requests, in-transit shipments, pending feedback, notifications. |
| 2 | **Company Profile** | The company's own profile; manage members (COMPANY_OWNER); contact and shipping details. |
| 3 | **Sample Requests** | Raise new sample requests and track status through to delivery; quantities in g/kg. |
| 4 | **Feedback & Technical Results** | Submit feedback after testing; view technical results shared back by Italprotein R&D. |
| 5 | **Application Projects & Products** | View Proamina&reg; products available to them and the status of their application projects. |
| 6 | **Documents** | Access documents permitted by confidentiality class (Portal General / Post-NDA / Company Specific); never Internal Only. |
| 7 | **Requests & Support** | Open support/commercial requests; ask questions; request more samples or docs. |
| 8 | **Notifications** | Company-scoped notifications mirroring lifecycle events relevant to them. |

---

## 6. Required Demo Scenarios (15)

The fixture set **must** include at least one record demonstrating each scenario below. These are the acceptance fixtures for the lifecycle.

| # | Scenario | Demonstrated state |
|---|---|---|
| 1 | **Newly contacted lead** | Company + contact exist; opportunity at the earliest pipeline stage; no NDA yet. |
| 2 | **Company reviewing an NDA** | NDA in *sent / under review* — awaiting countersignature. |
| 3 | **Signed NDA + technical call** | NDA *signed*; an introductory/technical call scheduled or completed; Post-NDA docs unlocked. |
| 4 | **Sample requested, not approved** | Sample request *requested / pending approval* — awaiting internal sign-off. |
| 5 | **Sample approved, ready to ship** | Sample *approved / prepared*; no shipment dispatched yet. |
| 6 | **Shipped with tracking** | Shipment *in transit* with a tracking reference and expected delivery. |
| 7 | **Delayed shipment** | Shipment *delayed*; expected delivery moved; alert raised. |
| 8 | **Customs hold** | Extra-EU shipment *customs hold*; flagged on the logistics board and the portal. |
| 9 | **Delivered, awaiting confirmation** | Shipment *delivered*; company has not yet confirmed receipt. |
| 10 | **Delivered, awaiting feedback** | Delivery confirmed; feedback *not yet submitted* / requested. |
| 11 | **Actively testing Proamina&reg;** | Company in *testing*; application project open and in progress. |
| 12 | **Successful application project** | Application project with a *successful / completed* outcome and shared technical results. |
| 13 | **Feedback requiring R&D action** | Feedback flagged *requires R&D action*; linked R&D task(s) open; possible loop to a new sample. |
| 14 | **Commercial discussion** | Opportunity in *negotiation*; quote/order drafted; payment not yet settled. |
| 15 | **Repeat customer** | Won opportunity with at least one prior order plus a new/reorder in progress. |

---

## 7. Status Taxonomies

These are the canonical status sets. UI status chips use the brand status colors (success/green, warning/amber, danger/red, info/blue, neutral/slate). **[Mock → Backend]** Enumerations live in fixtures/types today and become backend enums later.

### 7.1 Sample status

`Requested` → `Pending Approval` → `Approved` → `Rejected` → `Prepared` → `Shipped` → `Delivered` → `Closed`
*(Color cues: requested/pending = info/amber, approved/prepared = info, rejected = danger, shipped = info, delivered/closed = success.)*

### 7.2 NDA status

`Drafted` → `Sent` → `Under Review` → `Signed` → `Countersigned` → `Active` → `Expired` / `Declined`
*(Drafted/sent/under review = amber, signed/countersigned/active = success, expired = neutral, declined = danger.)*

### 7.3 Feedback status

`Submitted` → `In Review` → `Requires R&D Action` → `R&D In Progress` → `Resolved` → `Closed`
*(Submitted = info, in review = amber, requires R&D action = warning/amber→danger emphasis, resolved/closed = success.)*

### 7.4 Pipeline (opportunity) stage

`Lead` → `Qualified` → `NDA` → `Sampling` → `Testing` → `Application Project` → `Commercial Discussion` → `Won` / `Lost`
*(Early stages = neutral/info, won = success, lost = danger.)*

### 7.5 Request status (portal requests & support)

`Open` → `Acknowledged` → `In Progress` → `Awaiting Customer` → `Resolved` → `Closed`
*(Open = info, awaiting customer = amber, resolved/closed = success.)*

### 7.6 Payment status (quotes/orders)

`Draft` → `Quoted` → `Confirmed` → `Invoiced` → `Partially Paid` → `Paid` → `Overdue` / `Cancelled`
*(Draft/quoted = neutral, invoiced/partially paid = info/amber, paid = success, overdue = danger, cancelled = neutral.)*

---

## 8. Shipment status (supporting taxonomy)

Because shipment edge cases are core to the demo, shipments carry their own status set:

`Pending` → `Preparing` → `In Transit` → `Delayed` → `Customs Hold` → `Delivered` → `Delivery Confirmed` → `Exception`
*(In transit = info, delayed = amber, customs hold = amber/danger, delivered/confirmed = success, exception = danger.)*

---

## 9. Non-Goals / Out of Scope (this phase)

The following are explicitly **out of scope** for the frontend-first prototype:

- **Production authentication & authorization** — Demo Mode only; `authService` manages a `DemoSession` in `localStorage`. No real passwords, SSO, MFA, or server-side session security.
- **Production database & persistence** — all data is fixtures + `localStorage` overlay; mutations are not durable beyond the browser.
- **Real backend APIs** — no REST/GraphQL server; mock services simulate latency and shape responses.
- **Live integrations** — no real email/SMS sending, no live carrier tracking APIs, no customs systems, no payment gateways, no e-signature provider, no ERP/accounting sync.
- **Real payments / invoicing** — finance is illustrative only; no money moves.
- **Real document handling of confidential assets** — actual client NDAs, investor deck, business plan, one-pager financials, and initial-admin email lists are **Internal Only** and must **not** be surfaced in the portal or seeded as portal-visible fixtures.
- **Real client identities** — all seed data is fictional/anonymized; real client names are never reused verbatim.
- **Mobile-native apps** — responsive web only.
- **Advanced analytics / ML, forecasting, lead scoring** — basic Recharts dashboards only.
- **Offline mode, real-time collaboration, websockets.**
- **Performance/scale tuning for large datasets** — demo data volumes only (see brief).

---

## 10. Frontend Acceptance Criteria (26)

The prototype is accepted when all of the following hold:

1. **Routing** — All routes are under `/[locale]/…` with locales `en` and `it`; default locale is `en`.
2. **Route groups** — Public landing, `/login`, `/register`, `/portal/*` (external), and `/admin/*` (internal) all exist and resolve.
3. **Language switch** — Switching language preserves the current route **and** the selected record.
4. **i18n parity** — Every user-facing string is translated in both `en` and `it`; no hardcoded copy outside the i18n layer.
5. **Design tokens** — Tailwind v3 with CSS-variable design tokens (shadcn/ui convention); the documented navy/gold/teal/cream palette and status colors are used consistently.
6. **Typography** — Inter for UI, Playfair Display for display/serif headings.
7. **Brand assets** — Italprotein wordmark, Proamina&reg; mark, and the "Contains Proamina&reg; / Metabolic Balance" seal render correctly where appropriate.
8. **UI primitives** — Hand-built, accessible shadcn/ui-style primitives (keyboard navigable, ARIA-correct).
9. **Service-only data access** — Components never import fixtures directly; all data flows through the named mock services.
10. **Mock service contracts** — All listed services exist, are async and typed, and are fixture-backed with a `localStorage` overlay for demo mutations.
11. **Demo Mode labelling** — Demo Mode is clearly labelled in the UI and not presented as production security.
12. **Demo accounts** — `fixtures/users.ts` provides working demo accounts for all 7 internal and 5 external roles; `authService` manages the `DemoSession`.
13. **Permission matrix** — A single role→permission matrix in `lib/permissions` drives navigation visibility and action availability via `can(role, action)` / `canView(role, section)`; no scattered role checks.
14. **Internal sections present** — All 22 internal CRM sections render and are reachable per role.
15. **Portal sections present** — All 8 external portal sections render and are reachable per role.
16. **Company scoping** — Portal users only ever see their own company's data.
17. **Confidentiality gating** — Documents respect the six confidentiality classes; Internal Only material never appears in the portal.
18. **Demo data volumes** — Fixtures match the specified volumes (36 companies, 75 contacts, 20 opportunities, 18 samples, 14 shipments, 12 feedback, 10 NDAs, 15 projects, 12 products, 25 tasks, 15 meetings, 10 quotes/orders, 20 notifications).
19. **Company typing** — Companies use the defined type list and commercial segments.
20. **15 demo scenarios** — Each of the 15 lifecycle scenarios in Section 6 is represented by at least one fixture record and is visibly demonstrable in the UI.
21. **Status taxonomies** — Sample, NDA, feedback, pipeline, request, and payment (plus shipment) statuses are implemented exactly as defined, with correct status-color chips.
22. **Lifecycle navigation** — A user can traverse a full lifecycle (lead → … → repeat customer) by following links between related records.
23. **Charts** — Analytics screens render Recharts visualizations bound to mock data.
24. **Currency & units** — Monetary values display in EUR primary (with GBP/USD/CHF supported); sample quantities display in g/kg; formatting handled in `lib/formatting`.
25. **Validation** — Forms validate via `lib/validation`; invalid input is blocked with localized error messages.
26. **Notifications & alerts** — Lifecycle events (NDA signed, sample approved, shipment delayed, customs hold, feedback received, payment due) surface as notifications/alerts in both products as appropriate to role and scope.

---

## 11. Glossary (selected)

- **Proamina&reg;** — first 100% protein-based sweetener patented in Italy; ~1.1&times; sweetening power vs sucrose; no aspartame; vegan, non-GMO, allergen-free (14 EU allergens, Annex II Reg. 1169/2011); Non-Novel Food; non-additive; 0% EU customs duty.
- **Engagement flow** — introductory video call → mutual NDA → technical documentation → trial samples + formulation support → application testing → feedback → commercial discussion.
- **Confidentiality classes** — Public, Portal General, Pre-NDA, Post-NDA, Company Specific, Internal Only.
- **Demo Mode** — labelled prototype mode; not a production security boundary.
- **[Mock → Backend]** — marker for behavior currently simulated by the mock service layer that will be backed by a real backend in a later phase.
