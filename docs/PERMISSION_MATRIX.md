# Permission Matrix — ITALPROTEIN CRM

**Project:** ITALPROTEIN CRM (working prototype)
**Owner:** Italprotein Srl — Proamina&reg; commercial operations
**Phase:** Frontend-first prototype (Demo Mode)
**Document status:** Canonical reference for *who can see what* and *who can do what*
**Last updated:** 2026-06-16

> **Security disclaimer — read first.** Every rule in this document is currently enforced **client-side only**. Permissions are computed in the browser from the role&rarr;permission matrix in `lib/permissions` and applied to navigation rendering, route guards, and UI action availability. There is **no production database, no real backend, and no server-side enforcement** in this phase. A determined user could bypass any of these checks by manipulating client state, network requests, or `localStorage`. **All rules below MUST be re-enforced server-side** (API authorization, row-level security, signed sessions, audit) when the real backend is connected. Until then, treat this matrix as **UX gating and demo fidelity — not access control.**

---

## Table of Contents

1. [Roles](#1-roles)
2. [Legends](#2-legends)
3. [Matrix 1 — Internal Roles × Internal Sections](#3-matrix-1--internal-roles--internal-sections)
4. [Matrix 2 — Internal Roles × Key Actions](#4-matrix-2--internal-roles--key-actions)
5. [Matrix 3 — External Roles × Portal Sections](#5-matrix-3--external-roles--portal-sections)
6. [Matrix 4 — External Roles × Portal Actions](#6-matrix-4--external-roles--portal-actions)
7. [Mapping to `lib/permissions`](#7-mapping-to-libpermissions)
8. [Production Hand-off — Re-enforce Server-Side](#8-production-hand-off--re-enforce-server-side)

---

## 1. Roles

### 1.1 Internal roles (7) — staff of Italprotein Srl

| Role | One-line description |
|------|----------------------|
| **SUPER_ADMIN** | Unrestricted platform owner — full access to every section and action, including Users & Roles, Settings, and Audit Log. |
| **CRM_ADMIN** | Day-to-day CRM administrator — full control of all CRM data, manages registrations and data quality; bounded below platform-level Settings and Audit. |
| **BUSINESS_DEV** | Commercial owner of the partner relationship — drives Companies, Contacts, Pipeline, NDAs, Samples, and Quotes end to end. |
| **RND_TECHNICAL** | R&D / technical specialist — owns Feedback, Application Projects, and Products, posts technical replies, and reviews the technical view of samples. |
| **LOGISTICS** | Operations role centred on Samples and Shipments — approves, fulfils, and tracks sample dispatch and deliveries; read-only elsewhere. |
| **FINANCE** | Financial controller — owns Quotes/Orders/Invoices/Payments and finance analytics, with read context on the commercial pipeline. |
| **MANAGEMENT_READONLY** | Executive oversight — broad **read-only** visibility across all business data and analytics; no mutating actions anywhere. |

### 1.2 External roles (5) — partner company users (portal)

External users are **always scoped to their own company only**. They can never see other companies' records, internal-only documents, or any internal CRM section.

| Role | One-line description |
|------|----------------------|
| **COMPANY_OWNER** | Primary account holder — full access to the company's portal, including sensitive profile edits (routed to internal approval) and team management. |
| **COMPANY_MEMBER** | General company user — everyday portal use: views company data and submits sample and support requests; cannot edit the profile or sensitive details. |
| **COMPANY_TECHNICAL** | Technical contact — focuses on Feedback, Application Projects & Products, and technical documents; uploads test results and submits technical feedback. |
| **COMPANY_LOGISTICS** | Shipping/receiving contact — manages sample requests and shipments and confirms deliveries for the company. |
| **COMPANY_FINANCE** | Finance contact — views commercial/financial documents shared to the company and handles finance-facing items and requests. |

---

## 2. Legends

**Section access level (Matrix 1 & Matrix 3):**

| Level | Meaning |
|-------|---------|
| **Full** | View + create + edit + manage (delete, assign, configure within the section). |
| **Edit** | View + create / edit own-scope records; cannot manage section-wide configuration. |
| **View** | Read-only; the section is visible but no mutating controls are shown. |
| **Hidden** | Section is not rendered in navigation and the route is gated (redirect/block). |

**Action availability (Matrix 2 & Matrix 4):**

| Symbol | Meaning |
|--------|---------|
| **Allowed** | `can(role, action)` returns `true`; the control is rendered and enabled. |
| **Denied** | `can(role, action)` returns `false`; the control is hidden or disabled. |

---

## 3. Matrix 1 — Internal Roles × Internal Sections

| Section | SUPER_ADMIN | CRM_ADMIN | BUSINESS_DEV | RND_TECHNICAL | LOGISTICS | FINANCE | MANAGEMENT_READONLY |
|---|---|---|---|---|---|---|---|
| Overview | Full | Full | View | View | View | View | View |
| Companies | Full | Full | Full | View | View | View | View |
| Contacts | Full | Full | Full | View | View | View | View |
| Pipeline | Full | Full | Full | View | View | View | View |
| Samples | Full | Full | Edit | View | **Full** | View | View |
| Shipments | Full | Full | View | View | **Full** | View | View |
| Feedback & R&D | Full | Full | View | **Full** | View | Hidden | View |
| Application Projects | Full | Full | View | **Full** | View | Hidden | View |
| Products | Full | Full | View | **Full** | View | View | View |
| NDAs & Documents | Full | Full | **Full** | Edit | View | View | View |
| Finance | Full | Full | Edit | Hidden | Hidden | **Full** | View |
| Activities | Full | Full | Edit | Edit | Edit | Edit | View |
| Tasks | Full | Full | Edit | Edit | Edit | Edit | View |
| Calendar | Full | Full | Edit | Edit | Edit | Edit | View |
| Communications | Full | Full | Edit | Edit | Edit | Edit | View |
| Analytics | Full | Full | View | View | View | **View** | View |
| Notifications | Full | Full | Full | Full | Full | Full | View |
| Registrations | Full | **Full** | Edit | Hidden | Hidden | Hidden | View |
| Users & Roles | Full | Full | Hidden | Hidden | Hidden | Hidden | Hidden |
| Import/Export | Full | Full | Edit | View | View | View | Hidden |
| Settings | **Full** | View | Hidden | Hidden | Hidden | Hidden | Hidden |
| Audit Log | **Full** | View | Hidden | Hidden | Hidden | Hidden | Hidden |

**Reading the emphasis:**

- **LOGISTICS** is operationally centred on **Samples** and **Shipments** (both **Full**); everything else is **View** or **Hidden** (Finance, Feedback/Projects, and Registrations are hidden).
- **RND_TECHNICAL** has **Full** on **Feedback & R&D**, **Application Projects**, and **Products** (its R&D home), plus **Edit** on NDAs & Documents; Finance and Registrations are **Hidden**.
- **FINANCE** has **Full** on **Finance** and **View** on **Analytics** (finance reporting context); R&D sections are **Hidden**.
- **MANAGEMENT_READONLY** is **View** everywhere it can see and **Hidden** on **Users & Roles**, **Settings**, **Audit Log**, and **Import/Export** — purely observational.
- **CRM_ADMIN** is **Full** across all business and data-quality sections (incl. **Registrations**), but only **View** on **Settings** and **Audit Log** — the platform-level controls that distinguish it from **SUPER_ADMIN**.
- **SUPER_ADMIN** is **Full** everywhere, including the three platform sections (Users & Roles, Settings, Audit Log).

---

## 4. Matrix 2 — Internal Roles × Key Actions

| Action | SUPER_ADMIN | CRM_ADMIN | BUSINESS_DEV | RND_TECHNICAL | LOGISTICS | FINANCE | MANAGEMENT_READONLY |
|---|---|---|---|---|---|---|---|
| Create / edit company | Allowed | Allowed | Allowed | Denied | Denied | Denied | Denied |
| Change pipeline stage | Allowed | Allowed | Allowed | Denied | Denied | Denied | Denied |
| Approve sample request | Allowed | Allowed | Allowed | Allowed | Allowed | Denied | Denied |
| Update shipment status | Allowed | Allowed | Denied | Denied | Allowed | Denied | Denied |
| Post technical reply to feedback | Allowed | Allowed | Denied | Allowed | Denied | Denied | Denied |
| Prepare / send NDA | Allowed | Allowed | Allowed | Denied | Denied | Denied | Denied |
| Mark NDA signed | Allowed | Allowed | Allowed | Denied | Denied | Denied | Denied |
| Edit finance records | Allowed | Allowed | Allowed | Denied | Denied | Allowed | Denied |
| Approve registration | Allowed | Allowed | Allowed | Denied | Denied | Denied | Denied |
| Manage users | Allowed | Allowed | Denied | Denied | Denied | Denied | Denied |
| Export data | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Denied |
| Edit settings | Allowed | Allowed&nbsp;* | Denied | Denied | Denied | Denied | Denied |

\* **Edit settings** for **CRM_ADMIN** is limited to operational / CRM-level options. **Platform-level configuration** (locale defaults, integration keys, role-matrix changes) remains **SUPER_ADMIN** only. This is why Matrix 1 grants CRM_ADMIN only **View** on the **Settings** section while still allowing it to edit a bounded subset surfaced within it.

**Notes:**

- **Approve sample request** is allowed for BUSINESS_DEV (commercial gating), RND_TECHNICAL (technical suitability), and LOGISTICS (fulfilment) — reflecting the cross-functional sample workflow.
- **Edit finance records** is allowed for BUSINESS_DEV (to raise quotes during commercial discussion) in addition to FINANCE; FINANCE owns the section, BUSINESS_DEV contributes.
- **MANAGEMENT_READONLY** has every action **Denied** — it can observe but never mutate.

---

## 5. Matrix 3 — External Roles × Portal Sections

All access is **company-scoped**: a portal user only ever sees records belonging to **their own company**. Document confidentiality classes (Pre-NDA / Post-NDA / Company Specific) further gate what is shown; **Internal Only** items never reach the portal.

| Portal Section | COMPANY_OWNER | COMPANY_MEMBER | COMPANY_TECHNICAL | COMPANY_LOGISTICS | COMPANY_FINANCE |
|---|---|---|---|---|---|
| Dashboard | Full | View | View | View | View |
| Company Profile | **Edit** | View | View | View | View |
| Sample Requests | Full | Edit | Edit | **Full** | View |
| Feedback | Full | View | **Full** | View | View |
| Projects & Products | Full | View | **Full** | View | View |
| Documents | Full | View | View | View | **View** |
| Requests / Support | Full | Edit | Edit | Edit | Edit |

- **COMPANY_OWNER** — full portal control for the company; the only role that can edit the company profile (sensitive fields route to internal approval) and manage team members.
- **COMPANY_TECHNICAL** — deep access to **Feedback** and **Projects & Products** (uploads test results, submits technical feedback).
- **COMPANY_LOGISTICS** — owns **Sample Requests** and delivery confirmation; manages shipments for the company.
- **COMPANY_FINANCE** — read access to financial/commercial **Documents** shared to the company; submits finance-facing requests.
- **COMPANY_MEMBER** — general read access plus the ability to submit sample and support requests.

---

## 6. Matrix 4 — External Roles × Portal Actions

| Portal Action | COMPANY_OWNER | COMPANY_MEMBER | COMPANY_TECHNICAL | COMPANY_LOGISTICS | COMPANY_FINANCE |
|---|---|---|---|---|---|
| Request a sample | Allowed | Allowed | Allowed | Allowed | Denied |
| Confirm delivery | Allowed | Denied | Denied | Allowed | Denied |
| Submit feedback | Allowed | Allowed | Allowed | Allowed | Allowed |
| Upload test results | Allowed | Denied | Allowed | Denied | Denied |
| Edit company info (non-sensitive) | Allowed | Denied | Denied | Denied | Denied |
| Submit sensitive edit for approval | Allowed&nbsp;† | Denied | Denied | Denied | Denied |
| Request a meeting | Allowed | Allowed | Allowed | Allowed | Allowed |
| Request documentation | Allowed | Allowed | Allowed | Allowed | Allowed |

† **Sensitive edits** (legal name, VAT / tax ID, registered address, primary owner contact) are **never applied directly**. The portal captures the change and creates an internal **Registration / Change request** that an internal role (CRM_ADMIN / BUSINESS_DEV) must **approve** before it takes effect. Non-sensitive profile fields (phone, notes, logo) can be edited live by COMPANY_OWNER.

---

## 7. Mapping to `lib/permissions`

All gating derives from a **single role&rarr;permission matrix** in `lib/permissions`. There are **no scattered role checks** in components, services, or routes — everything funnels through two helpers.

### 7.1 Matrix config shape

The matrix is a record keyed by **role**, each entry pairing a per-section access map with a set of allowed actions:

```ts
type Role =
  | 'SUPER_ADMIN' | 'CRM_ADMIN' | 'BUSINESS_DEV' | 'RND_TECHNICAL'
  | 'LOGISTICS' | 'FINANCE' | 'MANAGEMENT_READONLY'
  // external
  | 'COMPANY_OWNER' | 'COMPANY_MEMBER' | 'COMPANY_TECHNICAL'
  | 'COMPANY_LOGISTICS' | 'COMPANY_FINANCE';

type AccessLevel = 'full' | 'edit' | 'view' | 'hidden';

type Section =
  | 'overview' | 'companies' | 'contacts' | 'pipeline' | 'samples'
  | 'shipments' | 'feedback' | 'projects' | 'products' | 'documents'
  | 'finance' | 'activities' | 'tasks' | 'calendar' | 'communications'
  | 'analytics' | 'notifications' | 'registrations' | 'users'
  | 'importExport' | 'settings' | 'audit'
  // portal sections
  | 'portalDashboard' | 'portalProfile' | 'portalSamples' | 'portalFeedback'
  | 'portalProjects' | 'portalDocuments' | 'portalRequests';

type Action =
  | 'company.createEdit' | 'pipeline.changeStage' | 'sample.approve'
  | 'shipment.updateStatus' | 'feedback.technicalReply' | 'nda.prepareSend'
  | 'nda.markSigned' | 'finance.edit' | 'registration.approve'
  | 'users.manage' | 'data.export' | 'settings.edit'
  // portal actions
  | 'portal.requestSample' | 'portal.confirmDelivery' | 'portal.submitFeedback'
  | 'portal.uploadResults' | 'portal.editCompany' | 'portal.submitSensitiveEdit'
  | 'portal.requestMeeting' | 'portal.requestDocs';

interface RolePermissions {
  sections: Record<Section, AccessLevel>;
  actions: Set<Action>;
}

// the single source of truth — one entry per role
const PERMISSION_MATRIX: Record<Role, RolePermissions> = {
  LOGISTICS: {
    sections: { samples: 'full', shipments: 'full', companies: 'view', /* … */ finance: 'hidden' },
    actions: new Set(['sample.approve', 'shipment.updateStatus', 'data.export']),
  },
  // … one entry per role, transcribing Matrices 1–4 above …
};
```

- **Matrix 1 & Matrix 3 (sections)** populate `sections: Record<Section, AccessLevel>`.
- **Matrix 2 & Matrix 4 (actions)** populate `actions: Set<Action>` — membership means "Allowed."

### 7.2 The `can()` / `canView()` helpers

```ts
// canView — drives navigation visibility AND route guards.
// Returns false only for the 'hidden' level; 'view' | 'edit' | 'full' are visible.
function canView(role: Role, section: Section): boolean {
  return PERMISSION_MATRIX[role].sections[section] !== 'hidden';
}

// access — when a component needs the precise level (e.g. show read-only vs editable UI).
function access(role: Role, section: Section): AccessLevel {
  return PERMISSION_MATRIX[role].sections[section];
}

// can — drives action availability (buttons, menu items, form submit).
function can(role: Role, action: Action): boolean {
  return PERMISSION_MATRIX[role].actions.has(action);
}
```

- `canView(role, section)` decides whether a section appears in navigation and whether its route renders. A **Hidden** cell &rarr; `false` (nav item not rendered, route guard redirects/blocks). **View / Edit / Full** &rarr; `true`; the read-vs-write distinction within the section is then resolved by `access()` and by `can()` for the mutating controls.
- `can(role, action)` decides whether a specific control (e.g. "Approve sample", "Mark NDA signed", "Export data") is rendered and enabled. **Allowed** &rarr; `true`; **Denied** &rarr; `false`.

### 7.3 Route guards

Each internal route group and the portal route group wrap their layout in a guard that calls `canView(session.role, section)` for the section that route maps to. If it returns `false`, the guard redirects to a safe landing page (Overview for internal, Dashboard for portal) instead of rendering. Navigation menus iterate the section list and render only items where `canView` is `true`, so the menu and the guards stay in lock-step from one matrix.

### 7.4 External company scoping

External roles are additionally constrained to **their own company's data**. In this prototype that scoping is applied **inside the mock services** (`companyService`, `sampleService`, `shipmentService`, `feedbackService`, `projectService`, `documentService`, `registrationService`, …), which filter every query by the authenticated `DemoSession`'s `companyId` (managed by `authService` in `localStorage`). Components consume data **only via services** — never by importing fixtures directly — so company scoping cannot be casually bypassed at the component layer in the demo. The **sensitive-edit approval flow** is likewise a service call: the portal action enqueues a Registration / Change request (via `registrationService` / `companyService`) rather than mutating the record, and an internal `registration.approve` action commits it.

**Consistency rule:** navigation, route guards, and every actionable control read from these helpers. When a new section or action is added, it is added **once** to the matrix in `lib/permissions`, and both the UI and (later) the server authorization layer consume the same definition.

---

## 8. Production Hand-off — Re-enforce Server-Side

> **THIS PHASE IS CLIENT-SIDE / DEMO ONLY.** The matrices and helpers above shape the **experience** — they hide what a role cannot do and gate navigation — but they **do not secure any data**. All checks run in the browser and can be bypassed.
>
> **Every rule in this document MUST be re-enforced server-side in the real backend.** Specifically, when the backend lands:
>
> 1. **Authentication** — replace `DemoSession` / `localStorage` with real signed sessions (HTTP-only, `Secure`, `SameSite` cookies / JWT). The role must live in the verified session, never in client state.
> 2. **Authorization** — mirror **Matrix 1 & Matrix 2** in API middleware / server actions; reject unauthorized sections and actions on **every request**, regardless of UI state.
> 3. **Company scoping** — enforce **row-level security** so external users physically cannot fetch another company's data. Never trust a client-supplied `companyId`; derive it from the session.
> 4. **Confidentiality classes** — enforce Pre-NDA / Post-NDA / Company Specific / Internal Only at the document API. **Internal Only** assets must be unreachable from any portal endpoint.
> 5. **Approval workflows** — sensitive company edits and external registrations must transactionally enqueue and require an internal approver (`registration.approve`) before commit.
> 6. **Audit** — log all mutations and authorization decisions to a tamper-evident Audit Log.
>
> **Reminder:** until the above is delivered, this CRM is a **demo**. The permission matrix shapes the experience; it does not protect the data.
