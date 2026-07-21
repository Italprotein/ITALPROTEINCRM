# ITALPROTEIN CRM - Launch Readiness Roadmap

> **STATUS UPDATE — 2026-07-21.** The backend foundation now includes PostgreSQL/Prisma, guarded real services and APIs, workspace-aware Auth.js login, revocable versioned JWTs, staff/portal invitation resend with single-use activation, transactional registration provisioning, password reset, and Gmail send/sync. This roadmap preserves the broader launch plan; current blockers are summarized below and tracked operationally in [`docs/LAUNCH_RUNBOOK.md`](./LAUNCH_RUNBOOK.md).

**Status:** backend foundation built; production hardening in progress
**Last updated:** 2026-07-21
**Current app reality:** Next.js 16 app with a development mock/API switch. Production always forces PostgreSQL/API mode even if `NEXT_PUBLIC_DATA_MODE` is missing or says `mock`. Protected layouts, Server Actions, and API routes revalidate the current database identity. It is not launch-complete yet.

This document turns the current prototype into a practical launch plan. It keeps the existing UI/service seam, then adds the backend, Google Drive, Gmail, AI assistant, security, legal and deployment work needed before going online.

## 1. What Exists Today

- A bilingual Next.js 16/React 19 app with public landing, separate team/portal login doors, company portal and internal CRM routes.
- A stable service seam that uses `NEXT_PUBLIC_DATA_MODE` as a development selector; production always selects real Prisma-backed actions.
- Typed domain model in `lib/types.ts`.
- Role matrix in `lib/permissions`, enforced by server section/action/edit guards in API mode.
- Auth.js credentials for every active internal role and company-scoped external role, database-fresh protected operations, revocable `authVersion` JWTs, and hashed single-use activation links for invited accounts.
- Transactional registration approval that provisions Company + primary Contact + external owner and records all linkage ids.
- Real persisted modules for companies, agencies, contacts, samples, shipments, documents, support requests, tasks, finance and notifications.
- Document confidentiality classes modeled and checked by the document/attachment service boundary: `public`, `portal_general`, `pre_nda`, `post_nda`, `company_specific`, `internal`.
- Gmail OAuth and signed-in manual sync guarded by `settings.edit`, Gmail send/cron sync, password reset, invitation delivery/resend, and durable email logs.
- Public contact details now exposed through `lib/config/site.ts` and `.env.example`.

## 2. What Must Change Before Launch

### Critical blockers

- Complete staff MFA, recovery operations, and role-by-role staging verification. Credential auth, invitations/activation, password reset, and server sessions are implemented.
- Add CAPTCHA/WAF bot defense and decide whether a distinct pre-approval verification step is required. Strict validation, mandatory consent, server-owned admin fields, and IP/email registration limits are implemented; approved users currently prove mailbox control through activation.
- Add database constraints/invariants (and consider row-level policies) as defense in depth for critical identity, role, company-scope, and last-super-admin rules now enforced transactionally in application code.
- Remove, quarantine or reclassify any real confidential files from web-visible paths.
- Complete audit logging for every sensitive read, mutation, denial, AI answer and Google Drive/Gmail action; current auth/invitation/registration/Gmail coverage is targeted.
- Add terms/privacy/cookie pages, decision/more-info registration email templates, backup strategy, error/uptime monitoring, and production operations. Real Gmail sending and staff/portal invitation recovery are implemented.

### Launch minimum

- Public website/landing can go online after legal pages, CAPTCHA/WAF protection, and the pre-approval verification policy decision are in place.
- Team CRM now has real auth, server-side permissions and database persistence; launch still requires MFA/security QA, production configuration, monitoring and recovery operations.
- Partner portal now has activation/login, invitation resend/recovery, and application-level company/document checks; launch still requires adversarial scoping QA and production object-storage/signed-URL hardening.
- AI assistant can go online only after its retrieval layer respects document access classes.

## 3. Recommended Backend Direction

The chosen direction is to use the current Next.js app as the production web app. Implemented choices and remaining platform work are:

- **Database/ORM:** PostgreSQL + Prisma 7, with four migrations through `20260721143000_auth_version`.
- **Auth:** Auth.js/NextAuth Credentials + bcrypt + versioned JWTs, with database-fresh identity checks and workspace-bound login. Password, role, and status changes increment `authVersion` to revoke existing JWTs.
- **API style:** Next.js Route Handlers / Server Actions behind the existing service contracts, guarded with the canonical permission matrix.
- **Storage:** Google Drive for team-managed docs plus private object storage for app uploads that should not live in Drive.
- **Background jobs:** Vercel Cron currently schedules Gmail sync; a durable workflow/queue remains an option for retries and heavier jobs.
- **Deployment:** Vercel is the active repository target.

The first implementation step is not to rewrite UI pages. Replace each `lib/mock-services/*` body with a production service adapter while keeping the same method names and return shapes.

## 4. Data Model To Persist

Create database tables for at least:

