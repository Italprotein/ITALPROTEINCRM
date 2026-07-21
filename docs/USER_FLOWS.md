# ITALPROTEIN CRM — User Flows

> **STATUS UPDATE — 2026-07-21.** In `api` mode, staff and company users now have real workspace-bound Auth.js credentials, server sessions, account invitations, password activation/reset, server-side workspace guards, and Prisma-backed services. Registration approval transactionally provisions the company, primary contact, and invited portal owner. Flows 1 and 2 below describe that current implementation. Later business flows retain **[Mock]** or **[Future]** markers where their side effects or integrations are still simulated/unbuilt; see [`docs/LAUNCH_RUNBOOK.md`](./LAUNCH_RUNBOOK.md).

**Project:** ITALPROTEIN CRM
**Owner:** Italprotein Srl — Proamina&reg; commercial operations
**Phase:** Backend foundation complete; staging/launch hardening
**Document status:** Canonical step-by-step user-flow reference
**Last updated:** 2026-07-21

> **Mode boundary — read first.** Fixture/localStorage Demo Mode is development-only. In development, `NEXT_PUBLIC_DATA_MODE=mock` (or omission) selects it and `api` selects the backend. Production always forces PostgreSQL/Prisma, Auth.js, guarded Server Actions/Route Handlers, and live integrations even if the public variable is missing or says `mock`. Routes follow `/[locale]/…` with locales `en` (default) and `it`.

---

## Table of Contents

