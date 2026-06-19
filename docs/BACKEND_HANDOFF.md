# ITALPROTEIN CRM — Backend Integration Handoff

**Project:** ITALPROTEIN CRM (working prototype)
**Owner:** Italprotein Srl — Proamina&reg; commercial operations
**Phase:** Frontend-first prototype (mock service layer) → future backend integration
**Document status:** Forward-looking integration guide (specification only)
**Last updated:** 2026-06-16

> **Scope disclaimer — read first.** This document is a **plan for a future backend phase**. It describes what a real backend, authentication provider, database, file store, email service, and third-party integrations will need to do *when they are built*. **Nothing in this document has been implemented.** **No database, no migrations, no server, no API, and no live integrations were created in this phase.** The shipped artifact remains a **frontend-first prototype**: a typed mock service layer reading TypeScript/JSON fixtures with a `localStorage` overlay for demo mutations, and a **Demo Mode** authentication shim that is explicitly **not** a production security boundary.
>
> Throughout, the marker **[Mock → Backend]** identifies a behavior currently simulated in the frontend that a real backend will later own. The marker **[Future]** identifies capabilities that do not exist in the prototype at all (MFA, email verification, real payments, e-signature, etc.).

---

## Table of Contents

1. [Overview & Guiding Principle — Services Are the Seam](#1-overview--guiding-principle--services-are-the-seam)
2. [Future Authentication & Session Security](#2-future-authentication--session-security)
3. [Required Data Entities](#3-required-data-entities)
4. [API Endpoints / Server Actions per Service](#4-api-endpoints--server-actions-per-service)
5. [Pages Currently Using Mock Services (Routes → Services)](#5-pages-currently-using-mock-services-routes--services)
6. [Actions That Must Trigger Email (Gmail)](#6-actions-that-must-trigger-email-gmail)
7. [Actions Requiring Audit Logging](#7-actions-requiring-audit-logging)
8. [Documents Needing Protected / Permissioned Storage](#8-documents-needing-protected--permissioned-storage)
9. [Permissions to Enforce Server-Side](#9-permissions-to-enforce-server-side)
10. [Workflows Needing Scheduled Jobs](#10-workflows-needing-scheduled-jobs)
11. [Integration Placeholders](#11-integration-placeholders)
12. [Migration & Cutover Notes](#12-migration--cutover-notes)

---

## 1. Overview & Guiding Principle — Services Are the Seam

The entire prototype was deliberately built so that **`lib/mock-services` is the single seam between the UI and "data."** Every page, feature, and component reaches data **only** through a named, async, typed service (`companyService`, `sampleService`, etc.) — components **never** import fixtures directly. This is enforced as an architectural rule.

**The core handoff principle:**

> A real backend replaces the implementation behind `lib/mock-services` **without rewriting the UI**. Each mock service already exposes the method signatures (`list`, `get`, `create`, `update`, `changeStatus`, …) and typed return shapes the UI consumes. The backend phase swaps the *body* of those methods from "read fixture + localStorage overlay" to "call the real API / server action," while keeping the *contract* identical.

```
                       ┌─────────────────────────────────────────────┐
   TODAY (prototype)   │  UI (pages / features / components)          │
                       └───────────────────┬─────────────────────────┘
                                           │  same typed contracts
                       ┌───────────────────▼─────────────────────────┐
                       │  lib/mock-services  (companyService, …)      │
                       │  ── fixture read + localStorage overlay ──   │
                       └───────────────────┬─────────────────────────┘
                                           │
                       ┌───────────────────▼─────────────────────────┐
                       │  fixtures/*.ts   +   localStorage overlay    │
                       └─────────────────────────────────────────────┘

                       ┌─────────────────────────────────────────────┐
   LATER (backend)     │  UI (UNCHANGED)                              │
                       └───────────────────┬─────────────────────────┘
                                           │  SAME typed contracts
                       ┌───────────────────▼─────────────────────────┐
                       │  lib/services  (companyService, …)           │
                       │  ── fetch / Next.js Server Actions ──        │
                       └───────────────────┬─────────────────────────┘
                                           │  HTTPS / RPC
                       ┌───────────────────▼─────────────────────────┐
                       │  Backend API + DB + Auth + Storage + Email   │
                       └─────────────────────────────────────────────┘
```

**What stays the same at cutover**

| Layer | Prototype | After backend | Change? |
|---|---|---|---|
| UI pages / components | Consume services | Consume services | **No** |
| Service method signatures | `list/get/create/update/changeStatus` | Identical | **No** |
| Typed entity shapes (TS types) | Defined in fixtures/types | Become DTOs / API response types | Shared, minimal drift |
| Permission gating (`can`/`canView`) | Single matrix in `lib/permissions` | **Mirrored** server-side; UI matrix retained for visibility | UI keeps, server adds |
| Data source | Fixtures + `localStorage` | Real DB via API | **Yes (behind the seam)** |
| Auth | `authService` Demo Mode | Real auth provider | **Yes (behind the seam)** |

**Practical implication for the backend team.** Treat the existing service method list (Section 4) and entity shapes (Section 3) as the **API contract to honor**. Implement Next.js Server Actions or a REST/GraphQL layer behind services named identically, return the same shapes, and the UI continues to work. Where the backend adds capability (server-side authorization, audit, email, signed URLs), it does so *inside* the service implementation, not in the UI.

> **[Mock → Backend]** Row-level company scoping (portal users see only their own company) is enforced today *inside the mock services by company id*. This must become **server-side authorization** — never trust a client-supplied company id.

---

## 2. Future Authentication & Session Security

**Today (prototype, Demo Mode only).** `authService` manages a `DemoSession` object in `localStorage`. Demo accounts live in `fixtures/users.ts`, one per internal and external role, with an in-UI role switcher for demonstration. There are **no passwords, no verification, no server-side sessions, and no real security boundary** — and this is clearly labelled in the UI. **None of the items below exist yet.**

**[Future] Target production authentication model.**

| Concern | Prototype (now) | Production target [Future] |
|---|---|---|
| **Admin onboarding** | All 7 internal demo users pre-seeded | **Invitation-based only.** A seeded super-admin invites admins; the initial allowlist (`assets/list of approved initial admin users.txt` — Internal Only, personal emails) seeds the first invitations. No open admin self-registration. |
| **External onboarding** | Demo external users pre-seeded | Public `/register` → internal Registrations queue → `CRM_ADMIN` approval → server provisions a company + owner user and **emails an invitation/activation link**. |
| **Email verification** | None | Mandatory for all new accounts (admin invitation and approved external registrations). Single-use, expiring token; account inactive until verified. |
| **Credential storage** | None (no passwords) | Passwords hashed with a memory-hard algorithm (Argon2id / bcrypt) + per-user salt; never stored or logged in plaintext. Password policy + breach-list check. Or delegate entirely to an identity provider (see below). |
| **MFA** | None | TOTP (authenticator app) as baseline; optionally WebAuthn/passkeys. **Required for all internal roles**, especially `SUPER_ADMIN` / `CRM_ADMIN` / `FINANCE`; configurable-required for external `COMPANY_OWNER`. |
| **Sessions** | `DemoSession` in `localStorage` | Server-issued sessions: HTTP-only, `Secure`, `SameSite` cookies; short-lived access + rotating refresh; server-side revocation; idle + absolute timeouts; device/session list. No tokens in `localStorage`. |
| **Role enforcement** | UI-only via permission matrix | **Server-side enforcement on every request/action** (Section 9). The role lives in the verified session, not in client state. The UI matrix becomes a *usability* layer (hide what you can't do); the server is the *authority*. |
| **Identity provider option** | — | Optionally adopt an IdP (e.g. Auth.js/NextAuth, Clerk, Auth0, or self-hosted Keycloak) to provide verification, MFA, session management, and SSO for internal staff. The `authService` contract stays; its body delegates to the IdP. |
| **Account lifecycle** | — | Invite → verify → active → (suspend / disable / offboard). Disabling a user immediately revokes sessions and removes portal/admin access. |
| **Password reset** | — | Email-based, single-use expiring token; reset invalidates existing sessions. |

**Authentication-related email triggers** (registration approval/rejection, invitations, verification, password reset) are catalogued in Section 6.

> **Replacement boundary:** `authService` is the only place the UI learns "who am I and what role." Replacing its `localStorage` Demo Mode body with real auth (IdP-delegated or in-house) is the auth cutover. The UI's calls to `authService.getSession()` / `can()` / `canView()` do not change.

---

## 3. Required Data Entities

The following entities back the CRM. Field lists are the **minimum** the backend must persist; relationships are expressed as foreign keys. Types/enums are the canonical status taxonomies from the Product Spec. **[Mock → Backend]** these are TypeScript types over fixtures today and become real tables/collections later. **No schema or migration has been created.**

Conventions: every entity has `id` (uuid), `createdAt`, `updatedAt`, and (where mutated) `createdBy` / `updatedBy` (→ `User`). Money is stored as integer minor units + ISO `currency` (`EUR` primary; `GBP`/`USD`/`CHF`). Quantities for samples/shipments are numeric + unit (`g`/`kg`). All entities are bilingual-display but stored canonical; localized labels come from enums + i18n, not stored per-locale text.

### 3.1 Core commercial entities

| Entity | Key fields | Relationships |
|---|---|---|
| **Company** | `name`, `type` (Distributor, Food & Beverage Manufacturer, HoReCa, Bakery Manufacturer, Dairy Manufacturer, Confectionery Manufacturer, Ingredient Company, Retailer, Agency, Laboratory, Consultant, Other), `segment` (Bar/HoReCa, Pasticcerie/Bakeries, International Export, E-commerce B2C), `country`, `vatId`, `website`, `addresses[]`, `lifecycleStage`, `ownerUserId`, `language` | 1—* `Contact`, `Opportunity`, `SampleRequest`, `Shipment`, `Feedback`, `ApplicationProject`, `NDA`, `Document`, `Quote`, `Order`, `Invoice`, `Activity`, `User` (external) |
| **Contact** | `companyId`, `firstName`, `lastName`, `title`, `email`, `phone`, `role` (commercial/technical/logistics/finance), `language`, `isPrimary`, `channel` | *—1 `Company`; referenced by `Activity`, `Meeting`, `SampleRequest`, `Feedback` |
| **Opportunity** | `companyId`, `name`, `stage` (Lead → Qualified → NDA → Sampling → Testing → Application Project → Commercial Discussion → Won/Lost), `segment`, `value` (minor units), `currency`, `probability`, `ownerUserId`, `expectedCloseDate`, `lostReason?` | *—1 `Company`; → `Quote`/`Order`; linked `SampleRequest`, `ApplicationProject` |
| **SampleRequest** | `companyId`, `contactId`, `productId`, `quantity`, `unit` (g/kg), `intendedApplication`, `destinationAddress`, `status` (Requested → Pending Approval → Approved → Rejected → Prepared → Shipped → Delivered → Closed), `approvedByUserId?`, `requestedVia` (portal/internal) | *—1 `Company`, `Contact`, `Product`; 1—1/1—* `Shipment`; → `Feedback` |
| **Shipment** | `companyId`, `sampleRequestId`, `carrier`, `trackingRef`, `originCountry`, `destinationCountry`, `isExtraEU` (customs-relevant), `customsDocs[]`, `status` (Pending → Preparing → In Transit → Delayed → Customs Hold → Delivered → Delivery Confirmed → Exception), `dispatchedAt?`, `expectedDeliveryAt`, `actualDeliveryAt?`, `confirmedByContactId?`, `lineItems[]`, `assignedLogisticsUserId` | *—1 `Company`, `SampleRequest`; assigned `User` (LOGISTICS) |
| **Feedback** | `companyId`, `contactId`, `sampleRequestId?`, `applicationProjectId?`, `status` (Submitted → In Review → Requires R&D Action → R&D In Progress → Resolved → Closed), `rating?`, `structuredResults` (sensory/stability/dosage), `freeText`, `requiresRnDAction` (bool), `rndOwnerUserId?`, `technicalReply?` | *—1 `Company`, `Contact`; → `SampleRequest`, `ApplicationProject`, `Task` (R&D) |
| **ApplicationProject** | `companyId`, `productId`, `name`, `status` (planning → in progress → successful/completed → on hold → discontinued), `technicalOwnerUserId`, `outcome?`, `linkedFeedbackIds[]`, `linkedSampleIds[]` | *—1 `Company`, `Product`; *—* `Feedback`, `SampleRequest`; portal-visible to owning company only |
| **Product** | `name`, `sku`, `format` (sachet pack / kg / B2C box), `segment`, `attributes` (sweetening power ~1.1×, vegan, non-GMO, allergen-free, Non-Novel Food, 0% EU duty…), `specs` (TDS-style), `indicativePrice`, `currency` | referenced by `SampleRequest`, `ApplicationProject`, `Quote`/`Order` lines |

### 3.2 Documents, NDAs & confidentiality

| Entity | Key fields | Relationships |
|---|---|---|
| **NDA** | `companyId`, `type` (mutual), `status` (Drafted → Sent → Under Review → Signed → Countersigned → Active → Expired/Declined), `effectiveDate?`, `expiryDate?`, `signedFileId?` (Internal Only), `counterpartySignerName?`, `sentAt?`, `signedAt?` | *—1 `Company`; *—1 `Document` (signed file); gates `Document` (Post-NDA) visibility |
| **Document** | `companyId?`, `title`, `type` (TDS, briefing, contract, NDA scan, marketing…), `confidentialityClass` (Public, Portal General, Pre-NDA, Post-NDA, Company Specific, Internal Only), `storageKey` (object-store ref), `mimeType`, `sizeBytes`, `version`, `uploadedByUserId` | *—1 `Company` (if scoped); referenced by `NDA`, `ApplicationProject`; served via signed URL (Section 8) |

### 3.3 Finance entities

| Entity | Key fields | Relationships |
|---|---|---|
| **Quote** | `companyId`, `opportunityId?`, `status` (Draft → Quoted → Confirmed → … per payment taxonomy), `lineItems[]` (`productId`, qty, unitPrice, currency), `subtotal`, `tax`, `total`, `currency`, `validUntil` | *—1 `Company`, `Opportunity`; → `Order` |
| **Order** | `companyId`, `quoteId?`, `status`, `lineItems[]`, `total`, `currency`, `orderedAt`, `fulfillmentRef?` | *—1 `Company`, `Quote`; → `Invoice` |
| **Invoice** | `companyId`, `orderId`, `number`, `status` (Draft → Issued → Partially Paid → Paid → Overdue → Cancelled), `issuedAt`, `dueAt`, `total`, `amountPaid`, `currency` | *—1 `Company`, `Order`; 1—* `Payment`, `CreditNote` |
| **Payment** | `invoiceId`, `amount`, `currency`, `method`, `receivedAt`, `reference` | *—1 `Invoice` |
| **CreditNote** | `invoiceId`, `amount`, `currency`, `reason`, `issuedAt`, `number` | *—1 `Invoice` |

> **[Future]** All finance entities are illustrative in the prototype — **no money moves, no real invoicing**. `Invoice`, `Payment`, and `CreditNote` are modeled now so the finance UI and overdue logic (Section 10) have shapes to bind to; the actual accounting/payment system is a Section 11 placeholder.

### 3.4 Activity, scheduling & engagement

| Entity | Key fields | Relationships |
|---|---|---|
| **Task** | `title`, `description`, `assigneeUserId`, `dueDate`, `status` (open → in progress → done → cancelled), `priority`, `relatedEntityType`, `relatedEntityId`, `source` (manual / R&D-generated) | polymorphic link to any entity; surfaced in Tasks + Overview |
| **Meeting** | `companyId?`, `contactIds[]`, `type` (introductory video call / technical session), `scheduledAt`, `durationMin`, `attendeeUserIds[]`, `status`, `notes?`, `outcome?` | *—1 `Company`; *—* `Contact`, `User` |
| **Activity** | `actorUserId`, `verb` (call/email/note/status-change/…), `entityType`, `entityId`, `summary`, `occurredAt`, `metadata` | polymorphic; unified timeline across all records |
| **Notification** | `recipientUserId`, `scope` (internal/company), `companyId?`, `type` (NDA signed, sample approved, shipment delayed, customs hold, feedback received, payment due, …), `title`, `body`, `readAt?`, `relatedEntityType`, `relatedEntityId` | *—1 `User`; mirrors lifecycle events |
| **Registration** | `companyName`, `companyType`, `country`, `applicantName`, `applicantEmail`, `applicantRoleRequested`, `status` (pending → approved → rejected), `reviewedByUserId?`, `reviewedAt?`, `rejectionReason?` | on approval → provisions `Company` + `User` (COMPANY_OWNER) + invitation email |

### 3.5 Identity, access & integrity

| Entity | Key fields | Relationships |
|---|---|---|
| **User** | `email`, `displayName`, `roleId`, `kind` (internal/external), `companyId?` (external only), `status` (invited / active / suspended / disabled), `passwordHash?` [Future], `mfaEnrolled` [Future], `emailVerifiedAt?` [Future], `lastLoginAt?`, `language` | *—1 `Role`; external *—1 `Company`; author of many entities |
| **Role** | `key` (SUPER_ADMIN, CRM_ADMIN, BUSINESS_DEV, RND_TECHNICAL, LOGISTICS, FINANCE, MANAGEMENT_READONLY, COMPANY_OWNER, COMPANY_MEMBER, COMPANY_TECHNICAL, COMPANY_LOGISTICS, COMPANY_FINANCE), `kind` (internal/external), `permissions[]` | 1—* `User`; source of the permission matrix |
| **AuditEvent** | `actorUserId`, `action`, `entityType`, `entityId`, `before?`, `after?`, `ip`, `userAgent`, `occurredAt`, `result` (success/denied) | *—1 `User`; append-only, immutable (Section 7) |
| **EmailLogEntry** | `triggerType`, `toAddresses[]`, `templateKey`, `relatedEntityType`, `relatedEntityId`, `status` (queued / sent / failed / bounced), `providerMessageId?`, `sentAt?`, `error?` | links to the entity whose event fired the email (Section 6) |

> **Roles & permissions** are seeded from the canonical matrix (Section 9 / `docs/PERMISSIONS.md`). `Role.permissions` and the `User.roleId` are the server-side source of truth that the API authorization layer reads.

---

## 4. API Endpoints / Server Actions per Service

Each mock service maps to a backend resource. The recommended implementation is **Next.js Server Actions** (co-located, typed, CSRF-friendly) for mutations and route handlers / server components for reads; a REST or GraphQL gateway is an equally valid alternative behind the same service facade. **Operations below mirror the existing mock-service method names so the swap is signature-compatible.** "Shape" is the typed entity (or list/DTO) the UI already expects.

> Standard operation set per service: `list(filter, page)` → `Entity[]` (paged); `get(id)` → `Entity`; `create(input)` → `Entity`; `update(id, patch)` → `Entity`; `changeStatus(id, status, meta)` → `Entity`. Services list only the operations they meaningfully support. All mutations are authorization-checked (Section 9) and may emit audit (Section 7), notifications, and email (Section 6).

| Service | Operations | Returned shape | Notes |
|---|---|---|---|
| **companyService** | list, get, create, update | `Company` / `Company[]` | Filters: type, segment, country, stage. Portal: scoped to own company. |
| **contactService** | list, get, create, update | `Contact` / `Contact[]` | Scoped by `companyId`. |
| **opportunityService** | list, get, create, update, changeStatus (stage) | `Opportunity` | `changeStatus` = pipeline stage transition; may emit Activity + Notification. |
| **sampleService** | list, get, create, update, changeStatus | `SampleRequest` | `changeStatus` drives the sample taxonomy; approve/reject + dispatch trigger email. |
| **shipmentService** | list, get, create, update, changeStatus | `Shipment` | `changeStatus` = dispatch / delay / customs hold / delivered / confirmed → email + notifications. |
| **feedbackService** | list, get, create, update, changeStatus, reply | `Feedback` | `create` from portal; `changeStatus` for R&D triage; `reply` = technical reply (email). |
| **projectService** | list, get, create, update, changeStatus | `ApplicationProject` | Portal-visible to owning company only. |
| **productService** | list, get, create, update | `Product` | Mostly read in portal; catalogue + specs. |
| **ndaService** | list, get, create, update, changeStatus, send, recordSignature | `NDA` | `send` / `changeStatus` / `recordSignature` fire NDA emails; signed file stored Internal Only. |
| **documentService** | list, get, create (upload), update, getSignedUrl, delete | `Document` / signed URL | **Confidentiality-class + NDA gated** (Section 8). Returns time-limited signed URL, never a public path. |
| **financeService** | list, get, create, update, changeStatus | `Quote`/`Order`/`Invoice` | Spans quotes/orders/invoices; status drives payment taxonomy; overdue invoice → email. |
| **taskService** | list, get, create, update, changeStatus | `Task` | R&D-generated tasks created by feedback flow; due/overdue → email + notification. |
| **activityService** | list, get, create | `Activity` | Append-only timeline; most entries are emitted by other services, not created directly. |
| **meetingService** | list, get, create, update, changeStatus | `Meeting` | Schedules introductory video calls / technical sessions. |
| **notificationService** | list, get, markRead, markAllRead, create | `Notification` | In-app centre + unread badge; scoped per user/company; backend also persists for email mirror. |
| **registrationService** | list, get, create (submit), changeStatus (approve/reject) | `Registration` | `create` = public submit; `approve` provisions Company + COMPANY_OWNER + invite email; `reject` → email. |
| **authService** | getSession, login, logout, verifyEmail [Future], enrollMfa [Future], requestPasswordReset [Future] | `Session` / `User` | **Demo Mode → real auth.** See Section 2. The only place the UI learns identity/role. |

> **[Mock → Backend]** Every operation above is currently a fixture read or a `localStorage` overlay write with simulated latency. The backend replaces the body; the signature, arguments, and returned shape are preserved so the UI is untouched.

---

## 5. Pages Currently Using Mock Services (Routes → Services)

Mapping of app routes to the services they consume today. After cutover, these same routes consume the real-backed services unchanged. Routes are under `/[locale]/…` (locales `en`/`it`, default `en`).

### 5.1 Public / auth routes

| Route | Services used |
|---|---|
| `/[locale]` (public landing) | productService (catalogue highlights), — (mostly static marketing) |
| `/[locale]/login` | authService |
| `/[locale]/register` | registrationService |

### 5.2 Internal CRM routes (`/[locale]/admin/*`)

| Route | Services used |
|---|---|
| `/admin/overview` | companyService, opportunityService, sampleService, shipmentService, feedbackService, taskService, notificationService, activityService |
| `/admin/companies` + `/admin/companies/[id]` | companyService, contactService, opportunityService, sampleService, shipmentService, feedbackService, projectService, ndaService, documentService, financeService, activityService |
| `/admin/contacts` + `/[id]` | contactService, companyService, activityService, meetingService |
| `/admin/pipeline` | opportunityService, companyService, activityService |
| `/admin/samples` + `/[id]` | sampleService, companyService, contactService, productService, shipmentService |
| `/admin/shipments` + `/[id]` | shipmentService, sampleService, companyService |
| `/admin/feedback` + `/[id]` | feedbackService, sampleService, projectService, taskService |
| `/admin/projects` + `/[id]` | projectService, companyService, productService, feedbackService, sampleService |
| `/admin/products` + `/[id]` | productService |
| `/admin/ndas` + `/[id]` | ndaService, documentService, companyService |
| `/admin/documents` | documentService, companyService, ndaService |
| `/admin/finance` (quotes/orders) + `/[id]` | financeService, companyService, opportunityService, productService |
| `/admin/activities` | activityService |
| `/admin/tasks` | taskService |
| `/admin/calendar` | meetingService, contactService |
| `/admin/communications` | activityService, contactService, companyService |
| `/admin/analytics` | opportunityService, sampleService, shipmentService, feedbackService, financeService |
| `/admin/notifications` | notificationService |
| `/admin/registrations` | registrationService, companyService |
| `/admin/users` (Users & Roles) | authService, — (user/role admin) |
| `/admin/import-export` | companyService, contactService |
| `/admin/settings` | authService (preferences), — |
| `/admin/audit` (Audit Log) | activityService / AuditEvent reader |

### 5.3 External portal routes (`/[locale]/portal/*`)

| Route | Services used |
|---|---|
| `/portal/dashboard` | companyService, sampleService, shipmentService, feedbackService, notificationService |
| `/portal/company` (Company Profile) | companyService, contactService |
| `/portal/samples` (Sample Requests) | sampleService, productService, shipmentService |
| `/portal/feedback` (Feedback & Technical Results) | feedbackService, sampleService |
| `/portal/projects` (Application Projects & Products) | projectService, productService |
| `/portal/documents` | documentService, ndaService |
| `/portal/support` (Requests & Support) | (support request service / notificationService) |
| `/portal/notifications` | notificationService |

> All portal routes are **company-scoped**. **[Mock → Backend]** scoping is enforced in the mock services by company id today; the backend must enforce it server-side from the authenticated session, ignoring any client-supplied company id.

---

## 6. Actions That Must Trigger Email (Gmail)

**[Future] No email is sent in the prototype.** These are the events that, once a real backend exists, must enqueue an outbound email via the **Gmail API** (Section 11) and record an `EmailLogEntry` (Section 3.5). Templates are bilingual (recipient's `language`: `en`/`it`). "Recipient" is resolved from the related entity (company contact, assigned internal user, etc.).

| # | Trigger action | Service / event | Recipient(s) | Template (key) |
|---|---|---|---|---|
| 1 | **Registration approved** | registrationService.changeStatus → approved | Applicant (new COMPANY_OWNER) | `registration_approved` (welcome + activation/verification link) |
| 2 | **Registration rejected** | registrationService.changeStatus → rejected | Applicant | `registration_rejected` (reason) |
| 3 | **Admin invitation** [Future] | user invite (Users & Roles) | Invited internal user | `admin_invitation` (invite + verification link) |
| 4 | **Email verification** [Future] | authService.verifyEmail flow | New user | `email_verification` |
| 5 | **Password reset** [Future] | authService.requestPasswordReset | Requesting user | `password_reset` |
| 6 | **Sample request approved** | sampleService.changeStatus → Approved | Requesting company contact (+ COMPANY_LOGISTICS) | `sample_approved` |
| 7 | **Sample request rejected** | sampleService.changeStatus → Rejected | Requesting company contact | `sample_rejected` (reason) |
| 8 | **Shipment dispatched** | shipmentService.changeStatus → In Transit | Company logistics + technical contact | `shipment_dispatched` (carrier + tracking ref) |
| 9 | **Customs hold** | shipmentService.changeStatus → Customs Hold | Company logistics contact + internal LOGISTICS | `shipment_customs_hold` (action needed) |
| 10 | **Shipment delayed** | shipmentService.changeStatus → Delayed | Company logistics contact | `shipment_delayed` (new expected date) |
| 11 | **Delivery confirmation** | shipmentService.changeStatus → Delivered / Delivery Confirmed | Company contact + internal owner (BUSINESS_DEV/LOGISTICS) | `delivery_confirmed` (+ feedback prompt) |
| 12 | **Feedback submitted** | feedbackService.create (from portal) | Assigned RND_TECHNICAL + opportunity owner | `feedback_submitted` |
| 13 | **Technical reply sent** | feedbackService.reply / changeStatus → Resolved | Company technical contact | `feedback_technical_reply` |
| 14 | **NDA sent** | ndaService.send / changeStatus → Sent | Company owner/technical signer | `nda_sent` (review + sign) |
| 15 | **NDA changes requested** | ndaService.changeStatus → Under Review (with comments) | Both parties (internal owner + company signer) | `nda_changes` |
| 16 | **NDA signed / countersigned** | ndaService.recordSignature / changeStatus → Signed/Countersigned/Active | Both parties | `nda_signed` (confirmation; unlocks Post-NDA docs) |
| 17 | **NDA expiry approaching** | scheduled job (Section 10) | Company owner + internal owner | `nda_expiry_reminder` |
| 18 | **Task due / overdue** | taskService due-date + scheduled job | Task assignee (internal) | `task_due` / `task_overdue` |
| 19 | **Support request opened** | support request create (portal) | Triage queue / CRM_ADMIN + BUSINESS_DEV | `support_request_opened` |
| 20 | **Support request answered** | support request reply | Requesting company contact | `support_request_answered` |
| 21 | **Invoice overdue** | scheduled job (Section 10) on Invoice past `dueAt` | Company finance contact + internal FINANCE | `invoice_overdue` |

> **Confidentiality in email:** emails may contain links to the portal or to **signed, expiring document URLs** (Section 8) — never raw attachments of Post-NDA/Company-Specific/Internal documents, and never any Internal Only material to external recipients.

---

## 7. Actions Requiring Audit Logging

**[Mock → Backend]** The prototype has an illustrative Audit Log view (`/admin/audit`) backed by activity-style fixtures. In production, every action below writes an **immutable, append-only `AuditEvent`** (actor, action, entity, before/after, IP, user-agent, timestamp, allowed/denied). Audit writes happen server-side inside the service implementation and must not be suppressible by the UI.

| Domain | Audited actions |
|---|---|
| **Authentication / access** [Future] | login success/failure, logout, MFA enroll/verify, password reset, session revoke, account invite/verify/suspend/disable |
| **Users & roles** | create/update/disable user, **role change / permission grant**, invitation issued |
| **Registrations** | submit, approve (→ provisioning), reject |
| **Companies / contacts** | create, update, delete/merge, ownership change |
| **Opportunities** | create, **stage change**, value change, won/lost |
| **Samples** | create, **approve / reject**, prepare, status change |
| **Shipments** | create, **dispatch**, delay, **customs hold**, deliver, delivery confirm, exception |
| **Feedback / R&D** | submit, triage, **flag requires R&D action**, technical reply, resolve |
| **Application projects** | create, status change, outcome recorded |
| **NDAs** | draft, **send**, changes requested, **sign / countersign**, activate, expire, decline |
| **Documents** | **upload**, update, delete, confidentiality-class change, **signed-URL issuance / access** |
| **Finance** | quote create/confirm, order create, **invoice issue**, payment record, **credit note issue**, status change |
| **Tasks / meetings** | create, reassign, status change, schedule/cancel |
| **Permission decisions** | **every denied (403) authorization attempt** is audited (security signal) |
| **Settings / import-export** | settings/taxonomy change, **bulk import commit**, **data export** |

> Audited actions overlap heavily with email triggers (Section 6) and status transitions (Section 4) — the same status-change call typically emits Activity, Notification, AuditEvent, and (if applicable) an email.

---

## 8. Documents Needing Protected / Permissioned Storage

**[Future] No real file storage exists in the prototype** — documents are fixture metadata only, and confidential source files (real NDAs, investor deck, business plan, one-pager financials, admin email list) are deliberately **kept out of the build**. In production, documents move to a **private object store** (Section 11) and are served **only via short-lived signed URLs** issued by `documentService.getSignedUrl(id)` after a server-side permission + NDA check. **No document is ever a public static path.**

| Confidentiality class | Storage / access requirement | Who may obtain a signed URL |
|---|---|---|
| **Public** | May be served from public/CDN (logos, public marketing) | Anyone |
| **Portal General** | Private store; signed URL for any authenticated portal user of any company | Any portal user (own scope) + all internal |
| **Pre-NDA** | Private store; signed URL gated by company scope | Company users + internal (no NDA required) |
| **Post-NDA** | Private store; signed URL **only if the company has an Active NDA** | Company users **with executed NDA** (e.g. comparative TDS) + internal |
| **Company Specific** | Private store; signed URL **only to that company's users** | Owning company users + internal (per role) |
| **Internal Only** | Private store; **never** issued to any external/portal user under any condition | Internal roles only, per matrix (e.g. signed NDA files, investor/business material) |

**Signed-URL rules:**

- URLs are **time-limited** (short TTL), single-purpose, and tied to the requesting session; expiry is enforced by the object store.
- Issuance is **logged** as an `AuditEvent` (Section 7), including the class and requester.
- The server re-checks **confidentiality class + NDA status + company scope + role** on every issuance — never relies on a previously issued URL or client assertion.
- Emails (Section 6) link to issuance endpoints / the portal, not to raw files; Internal Only files are never linked to external recipients.

> **Hard rule (carried from Asset Inventory):** real client NDAs, the investor deck, business plan, one-pager financials, and the initial-admin email list are **Internal Only** and must **never** be obtainable through the portal — enforced by class + role server-side, not by obscurity.

---

## 9. Permissions to Enforce Server-Side

**[Mock → Backend]** The prototype enforces permissions **only in the UI** via the single role→permission matrix in `lib/permissions` (`can(role, action)`, `canView(role, section)`). In production, **the same matrix must be mirrored and enforced server-side** on every read and mutation. The UI matrix stays (for hiding what a user cannot do); the server becomes the authority. **Never trust the client's claimed role or company id** — derive both from the verified session.

### 9.1 Enforcement model

| Aspect | UI (prototype, retained) | Server (production, authoritative) |
|---|---|---|
| Section visibility | `canView(role, section)` hides nav | Route handler rejects unauthorized section access |
| Action availability | `can(role, action)` hides/disables buttons | Server action rejects unauthorized mutation (403, audited) |
| Company scoping | service filters by company id | Server filters by **session** company id; ignores client id |
| Confidentiality | class checks in documentService | Server re-checks class + NDA + scope before signed URL |

### 9.2 Role → authority summary (mirror of `docs/PERMISSIONS.md`)

| Role | Server-enforced authority (high level) |
|---|---|
| **SUPER_ADMIN** | Full CRUD across all entities; user/role management; settings; import/export; audit read. |
| **CRM_ADMIN** | Manage companies/contacts; approve/reject registrations; configure lists; import/export; no finance write beyond scope. |
| **BUSINESS_DEV** | Manage opportunities, meetings, NDAs (drive), sample requests, activities; commercial discussion. |
| **RND_TECHNICAL** | Feedback triage/reply, application projects, product/technical docs; create R&D tasks. |
| **LOGISTICS** | Samples-to-send, shipments, tracking, delay/customs/delivery transitions. |
| **FINANCE** | Quotes/orders/invoices/payments/credit notes; finance analytics. |
| **MANAGEMENT_READONLY** | Read-only across analytics, pipeline, reports — **no writes** anywhere. |
| **COMPANY_OWNER** | Full portal access for **own company**; manage members; accept/sign NDAs; view commercial discussion. |
| **COMPANY_MEMBER** | Read own-company dashboard, profile, samples, projects, notifications. |
| **COMPANY_TECHNICAL** | Submit/track feedback & technical results; view projects/products; access **Post-NDA** docs. |
| **COMPANY_LOGISTICS** | Track shipments, tracking, expected delivery; confirm receipt. |
| **COMPANY_FINANCE** | View own-company quotes/orders, payment status, finance documents. |

> Every external role is **hard-scoped to its own company** server-side. No external role may ever reach Internal Only material or another company's data. Denied attempts are audited (Section 7).

---

## 10. Workflows Needing Scheduled Jobs

**[Future] No scheduler exists in the prototype.** These time-based workflows require background jobs (cron / queue workers) once a backend exists. Each typically emits notifications (Section 6 email + in-app) and audit entries.

| Job | Cadence | Logic | Actions fired |
|---|---|---|---|
| **NDA expiry reminders** | Daily | Find `NDA` where `expiryDate` within N days (e.g. 30/14/7) and status Active | `nda_expiry_reminder` email + notification to company owner & internal owner; flag on board |
| **Delivery-delay detection** | Hourly / daily | Find `Shipment` In Transit past `expectedDeliveryAt` and not delivered | Set status Delayed; `shipment_delayed` email; alert on logistics board & portal |
| **Feedback reminders** | Daily | Find `SampleRequest` Delivered/confirmed > N days with no `Feedback` | Reminder notification/email to company technical contact; prompt internal follow-up |
| **Dormant-account detection** | Weekly | Find `Company` with no `Activity` for > N days (e.g. 60/90) | Internal notification/task to BUSINESS_DEV to re-engage |
| **Invoice overdue** | Daily | Find `Invoice` past `dueAt`, status not Paid/Cancelled | Set/keep Overdue; `invoice_overdue` email to company finance + internal FINANCE; notification |
| **Task reminders** | Hourly / daily | Find `Task` due today or overdue, not done | `task_due` / `task_overdue` email + notification to assignee; surface on Overview |
| **(Maintenance) email-log retry** | Frequent | Retry `EmailLogEntry` in `failed` state (bounded) | Re-enqueue to Gmail API; mark `failed` permanently after N attempts |

> Thresholds (`N` days) are configurable settings (Settings section). All jobs must be **idempotent** (safe to re-run) and must **not** double-send within a window.

---

## 11. Integration Placeholders

**[Future] None of the following integrations exist in the prototype.** Each is a clearly bounded placeholder that connects *behind a service*, preserving the UI contract. No credentials, SDKs, or live calls are present today.

| Integration | Replaces / powers | Connects via | Notes |
|---|---|---|---|
| **Gmail API** | All outbound email (Section 6); `EmailLogEntry` | Email-sending utility called from services + scheduled jobs | Bilingual templates (en/it); OAuth service account / domain-wide delegation for `@italprotein.com`; send + log + retry. Links to portal / signed URLs, never raw confidential attachments. |
| **Courier / carrier tracking** | `Shipment` tracking timeline & delay detection | shipmentService + tracking webhook/poller | Replaces mocked status advancement. Map carrier events → shipment status taxonomy; supports extra-EU customs states. |
| **Payment / invoicing system** | `Invoice` / `Payment` / `CreditNote`; finance analytics | financeService | Accounting/ERP or payment gateway. Prototype finance is illustrative only — **no money moves** until this lands. |
| **E-signature provider** | `NDA` send → sign → countersign flow; signed file capture | ndaService + e-sign webhook | Replaces manual status flips. On completion, store signed file Internal Only and set NDA Active (unlocks Post-NDA docs). |
| **Real file / object storage** | `Document` storage + signed URLs (Section 8) | documentService.getSignedUrl | Private object store (e.g. S3/GCS-style) with server-issued, time-limited, audited signed URLs; confidentiality-class + NDA + scope enforced on issuance. |
| **Auth / identity provider** (optional) | `authService`, sessions, MFA, verification (Section 2) | authService | Optional IdP (Auth.js/Clerk/Auth0/Keycloak) or in-house; either way the `authService` contract is unchanged. |
| **In-app push / realtime** (optional) | Live notification badge updates | notificationService | Optional websockets/SSE; not required for parity. |

---

## 12. Migration & Cutover Notes

**State of this phase (explicit):** **No backend, no database, no migrations, no API, no live integrations, and no real authentication were created.** This document is specification only. The deliverable remains the frontend-first prototype (mock services + fixtures + `localStorage` overlay + Demo Mode).

**Recommended cutover sequence (future phase):**

1. **Freeze contracts.** Treat Sections 3 (entities) and 4 (service operations) as the API contract. Share the existing TypeScript types as DTOs to prevent drift.
2. **Stand up data layer.** Create the schema/migrations for Section 3 entities; seed enums from the canonical taxonomies. Import existing CRM content (real companies, NDAs, documents from `assets/CLIENTI/`) **behind access control** — never as portal-visible fixtures.
3. **Implement auth (Section 2).** Replace `authService` Demo Mode with real auth (IdP or in-house): invitations, verification, MFA, server sessions. Seed the super-admin from the initial-admin allowlist; issue admin invitations.
4. **Back the services (Section 4).** Swap each mock service body for real API/Server Actions, preserving signatures. Migrate per service (companies/contacts first, then operational chain, then finance) so the UI keeps working throughout.
5. **Enforce server-side (Section 9).** Mirror the permission matrix; add company scoping from the session; audit every mutation and denied attempt (Section 7).
6. **Wire integrations (Section 11).** Add object storage + signed URLs (Section 8), Gmail email + `EmailLogEntry` (Section 6), then carrier tracking, finance/payment, and e-signature.
7. **Add scheduled jobs (Section 10).** Stand up the cron/queue workers for reminders and detection.
8. **Confidentiality verification.** Confirm Internal Only material is unreachable from the portal and that signed-URL gating holds under each role — re-verify against the Asset Inventory confidentiality classes before any production data load.

> **Invariant across the whole migration:** the UI consumes data and identity **only** through the named services (`lib/mock-services` → `lib/services`) and the permission matrix. As long as the backend honors those contracts and enforces authorization server-side, the frontend does not need to be rewritten.