- `users`, `sessions`, `accounts`, `verification_tokens`, `mfa_factors`
- `companies`, `contacts`, `agencies`, `opportunities`
- `sample_requests`, `shipments`, `shipment_events`
- `feedback`, `feedback_comments`, `application_projects`, `products`
- `ndas`, `documents`, `document_versions`, `document_access_events`
- `support_requests`, `support_messages`, `attachments`
- `activities`, `tasks`, `meetings`, `notifications`
- `quotes`, `orders`, `invoices`, `payments`
- `registrations`, `registration_decisions`, `account_activation_tokens`
- `audit_events`
- `email_logs`
- `google_oauth_tokens`, `google_drive_file_links`
- `assistant_threads`, `assistant_messages`, `assistant_citations`

Every table should have `id`, `createdAt`, `updatedAt`; mutable business tables also need `createdBy`, `updatedBy` and audit events.

## 5. Auth And Roles

### Staff

- Bootstrap super-admins are upserted by the non-destructive seed; additional staff are invitation-only.
- A CRM admin with `user.manage` can create, resend, and manage non-super-admin staff. Only a super admin can create or manage a super admin; self-suspend/delete and removal of the last active super admin are blocked.
- Invitation links expire after 72 hours, are stored only as HMAC hashes, are single-use, and stamp `emailVerified` when the user sets a password. Recipient addresses are normalized/header-safe; invite/resend quotas are 20 per actor/hour and 5 per recipient/hour.
- Resend stages a replacement token: successful delivery retires older links, while failed delivery preserves the previous working link.
- MFA remains required before public launch and is not implemented yet.
- Role/status changes require `user.manage`, increment `authVersion`, and write targeted audit events; comprehensive audit and denial-path QA remains outstanding.

### Agencies and partner companies

- Public registration creates a `registration` record only; it grants no identity or portal access. A strict server schema, required privacy/terms consent, server-generated admin fields, and limits of 8/IP/hour plus 3/contact-email/hour are implemented.
- An authorized approval transaction creates the company, primary contact, invited `company_owner`, activation token, decision linkage, email log and audit event atomically.
- Activated external users authenticate through the portal door and are always scoped to one company (including agency-typed companies).
- Authorized reviewers can resend a portal invitation with the same actor/recipient quotas and failed-delivery preservation semantics as staff resend. The sensitive-company-profile approval flow remains to be completed.

### Server-side permission rule

The browser can hide buttons for UX, but the server is authoritative. Protected layouts, Server Actions, and API routes re-read the active User + Role, reject `authVersion` drift, and derive external company scope from that fresh identity. Google OAuth and signed-in manual Gmail sync additionally require `settings.edit`; cron sync requires the `CRON_SECRET` bearer. New endpoints must preserve these rules and never trust a client-supplied role, company id, or stale JWT claim.

## 6. Google Drive And Google Docs Integration

Goal: the CRM can list, show, read and update approved Google Drive documents while respecting Italprotein confidentiality.

### Recommended first version

- Use Google OAuth with the narrowest possible Drive scopes.
- Start with `drive.file` and Google Picker-style user selection so the app can access files shared with it.
- Store file metadata in the CRM `documents` table.
- Store only Google file ids and metadata in the database, not copies of confidential docs.
- For Google Docs edits, use the Docs API `documents.batchUpdate` endpoint.
- On every read or update, check CRM role, company id, NDA status and document `accessLevel`.
- Show docs in the site through an internal document viewer route, not raw public links.
- Audit every document read, export and modification.

### Drive document lifecycle

1. Staff links a Drive file from the internal CRM.
2. CRM records `googleFileId`, `mimeType`, `accessLevel`, optional `companyId`, version and owner.
3. If the file is portal-visible, staff chooses one of `public`, `portal_general`, `pre_nda`, `post_nda`, `company_specific`.
4. Portal users can see only docs passing server checks.
5. Internal users can read/edit according to their role.
6. AI ingestion only indexes chunks with the same access labels.

### Editing documents

- Permit only structured edits at first: replace text placeholders, append notes, generate a new version, insert approved comments.
- Require confirmation before writing to Drive.
- Use revision controls where possible to avoid overwriting collaborator changes.
- For risky edits, create a proposed draft copy instead of editing the source file.

## 7. Gmail And Contact Links

Public contact details:

- Email: `ad@italprotein.com`
- Phone: `+39 351 910 3211`
- Headquarters: Bologna, Italy

Production Gmail integration should:

- Send registration verification, invitations, sample notifications, shipment updates, NDA reminders, support replies and invoice reminders.
- Use `gmail.send` for outbound email where possible.
- Store every outbound email in `email_logs` with status: queued, sent, failed, bounced.
- Never attach internal-only or post-NDA files directly. Send portal links or signed-view links after access checks.
- Login, reset, registration, invitation/resend, manual send, and sync limits are implemented. Add durable retry/backoff operations and limits for remaining public/support/AI surfaces.

## 8. AI Chatbot

Recommended name: **Amina**.

Why: short, Italian-friendly, tied to Proamina and amino acids, easy for agencies and staff to remember.

### Modes