- [Conventions & Legend](#conventions--legend)
- [Flow 1 — Credential Login & Workspace Separation](#flow-1--credential-login--workspace-separation)
- [Flow 2 — Public Registration → Approval → Activation → Portal Access](#flow-2--public-registration--approval--activation--portal-access)
- [Flow 3 — Sample Request Creation (External) & Admin Review](#flow-3--sample-request-creation-external--admin-review)
- [Flow 4 — Sample Preparation → Shipment → Transit → Delivery → Receipt Confirmation](#flow-4--sample-preparation--shipment--transit--delivery--receipt-confirmation)
- [Flow 5 — Feedback Submission & R&D Review Round-Trip](#flow-5--feedback-submission--rd-review-round-trip)
- [Flow 6 — NDA Lifecycle (Draft → Signed → Post-NDA Unlock)](#flow-6--nda-lifecycle-draft--signed--post-nda-unlock)
- [Flow 7 — Pipeline Stage Change via Kanban Drag-and-Drop](#flow-7--pipeline-stage-change-via-kanban-drag-and-drop)
- [Flow 8 — Document Access by Role & NDA State](#flow-8--document-access-by-role--nda-state)
- [Flow 9 — Import Wizard (Client-Side Mock)](#flow-9--import-wizard-client-side-mock)
- [Flow 10 — Language Switch Preserving Route & Record](#flow-10--language-switch-preserving-route--record)
- [Flow 11 — Global Search & Command Palette](#flow-11--global-search--command-palette)
- [Cross-Flow Implementation Seams Summary](#cross-flow-implementation-seams-summary)

---

## Conventions & Legend

| Marker | Meaning |
|---|---|
| **[Mock]** | Behavior is simulated when `NEXT_PUBLIC_DATA_MODE=mock`, or a named business side effect is still fixture/overlay-only. |
| **[Future]** | Capability does not exist yet (for example e-signature or staff MFA). |
| `service.method()` | A call into a named mock service in `lib/mock-services`. Components **never** import fixtures directly. |
| **State change** | In `api` mode, a guarded Prisma write; in mock mode, a `localStorage` overlay mutation. |
| **Notification** | An in-app notification entry scoped by workspace, role, user, and/or company. Some lifecycle fan-out remains planned. |
| **Email-log event** | In `api` mode, a durable `email_logs` row whose delivery status is updated by Gmail; older mock-only flows explicitly say so. |
| **Activity** | An append-only `activityService.create(...)` timeline entry (verb + entity + summary), shown on Company 360 timelines and `/admin/activities`. |

**Status taxonomies referenced** (from `docs/PRODUCT_SPEC.md` §7–8):

- **Sample:** `Requested → Pending Approval → Approved → Rejected → Prepared → Shipped → Delivered → Closed`
- **Shipment:** `Pending → Preparing → In Transit → Delayed → Customs Hold → Delivered → Delivery Confirmed → Exception`
- **NDA:** `Drafted → Sent → Under Review → Signed → Countersigned → Active → Expired/Declined`
- **Feedback:** `Submitted → In Review → Requires R&D Action → R&D In Progress → Resolved → Closed`
- **Pipeline:** `Lead → Qualified → NDA → Sampling → Testing → Application Project → Commercial Discussion → Won/Lost`
- **Registration:** `pending → approved → rejected`
- **Confidentiality classes:** `Public · Portal General · Pre-NDA · Post-NDA · Company Specific · Internal Only`

**Roles** — Internal: `SUPER_ADMIN, CRM_ADMIN, BUSINESS_DEV, RND_TECHNICAL, LOGISTICS, FINANCE, MANAGEMENT_READONLY`. External (company-scoped): `COMPANY_OWNER, COMPANY_MEMBER, COMPANY_TECHNICAL, COMPANY_LOGISTICS, COMPANY_FINANCE`. All gating is via `can(role, action)` / `canView(role, section)` from the single matrix in `lib/permissions`.

---

## Flow 1 — Credential Login & Workspace Separation

**Actors:** Active internal staff and activated external company users.
**Routes:** `/[locale]/team-login` → `/[locale]/admin/*`; `/[locale]/login` → `/[locale]/portal/*`.
**Services:** Auth.js Credentials provider, `getCurrentUser()`, server authorization helpers, Prisma.
**Goal:** Authenticate at the correct door, use the current database identity, and prevent cross-workspace access.

> In `mock` mode the two pages still use seeded demo personas. The steps below describe production-intended `api` mode.

### 1.1 Internal staff login

1. Staff enters email/password at `/[locale]/team-login`; the form submits `workspace = internal` to Auth.js.
2. Authentication accepts any active internal role whose role row is also internal and whose bcrypt password matches. Login is rate-limited by IP and failed-account attempts.
3. Auth.js issues a JWT containing an `authVersion` snapshot. Protected layouts, Server Actions, and API routes re-read the User + Role row and compare the version. Suspension, role/status changes, password change/reset, or forced revocation therefore invalidate existing JWTs immediately.
4. The user lands in `/[locale]/admin`. Middleware and the admin server layout both reject an external identity; service reads/writes also enforce section/action permissions.
5. A valid internal session that requests `/portal` is redirected back to `/admin`.

### 1.2 External company-user login

1. The company user enters email/password at `/[locale]/login`; the form submits `workspace = external`.
2. Authentication requires an active external User, an external Role, a matching password, and a non-null `companyId`. Internal credentials are rejected at this door.
3. The user lands in `/[locale]/portal`. Middleware and the portal server layout reject an internal identity.
4. Real service reads and writes derive company scope from the verified current User, not from a client-supplied company id. Cross-company ids return no data or are forbidden.
5. A valid external session that requests `/admin` is redirected back to `/portal`.

### 1.3 Staff invitation and account administration

1. A user with `user.manage` can invite or resend invitations for non-super-admin staff. Recipient addresses are normalized and rejected if they are invalid or contain header/control injection.
2. Only a `super_admin` may create, resend, change, suspend, demote, or delete another `super_admin`; a `crm_admin` remains below that boundary.
3. An invited account cannot be manually marked active—it must consume its activation link. Administrators cannot suspend or delete themselves.
4. A serializable transaction refuses any demotion, suspension, or deletion that would remove the last active `super_admin`.
5. Role/status changes increment `authVersion`, revoke existing JWTs, and write an audit event.
6. Invite/resend quotas are 20 per acting user per hour and 5 per recipient account/email per hour. A resend token is staged first: successful delivery retires the older link; failed delivery retires only the candidate, preserving the previous working link.

```text
/team-login + internal credentials → Auth.js session → /admin
/login      + external credentials → Auth.js session(companyId) → /portal
wrong door or wrong workspace route → rejected / redirected
```

**Still required before public launch:** staff MFA, broader denied-access monitoring, and a full staging matrix across all roles and company-scoped resources.

---

## Flow 2 — Public Registration → Approval → Activation → Portal Access

**Actors:** Prospective customer → internal approver with `registration.approve` → invited portal owner.
**Routes:** `/[locale]/register` → `/[locale]/admin/registrations` → `/[locale]/activate?token=...` → `/[locale]/login` → `/[locale]/portal`.
**Services:** real `registrationService` actions, Prisma transaction, account-invitation helper, Auth.js, Gmail.
**Goal:** Review a public intake, provision one coherent company identity, and let the approved owner establish portal credentials.

### Part A — Public intake

1. The applicant submits the public registration form. `createRegistration()` is intentionally anonymous, but a strict server schema validates bounded text, enums, arrays, normalized email, and required privacy/terms consent.
2. The submission does **not** create a User or session and grants no portal access.
3. The server—not the browser—generates the reference, forces `pending_approval`, clears linkage/decision/admin fields, and records no forged creator. Limits are 8 submissions/IP/hour and 3/contact-email/hour.
4. CAPTCHA/WAF bot defense and the policy decision on a distinct pre-approval verification step remain. The current activation link proves mailbox control after approval.

### Part B — Guarded review and transactional provisioning

5. Internal staff can read the queue, but approval/rejection requires the `registration.approve` permission.
6. On approval, the server validates the assigned active internal account owner, the external `company_owner` role, and that the applicant email is not already a User account.
7. One Prisma transaction atomically:
   - claims the undecided Registration and marks it approved;
   - creates one Company and one primary Contact;
   - creates an `invited` external `company_owner` bound to both records;
   - stores only a hash of a new 72-hour activation token;
   - creates the RegistrationDecision and backfills all provisioned ids plus `linkedCompanyId`;
   - creates a queued invitation `email_logs` row and an audit event.
8. A repeated approval returns the already-complete result rather than duplicating records. A legacy/incomplete approval fails closed. Rejection is also transactional and provisions no account.
9. Gmail delivery runs only after the provisioning transaction commits. The durable email-log row becomes `sent` or `failed`; a mail outage does not roll back valid CRM records.
10. An authorized reviewer can resend the approved portal invitation. Resends use the same 20/actor/hour and 5/recipient/hour quotas and staged-token rule: only successful delivery retires the older working link.

### Part C — Single-use activation and portal login

11. The applicant opens the localized `/activate` link from the invitation and chooses a password of at least 10 characters containing a letter and a digit.
12. Activation is rate-limited. The server HMAC-hashes the presented token, rejects malformed/expired/used tokens, and atomically consumes a valid token.
13. The User becomes `active`, `emailVerified` is stamped, the bcrypt password hash is stored, all other live tokens for the User are invalidated, and an audit event is written.
14. The page redirects an external account to `/[locale]/login`; after credential login, all portal service and protected API access uses the database-fresh `companyId`. Reassigning the User immediately removes access to the former company's attachments, even with an older JWT.

```text
/register → Registration only → guarded approval
  → transaction(Company + primary Contact + invited company_owner + decision links + token hash + email log)
  → Gmail activation link → one-time password setup → /login → company-scoped /portal
```

**Remaining flow gaps:** linking an applicant to an existing Company, CAPTCHA, the pre-approval verification policy, and rejection/more-info decision-email templates remain planned.

---

## Flow 3 — Sample Request Creation (External) & Admin Review

**Actors:** External `COMPANY_OWNER` / `COMPANY_TECHNICAL` (raise) → internal `BUSINESS_DEV` / `CRM_ADMIN` (review) → `LOGISTICS` (downstream, see Flow 4).
**Routes:** `/[locale]/portal/samples` (external) ↔ `/[locale]/admin/samples` + `/admin/samples/[id]` (internal).
**Services:** `sampleService`, `productService`, `notificationService`, `activityService`, Email Delivery Log.
**Goal:** A company raises a sample request (Draft → Submitted); internal staff review it (Under Review → More Information Required / Approved / Rejected).

### Part A — External creates the request

1. **Open Sample Requests.** Portal user opens `/[locale]/portal/samples` (`canView(role, 'samples')`). `sampleService.list({ companyId })` shows existing requests for the own company only. **[Mock]** company-scoped.
2. **New request — Draft.** User clicks **New sample request**; a form loads with the Proamina&reg; catalogue via `productService.list()` (product, quantity + unit `g`/`kg`, intended application, destination address, notes). Validated by `lib/validation`.
   - **Save draft:** `sampleService.create({ ...input, status: 'Draft', requestedVia: 'portal' })` **[Mock]**. *(Prototype intake sub-state before the canonical `Requested`.)*
   - **State change:** new `SampleRequest` (`status = Draft`) in overlay; visible only to the owning company + internal.
3. **Submit.** User clicks **Submit request**.
   - `sampleService.changeStatus(id, 'Submitted')` **[Mock]** (intake `Submitted` ≙ canonical `Requested`/`Pending Approval` entry).
   - **State change:** `status = Submitted`; request becomes editable-locked for the company (now under internal review).
   - **Activity:** `activityService.create({ verb: 'sample_requested', entity: sampleRequest, summary })`.
   - **Notification (internal):** `notificationService.create({ scope: 'internal', type: 'sample_requested', recipients: BUSINESS_DEV/CRM_ADMIN })`.
   - **Email-log event [Mock]:** `sample_request_submitted` acknowledgement to the requesting contact, `status: queued`.

```
/portal/samples  →  sampleService.create(Draft)  →  sampleService.changeStatus(Submitted)
                                                          ├─ Activity: sample_requested
                                                          ├─ Notification → internal (BUSINESS_DEV)
                                                          └─ Email-log: ack (queued, mock)
```

### Part B — Internal review

4. **Open review queue.** `BUSINESS_DEV`/`CRM_ADMIN` opens `/[locale]/admin/samples`; `sampleService.list({ status: 'Submitted' })` surfaces the new request (badge from the notification).
5. **Open detail → Under Review.** Admin opens `/admin/samples/[id]`; `sampleService.get(id)`. Marking it taken:
   - `sampleService.changeStatus(id, 'Under Review')` **[Mock]** (maps to canonical `Pending Approval`).
   - **State change:** `status = Under Review`. Portal request status reflects "under review."
6. **Decision (one of three):**

   **(a) More Information Required** — `sampleService.changeStatus(id, 'More Information Required', { question })` **[Mock]** (prototype branch within `Pending Approval`).
   - **State change:** request flagged needing-info; **re-opened** for the company to edit/answer.
   - **Notification (company):** scope `company`, `type: 'sample_more_info'`.
   - **Email-log event [Mock]:** `sample_more_info` to requesting contact, `status: queued`.
   - **Loop:** company answers in `/portal/samples` → re-`Submitted` → back to step 5.

   **(b) Approved** — `sampleService.changeStatus(id, 'Approved', { approvedByUserId })` **[Mock]**.
   - **State change:** `status = Approved`; enters the LOGISTICS fulfillment queue (Flow 4).
   - **Activity:** `verb: 'sample_approved'`.
   - **Notification (company):** `type: 'sample_approved'`; **Notification (internal):** to `LOGISTICS`.
   - **Email-log event [Mock]:** `sample_approved` to requesting contact (+ `COMPANY_LOGISTICS`), `status: queued`.

   **(c) Rejected** — `sampleService.changeStatus(id, 'Rejected', { reason })` **[Mock]**.
   - **State change:** `status = Rejected`, reason stored. Terminal for this request.
   - **Notification (company):** `type: 'sample_rejected'`.
   - **Email-log event [Mock]:** `sample_rejected` (with reason), `status: queued`.

```
/admin/samples/[id]  →  Under Review  ─┬─ More Information Required ─→ (loop to company)
                                       ├─ Approved  ─→ LOGISTICS queue (Flow 4)
                                       └─ Rejected  ─→ terminal
   each branch: Activity + Notification(company) + Email-log (queued, mock)
```

---

## Flow 4 — Sample Preparation → Shipment → Transit → Delivery → Receipt Confirmation

**Actors:** Internal `LOGISTICS` (prepare, ship, advance, resolve) → external `COMPANY_LOGISTICS` (confirm receipt).
**Routes:** `/[locale]/admin/samples/[id]`, `/[locale]/admin/shipments` + `/admin/shipments/[id]` (internal) ↔ `/[locale]/portal/samples`, portal shipment tracking (external).
**Services:** `sampleService`, `shipmentService`, `notificationService`, `activityService`, Email Delivery Log.
**Goal:** Carry an **Approved** sample through preparation, shipment with tracking, transit (with delay / customs-hold branches), delivery, and external receipt confirmation.

> Mirrors Implementation Plan vertical slice 2 (Sample → Shipment → Delivery). **[Mock]** all status advancement is manual/simulated; **[Future]** real carrier tracking webhooks.

1. **Prepare the sample.** From `/admin/samples/[id]` (status `Approved`), `LOGISTICS` clicks **Mark prepared**.
   - `sampleService.changeStatus(id, 'Prepared')` **[Mock]**.
   - **State change:** sample `status = Prepared` ("Ready to Ship"); appears in the samples-to-send queue.
2. **Create the shipment.** `LOGISTICS` clicks **Create shipment** on the prepared sample.
   - `shipmentService.create({ sampleRequestId, companyId, carrier, originCountry: 'IT', destinationCountry, isExtraEU, lineItems, assignedLogisticsUserId })` **[Mock]**.
   - **State change:** new `Shipment` (`status = Pending`/`Preparing`) linked to the sample; `isExtraEU` set true for UK/SE/CH/AT/UAE (FR/EU = intra-EU). Extra-EU is customs-relevant (0% EU duty, but customs handling applies).
   - **⚠️ Missing-tracking warning [Mock]:** if `trackingRef` is empty, the shipment shows a **"Tracking reference missing"** warning and **cannot advance to In Transit** until set.
3. **Dispatch → In Transit.** `LOGISTICS` enters `trackingRef` + `expectedDeliveryAt`, clicks **Dispatch**.
   - `shipmentService.changeStatus(id, 'In Transit', { trackingRef, dispatchedAt })` **[Mock]**.
   - **State change:** shipment `status = In Transit`; the **linked sample** advances `sampleService.changeStatus(sampleId, 'Shipped')`.
   - **Activity:** `verb: 'shipment_dispatched'`.
   - **Notification (company):** `type: 'shipment_dispatched'` to `COMPANY_LOGISTICS` + `COMPANY_TECHNICAL`.
   - **Email-log event [Mock]:** `shipment_dispatched` (carrier + tracking ref), `status: queued`.
4. **Transit branches (exception handling):**

   **(a) Delayed** — `shipmentService.changeStatus(id, 'Delayed', { newExpectedDeliveryAt })` **[Mock]**.
   - **State change:** `status = Delayed`; `expectedDeliveryAt` moved.
   - **⚠️ Delay warning:** amber alert on the logistics board **and** the portal tracking view.
   - **Notification (company):** `type: 'shipment_delayed'`. **Email-log event [Mock]:** `shipment_delayed` (new expected date), `status: queued`.

   **(b) Customs Hold** — `shipmentService.changeStatus(id, 'Customs Hold')` **[Mock]** (extra-EU shipments).
   - **State change:** `status = Customs Hold`; `customsDocs[]` action flagged.
   - **⚠️ Customs warning:** amber/danger alert on logistics board + portal; "action needed."
   - **Notification:** scope `company` (`COMPANY_LOGISTICS`) **and** internal `LOGISTICS`. **Email-log event [Mock]:** `shipment_customs_hold` (action needed), `status: queued`.
   - **Resume:** once resolved → `shipmentService.changeStatus(id, 'In Transit')`.
5. **Delivered.** `shipmentService.changeStatus(id, 'Delivered', { actualDeliveryAt })` **[Mock]**.
   - **State change:** shipment `status = Delivered`; linked sample → `sampleService.changeStatus(sampleId, 'Delivered')`.
   - **Activity:** `verb: 'shipment_delivered'`.
   - **Notification (company + internal owner):** `type: 'delivery'`.
   - **Email-log event [Mock]:** `delivery_confirmed` (+ feedback prompt), `status: queued`.
6. **External confirms receipt.** `COMPANY_LOGISTICS` opens portal tracking and clicks **Confirm receipt**.
   - `shipmentService.changeStatus(id, 'Delivery Confirmed', { confirmedByContactId })` **[Mock]**.
   - **State change:** shipment `status = Delivery Confirmed`; sample may advance toward `Closed`. A **feedback prompt** is surfaced to `COMPANY_TECHNICAL` (entry to Flow 5).
   - **Activity:** `verb: 'delivery_confirmed'`.
   - **Notification (internal):** to `BUSINESS_DEV`/`LOGISTICS`.

```
Approved sample
   → sampleService(Prepared / Ready to Ship)
      → shipmentService.create()  [⚠ missing-tracking blocks advance]
         → changeStatus(In Transit)  ──► sample → Shipped   (Email-log: shipment_dispatched)
              ├─ Delayed     [⚠ board + portal alert]       (Email-log: shipment_delayed)
              └─ Customs Hold[⚠ extra-EU action needed]     (Email-log: shipment_customs_hold)
         → changeStatus(Delivered)   ──► sample → Delivered (Email-log: delivery_confirmed + feedback prompt)
            → (external) changeStatus(Delivery Confirmed)   → feedback prompt → Flow 5
```

---

## Flow 5 — Feedback Submission & R&D Review Round-Trip

**Actors:** External `COMPANY_TECHNICAL` (submit) → internal `RND_TECHNICAL` (triage, assign, reply).
**Routes:** `/[locale]/portal/feedback` (external) ↔ `/[locale]/admin/feedback` + `/admin/feedback/[id]` (internal). Linked: `/admin/tasks`, Company 360 timeline.
**Services:** `feedbackService`, `taskService`, `activityService`, `notificationService`, `sampleService`, `projectService`, Email Delivery Log.
**Goal:** A company submits structured feedback on a delivered sample; R&D reviews, assigns an owner, may request more info or post a client-visible technical reply.

> Mirrors Implementation Plan vertical slice 3 (Feedback → R&D review).

### Part A — External submits feedback

1. **Open feedback.** `COMPANY_TECHNICAL` opens `/[locale]/portal/feedback`. `feedbackService.list({ companyId })` + `sampleService.list` show delivered samples eligible for feedback.
2. **Submit detailed feedback.** User completes structured fields (sensory / stability / dosage rating + free text) against a delivered `sampleRequestId`; validated by `lib/validation`.
   - `feedbackService.create({ companyId, contactId, sampleRequestId, structuredResults, freeText, status: 'Submitted' })` **[Mock]**.
   - **State change:** new `Feedback` (`status = Submitted`).
   - **UI:** success confirmation screen in the portal.
   - **Activity:** `activityService.create({ verb: 'feedback_submitted', entity: feedback })` — appears as a **new company-timeline event** on Company 360.
   - **Notification (internal):** `notificationService.create({ scope: 'internal', type: 'feedback_received', recipients: RND_TECHNICAL + opportunity owner })`.
   - **R&D review task:** `taskService.create({ title: 'Review feedback …', source: 'R&D-generated', relatedEntityType: 'Feedback', relatedEntityId, assigneeUserId: RND_TECHNICAL })` — surfaces in `/admin/tasks` + Overview.
   - **Email-log event [Mock]:** `feedback_submitted` to assigned `RND_TECHNICAL` + opportunity owner, `status: queued`.

```
/portal/feedback  →  feedbackService.create(Submitted)
        ├─ success confirmation (portal)
        ├─ Activity → Company 360 timeline event
        ├─ Notification → internal (RND_TECHNICAL + owner)
        ├─ taskService.create (R&D review task)
        └─ Email-log: feedback_submitted (queued, mock)
```

### Part B — R&D review

3. **Open feedback.** `RND_TECHNICAL` opens `/admin/feedback/[id]` from the notification/task; `feedbackService.get(id)`. Internal view shows triage controls + the requires-R&D-action flag (portal view does not).
4. **Take into review.** `feedbackService.changeStatus(id, 'In Review')` **[Mock]** → `status = In Review`.
5. **Assign technical owner.** `feedbackService.update(id, { rndOwnerUserId })` **[Mock]** assigns the R&D owner; may reassign/close the auto task.
6. **Disposition (branches):**

   **(a) Requires more info** — `feedbackService.update(id, { needsClientInfo, question })` (+ optional `changeStatus`).
   - **State change:** feedback flagged; **Notification (company)** `type: 'feedback_more_info'`; **Email-log event [Mock]:** `feedback_more_info`, `status: queued`. Company answers in `/portal/feedback` → loop to step 3.

   **(b) Flag requires R&D action → loop** — `feedbackService.changeStatus(id, 'Requires R&D Action')` then `R&D In Progress`.
   - **State change:** `requiresRnDAction = true`; spawns further `taskService.create` R&D task(s); may link/loop to a new `SampleRequest` (back to Flow 3/4) and/or an `ApplicationProject` via `projectService`.
   - **Activity:** `verb: 'feedback_rnd_action'`.

   **(c) Post technical reply (client-visible)** — `feedbackService.reply(id, { technicalReply })` then `changeStatus(id, 'Resolved')` **[Mock]**.
   - **State change:** `technicalReply` stored and marked **client-visible**; `status = Resolved` (→ `Closed`).
   - **Visibility:** the reply now renders in the company's `/portal/feedback` under "Technical results shared back."
   - **Activity:** `verb: 'feedback_technical_reply'`.
   - **Notification (company):** `type: 'feedback_reply'` to `COMPANY_TECHNICAL`.
   - **Email-log event [Mock]:** `feedback_technical_reply`, `status: queued`.

```
/admin/feedback/[id]  →  In Review  →  assign rndOwnerUserId
   ├─ needs info        → Notification + Email-log (feedback_more_info) → loop
   ├─ Requires R&D Action → R&D In Progress → new task(s) / new sample / project (loop)
   └─ reply + Resolved  → technicalReply (client-visible in /portal/feedback)
                          + Notification(company) + Email-log: feedback_technical_reply
```

---

## Flow 6 — NDA Lifecycle (Draft → Signed → Post-NDA Unlock)

**Actors:** Internal `BUSINESS_DEV` (drive) / `CRM_ADMIN` → external `COMPANY_OWNER` (review/sign).
**Routes:** `/[locale]/admin/ndas` + `/admin/ndas/[id]`, `/[locale]/admin/documents` (internal) ↔ `/[locale]/portal/documents` (external).
**Services:** `ndaService`, `documentService`, `notificationService`, `activityService`, Email Delivery Log.
**Goal:** Move a mutual NDA through its taxonomy; on execution, unlock **Post-NDA** document access for the company.

> **[Mock]** status flips are manual. **[Future]** e-signature provider performs send → sign → countersign and captures the signed file. The signed file is **Internal Only** — never surfaced in the portal.

1. **Pre-state.** NDA for a company is **Not Required** / **To Prepare** (prototype pre-states) or absent. `ndaService.list({ companyId })`.
2. **Draft.** `BUSINESS_DEV` clicks **Create NDA** → `ndaService.create({ companyId, type: 'mutual', status: 'Drafted' })` **[Mock]**. State: `status = Drafted`.
3. **Send.** `ndaService.send(id)` / `changeStatus(id, 'Sent')` **[Mock]**.
   - **State change:** `status = Sent`, `sentAt` set.
   - **Notification (company):** `type: 'nda_sent'` to `COMPANY_OWNER`/technical signer.
   - **Email-log event [Mock]:** `nda_sent` (review + sign), `status: queued`.
4. **Under Review.** Company opens it in `/portal/documents`; `ndaService.changeStatus(id, 'Under Review')` **[Mock]**. State: `status = Under Review`.
5. **Changes Requested (branch / loop).** Either party requests edits → `ndaService.changeStatus(id, 'Under Review', { comments })` (prototype **Changes Requested** sub-state) **[Mock]**.
   - **Notification:** both parties (internal owner + company signer). **Email-log event [Mock]:** `nda_changes`, `status: queued`. Loop back to step 3 with a revised draft.
6. **Awaiting signatures.** Both parties proceed to sign (prototype **Awaiting signatures** sub-state under `Sent`/`Under Review`). **[Future]** real e-sign ceremony.
7. **Partially → Fully Signed.** `ndaService.recordSignature(id, { party })` **[Mock]**.
   - First signature → `status = Signed` (partially signed); countersignature → `Countersigned` → `Active` (fully signed).
   - **State change:** `signedAt`, `effectiveDate`, `signedFileId` (Internal Only) set.
   - **Activity:** `verb: 'nda_signed'` / `'nda_countersigned'`.
   - **Notification:** both parties; **Email-log event [Mock]:** `nda_signed` (confirmation; "unlocks Post-NDA docs"), `status: queued`.
8. **Post-NDA unlock.** With NDA `Active`, `documentService` now issues **Post-NDA** documents to the company's authorized users.
   - **State / gating change:** on `/portal/documents`, `documentService.list({ companyId })` begins returning **Post-NDA** items (e.g. comparative TDS). See Flow 8.
   - **[Mock]** gating is enforced inside `documentService` by class + NDA status; the **signed file itself remains Internal Only** and is never listed in the portal.

```
Not Required/To Prepare → Drafted → Sent → Under Review ─(Changes Requested ↺)─→ Awaiting signatures
   → Signed (partial) → Countersigned → Active
                                          └─ documentService unlocks Post-NDA for the company (Flow 8)
   each transition: Activity + Notification(both parties) + Email-log (nda_*, queued, mock)
```

---

## Flow 7 — Pipeline Stage Change via Kanban Drag-and-Drop

**Actors:** Internal `BUSINESS_DEV` (others per `can`).
**Routes:** `/[locale]/admin/pipeline`.
**Services:** `opportunityService`, `activityService` (+ `notificationService` where relevant).
**Goal:** Move an opportunity between pipeline stages by dragging its Kanban card, writing a stage-history entry.

> **[Mock]** drag-and-drop is a client interaction whose drop handler calls a service; there is no server. **[Future]** persisted, audited stage transitions.

1. **Open the board.** `/admin/pipeline` renders columns for `Lead → Qualified → NDA → Sampling → Testing → Application Project → Commercial Discussion → Won/Lost`. `opportunityService.list()` (+ `companyService` for card labels) populates cards.
2. **Drag a card.** User drags an opportunity card from its current column to a target stage column. Visual drop affordance + optimistic move.
3. **Drop → persist.** On drop, `opportunityService.changeStatus(id, newStage, { fromStage, toStage })` **[Mock]**.
   - **State change:** opportunity `stage = newStage` written to the overlay.
   - **Stage-history entry:** the change is recorded as a stage-history item on the opportunity (`{ fromStage, toStage, at, byUserId }`) **[Mock]** and as an **Activity** `activityService.create({ verb: 'opportunity_stage_change', entity: opportunity, summary: 'Qualified → NDA' })` — shown on the opportunity + Company 360 timeline.
   - **Invalid drop:** if `can(role, 'opportunity.changeStage')` is false (e.g. `MANAGEMENT_READONLY`) the card snaps back; no mutation.
4. **Cross-flow side effects (optional, demo).** Reaching certain stages may surface a **Notification (internal)** (e.g. entering `Commercial Discussion` notifies `FINANCE`); entering `Won/Lost` records `lostReason?` and closes the card. **[Mock]**

```
/admin/pipeline  ─(drag card)─►  opportunityService.changeStatus(id, newStage)
      ├─ stage updated in overlay
      ├─ stage-history entry { fromStage → toStage, at, by }
      └─ Activity: opportunity_stage_change (timeline)
   (drop denied if !can(role,'opportunity.changeStage') → snap back)
```

---

## Flow 8 — Document Access by Role & NDA State

**Actors:** All roles (internal + external).
**Routes:** `/[locale]/admin/documents`, `/admin/companies/[id]` (Documents tab) (internal) ↔ `/[locale]/portal/documents` (external).
**Services:** `documentService`, `ndaService`, `companyService`.
**Goal:** Show how the **same** document library yields different visible sets depending on role, company scope, and NDA state.

> **[Mock]** `documentService` computes visibility from `confidentialityClass` + NDA status + `companyId` scope + role. **[Future]** server-issued, time-limited **signed URLs**; nothing is a public static path; Internal Only is never reachable externally.

1. **Request the list.** A user opens a Documents view; UI calls `documentService.list({ companyId })`. The service evaluates each document's `confidentialityClass` against the caller.
2. **Resolve NDA state.** For Post-NDA gating, `documentService` consults `ndaService` for the company's NDA: is there an `Active` (fully signed) NDA?
3. **Apply the class matrix [Mock]:**

| Confidentiality class | Internal roles | External (own company) — **no Active NDA** | External (own company) — **Active NDA** |
|---|---|---|---|
| **Public** | Visible | Visible | Visible |
| **Portal General** | Visible | Visible | Visible |
| **Pre-NDA** | Visible | Visible (company-scoped, NDA not required) | Visible |
| **Post-NDA** | Visible | **Hidden** | **Visible** (unlocked by Flow 6) |
| **Company Specific** | Visible (per role) | Visible **only** if it is *their* company's document | Visible (their company only) |
| **Internal Only** | Visible (per role; e.g. signed NDA files, investor/business material) | **Never** | **Never** |

4. **Open a document.** Selecting an item calls `documentService.getSignedUrl(id)` **[Mock]** which **re-checks** class + NDA + scope + role before returning a (simulated) URL. A denied request returns nothing (and would be audited later).
   - **[Future]** real short-TTL signed URL + audited issuance.
5. **State-driven change.** When a company's NDA becomes `Active` (Flow 6, step 7–8), the **same** `/portal/documents` list re-renders to include previously hidden **Post-NDA** items — no other action needed. Conversely, an `Expired`/`Declined` NDA re-locks Post-NDA documents.

```
documentService.list(companyId)
   └─ per document: check class + ndaService(Active?) + companyId scope + role
        Public/Portal General → all
        Pre-NDA → company + internal
        Post-NDA → ONLY if Active NDA
        Company Specific → owning company only
        Internal Only → internal only, NEVER portal
```

---

## Flow 9 — Import Wizard (Client-Side Mock)

**Actors:** Internal `SUPER_ADMIN` / `CRM_ADMIN`.
**Routes:** `/[locale]/admin/import-export`.
**Services:** `companyService`, `contactService` (commit targets).
**Goal:** Walk a multi-step import of companies/contacts entirely client-side, ending in a `localStorage`-overlay commit.

> **[Mock]** Everything — file parsing, worksheet read, validation, duplicate detection, and "import" — happens **in the browser**. There is **no server ingest**; the commit writes to the `localStorage` overlay. **[Future]** server-side parsing/validation/ingest + audited bulk-import commit.

1. **File select.** User opens `/admin/import-export` → **Import** → chooses a file (CSV / spreadsheet). File is read in-browser. **[Mock]**
2. **Worksheet selection.** If multiple worksheets/tabs exist, user picks the one to import. (CSV skips this step.)
3. **Row preview.** First N rows are rendered in a preview grid so the user can confirm the right data. **[Mock]** parse only.
4. **Column mapping.** User maps source columns → target entity fields (e.g. `Company Name → name`, `Country → country`, `Email → contact.email`). Unmapped columns are flagged ignorable.
5. **Required-field validation.** `lib/validation` checks each row for required fields per target entity; rows failing validation are marked with localized inline errors.
6. **Duplicate warnings.** Wizard checks incoming rows against existing records via `companyService.list` / `contactService.list` (by name/VAT/email heuristics) and flags **likely duplicates** (skip / overwrite / create-new per row). **[Mock]**
7. **Dry-run summary.** A pre-commit summary shows counts: rows to **create**, to **update** (matched duplicates), to **skip** (invalid/duplicate), with totals. No data written yet.
8. **Import confirmation.** User confirms. The wizard commits valid rows: `companyService.create/update(...)` and/or `contactService.create/update(...)` against the **`localStorage` overlay** **[Mock]** (simulated batch latency + progress).
9. **Error report.** Rows that failed at commit are collected into a downloadable/viewable **error report** (row number + reason).
10. **Completion report.** Final screen: created / updated / skipped / failed counts; link to the affected lists. **[Mock]** illustrative audit entry on `/admin/audit`.

```
File select → Worksheet → Row preview → Column mapping → Required-field validation
   → Duplicate warnings → Dry-run summary → CONFIRM
      → companyService/contactService create|update (localStorage overlay)
      → Error report → Completion report (created/updated/skipped/failed)
   (entirely client-side mock; no server ingest)
```

---

## Flow 10 — Language Switch Preserving Route & Record

**Actors:** Any user, any time.
**Routes:** Any `/[locale]/…` route; locales `en` (default) / `it`.
**Services:** none required (i18n + router). `authService` may persist the preference.
**Goal:** Switching language preserves the **current route** and the **selected record**, per Acceptance Criterion #3.

1. **Be on a record.** User is on, e.g., `/en/admin/companies/cmp_042` (Company 360 of a specific company) or `/en/portal/samples/smp_018`.
2. **Open the language switcher.** Header switcher offers `EN` / `IT`.
3. **Switch to Italian.** The switcher rewrites **only the locale segment** of the current path, keeping the rest intact:
   - `/en/admin/companies/cmp_042` → `/it/admin/companies/cmp_042`.
   - The selected record id (`cmp_042`) and any query/tab state are preserved; no navigation back to a list.
4. **Re-render in target locale.** `next-intl` swaps message catalogs (`messages/en.json` ↔ `messages/it.json`); all labels, status chips, dates, and EUR/GBP/USD/CHF currency + g/kg units re-format via `lib/formatting` for `it`.
5. **Persist preference [Mock].** `authService` may store the chosen `language` on the `DemoSession` so subsequent loads default to it. Data values are stored canonical; only labels/formatting localize.

```
/en/admin/companies/cmp_042  ─(switch IT)─►  /it/admin/companies/cmp_042
   • only locale segment changes   • record id + tab preserved
   • next-intl swaps catalogs      • lib/formatting re-formats dates/currency/units
```

---

## Flow 11 — Global Search & Command Palette

**Actors:** Any authenticated user (results scoped by role + company).
**Routes:** Available across `/[locale]/admin/*` and `/[locale]/portal/*` (overlay).
**Services:** the relevant entity services — `companyService`, `contactService`, `opportunityService`, `sampleService`, `shipmentService`, `feedbackService`, `projectService`, `ndaService`, `documentService`, `financeService`, plus `authService` for scope.
**Goal:** Find records and trigger navigation/actions quickly across mock data, honoring permissions and company scope.

> **[Mock]** Search runs client-side over the fixtures+overlay returned by the services (no search server / index). **[Future]** a real search index behind the same call.

1. **Open the palette.** User presses the shortcut (e.g. `Ctrl/Cmd+K`) or clicks the global search field. A command-palette overlay opens.
2. **Type a query.** As the user types, the palette fans out across entity services, e.g. `companyService.list({ q })`, `contactService.list({ q })`, `opportunityService.list({ q })`, `sampleService.list({ q })`, `shipmentService.list({ q })`. **[Mock]** simple substring matching over fixture fields.
3. **Scope & permission filtering.**
   - **Internal:** results span all companies, filtered by `canView(role, section)` (e.g. `FINANCE` sees finance records; `MANAGEMENT_READONLY` sees read sections).
   - **External:** results are **hard-scoped to `session.companyId`** and to portal-visible sections only; Internal Only material never appears. **[Mock]** scoping in the services.
4. **Grouped results.** Matches are grouped by type (Companies, Contacts, Opportunities, Samples, Shipments, Feedback, Documents, …) with type icons and status chips.
5. **Navigate / act.** Selecting a result routes to its detail (e.g. `→ /[locale]/admin/companies/[id]` or `/[locale]/portal/samples/[id]`). The palette may also list **commands** (e.g. "New sample request", "Go to Notifications") gated by `can(role, action)`.
6. **Locale-aware.** Result labels and the palette UI render in the active locale; navigating preserves the locale segment (consistent with Flow 10).

```
Ctrl/Cmd+K  →  type query
   → fan-out: companyService.list / contactService.list / opportunityService.list / sampleService.list / …
   → filter by canView(role) + (external) session.companyId  (Internal Only never shown)
   → grouped results + commands  →  select → navigate to /[locale]/.../[id]
```

---

## Cross-Flow Implementation Seams Summary

The app deliberately retains both mock and API implementations. This table describes current `api` mode and the remaining production seam (see `docs/BACKEND_HANDOFF.md`).

| Concern | Current API-mode implementation | Remaining work |
|---|---|---|
| **Identity / session** | Auth.js credentials + bcrypt + versioned JWT; DB-fresh protected layouts/actions/APIs; staff/portal invitations and activation | Staff MFA, recovery policy, broader security monitoring |
| **Data reads/writes** | Prisma-backed service actions with section/action/edit guards | Complete audit coverage and staging role matrix |
| **Email** | Gmail send/sync plus durable delivery logs; reset and invitation mail are live when Gmail is connected | Retry/queue operations and remaining lifecycle templates |
| **Notifications** | Persisted, workspace/role/company-scoped notifications | Complete automatic fan-out for every lifecycle transition |
| **Status transitions** | Guarded persisted transitions | Carrier/e-sign/finance webhooks and background jobs |
| **Document access** | Server session/company/confidentiality checks; private attachment handler | Production object storage, signed URLs, and end-to-end confidentiality QA |
| **Company scoping** | Derived from the current verified User in real service queries/mutations and protected APIs; reassignment takes effect immediately | Defense-in-depth DB row-level policies/invariants if adopted |
| **Stage/drag, import, search** | Mixed: persisted service actions and the existing import scripts/UI | Audited bulk ingest and production search indexing |

> **Invariant.** Components use the service seam and the shared `can`/`canView` matrix. Mock mode remains useful for UI demos, while API mode is the security and persistence path used for staging/production.