- **Amina Public:** answers public Proamina questions from public approved materials only.
- **Amina Partner:** answers a logged-in agency/company about its own samples, shipments, docs, feedback, projects and support requests.
- **Amina Team:** answers internal Italprotein questions across CRM and internal docs, still limited by the staff role.

### Questions agencies can ask

- "Where is our latest sample shipment?"
- "Which Proamina documents are available to us?"
- "Can we request another sample?"
- "What does our NDA status mean?"
- "What is the recommended next step after our feedback?"

### Questions only Italprotein team can ask

- "Which agencies have stalled after NDA?"
- "Show companies with delayed shipments and high commercial potential."
- "Summarize internal notes for Venchi before the next call."
- "Which invoices are overdue?"
- "What changed in the latest Drive version of a technical deck?"

### AI safety requirements

- Retrieval must filter by access level before the AI sees text.
- Every answer should cite the CRM record or Drive document it used.
- The assistant should say when it does not know.
- No medical, legal or regulatory claim should be invented.
- Mutations like "send email", "change sample status", "edit document" require explicit confirmation.
- Store assistant threads, citations and tool calls for audit.

## 9. More Services Worth Linking

- **Google Calendar:** technical calls, intro calls, task reminders and meeting prep.
- **Google Drive/Docs/Sheets/Slides:** document library, pitch decks, TDS, price lists, formulas, reports.
- **Gmail:** outbound workflow emails and support replies.
- **E-signature:** NDA send/sign/countersign flow.
- **Carrier tracking:** DHL/UPS/FedEx/BRT tracking webhooks or polling.
- **Accounting/payment:** invoices, payments, overdue reminders, credit notes.
- **Analytics:** privacy-conscious product analytics, uptime monitoring and error tracking.
- **Object storage:** file uploads, generated PDFs, attachments, signed URLs.
- **Backup provider:** database backups and document metadata exports.

## 10. Launch Checklist

### Product

- Finish all critical CRM and portal screens.
- Confirm mobile layouts for landing, login, registration and portal.
- Add empty/loading/error states to every data surface.
- Ensure English and Italian copy match.
- Replace "demo mode" copy before production launch or hide production-only paths.

### Security

- Real auth with staff MFA.
- Server-side RBAC.
- Company row-level scoping.
- Document confidentiality checks.
- Secure cookies.
- CSRF protection for mutations where applicable.
- Existing limits for login, reset, registration, invitation/resend, email send, and Gmail sync; add CAPTCHA/WAF plus support/AI-specific limits.
- Database constraints/invariants and optional row-level policies as defense in depth.
- Audit log and admin alerting for denied access attempts.

### Legal and compliance

- Privacy policy.
- Cookie policy.
- Terms of use.
- GDPR data subject request process.
- Consent checkboxes for registrations.
- Data retention rules for support, AI logs and Google tokens.

### Operations

- Production database backups.
- Error monitoring.
- Uptime monitoring.
- Admin account recovery process.
- Staging environment.
- Rollback plan.
- Seed script for initial roles and settings.

## 11. Recommended Build Order

### Phase 1 - Production shell

- [x] Add `.env.example` and backend config templates. Production values still require manual setup.
- [x] Create the PostgreSQL schema and four migrations through `auth_version`.
- [x] Implement workspace-aware auth, invitations/activation/resend, password reset, versioned JWTs, and database-fresh server sessions.
- [x] Mirror permission and company-scope checks in the real service layer and protected API routes.

### Phase 2 - Core CRM persistence

- [x] Replace company/contact/user/registration services.
- [x] Replace samples/shipments/support/document metadata services.
- **Partial:** Audit events and email logs exist; comprehensive mutation/denial coverage and retry operations remain.

### Phase 3 - Google Workspace

- [x] Gmail OAuth/send/sync code and configuration contract.
- Drive document linking.
- Docs read/edit workflows.
- **Partial:** Gmail templates exist for reset and account invitations; expand lifecycle templates.
- **Partial:** Scheduled Gmail sync exists; broader reminders/jobs remain.

### Phase 4 - Amina assistant

- Build RAG ingestion from approved docs and CRM records.
- Add role-aware retrieval.
- Add portal assistant UI.
- Add internal assistant UI with tool confirmations.

### Phase 5 - Launch hardening

- Security review, staff MFA, CAPTCHA/WAF, and database-invariant hardening.
- QA test matrix by role, including audit/denial paths and adversarial company reassignment/direct-id access.
- Data import from real files.
- Production object storage/signed URLs, decision-email templates, and deploy configuration.
- Backup/recovery drills and post-launch monitoring/alerting.

## 12. Source Notes

- Google recommends narrow Drive scopes and highlights `drive.file` for per-file access: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Google Docs edits use `documents.batchUpdate`, with requests applied atomically: https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate
- Gmail lists `gmail.send` as the send-on-your-behalf scope: https://developers.google.com/workspace/gmail/api/auth/scopes
- Next.js exposes browser env vars only with the `NEXT_PUBLIC_` prefix: https://nextjs.org/docs/pages/guides/environment-variables
- Current public Italprotein contact details were checked on the official site: https://www.italprotein.com/
