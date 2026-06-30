# ITALPROTEIN CRM - Launch Readiness Roadmap

**Status:** production planning and backend-prep notes  
**Last updated:** 2026-06-23  
**Current app reality:** Next.js frontend prototype with fixture data, browser localStorage writes and Demo Mode login. It is not production-secure yet.

This document turns the current prototype into a practical launch plan. It keeps the existing UI/service seam, then adds the backend, Google Drive, Gmail, AI assistant, security, legal and deployment work needed before going online.

## 1. What Exists Today

- A bilingual Next.js 14 app with public landing, team login, company portal and internal CRM routes.
- Mock services in `lib/mock-services` that act like a backend contract.
- Typed domain model in `lib/types.ts`.
- Role matrix in `lib/permissions`.
- Fixture-backed modules for companies, agencies, contacts, samples, shipments, documents, support requests, tasks, finance and notifications.
- Document confidentiality classes already modeled: `public`, `portal_general`, `pre_nda`, `post_nda`, `company_specific`, `internal`.
- Public contact details now exposed through `lib/config/site.ts` and `.env.example`.

## 2. What Must Change Before Launch

### Critical blockers

- Replace Demo Mode auth with real user accounts, invite flows, password reset, email verification and MFA for staff.
- Move all data writes from localStorage into a server database.
- Enforce roles, company scoping and document confidentiality on the server.
- Remove, quarantine or reclassify any real confidential files from web-visible paths.
- Add audit logging for every login, read of sensitive docs, mutation, AI answer and Google Drive/Gmail action.
- Add real email sending, terms/privacy/cookie pages, backup strategy and production monitoring.

### Launch minimum

- Public website/landing page can go online with contact links and registration intake.
- Team CRM can go online only after real auth, server-side permissions and database persistence exist.
- Partner portal can go online only after company scoping and document access checks are server-side.
- AI assistant can go online only after its retrieval layer respects document access classes.

## 3. Recommended Backend Direction

Use the current Next.js app as the production web app and add backend capability inside it first:

- **Database:** PostgreSQL.
- **ORM:** Prisma or Drizzle. Prisma is easiest for handoff and migrations.
- **Auth:** Auth.js/NextAuth, Clerk, Auth0 or Keycloak. Pick one; do not build all auth security by hand unless there is a strong reason.
- **API style:** Next.js Route Handlers / Server Actions behind the existing service contracts.
- **Storage:** Google Drive for team-managed docs plus private object storage for app uploads that should not live in Drive.
- **Background jobs:** Vercel Cron, Trigger.dev, Inngest, BullMQ or a small worker service.
- **Deployment:** Vercel is the fastest path for this Next app; a VPS/container path is fine later if custom workers are needed.

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
- `registrations`, `registration_decisions`
- `audit_events`
- `email_logs`
- `google_oauth_tokens`, `google_drive_file_links`
- `assistant_threads`, `assistant_messages`, `assistant_citations`

Every table should have `id`, `createdAt`, `updatedAt`; mutable business tables also need `createdBy`, `updatedBy` and audit events.

## 5. Auth And Roles

### Staff

- Invitation only.
- Staff email verification required.
- MFA required for all staff.
- `super_admin` seeds the first team invitations.
- Role changes require `super_admin` or approved `crm_admin`, and every change is audited.

### Agencies and partner companies

- Public registration creates a `registration` record only.
- Internal approval creates the company, contacts and portal users.
- External users are always scoped to one company or agency.
- Sensitive company profile changes create approval requests, not direct writes.

### Server-side permission rule

The browser can hide buttons for UX, but the server must reject unauthorized reads/writes. Never trust a role or company id sent from the client.

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
- Add rate limiting and retry logic.

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
- Rate limits for login, registration, support and AI.
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

- Add `.env.example`, staging/prod env setup and backend config.
- Create database schema and migrations.
- Implement auth and server sessions.
- Mirror permission checks server-side.

### Phase 2 - Core CRM persistence

- Replace company/contact/user/registration services.
- Replace samples/shipments/support/document metadata services.
- Add audit events and email logs.

### Phase 3 - Google Workspace

- OAuth setup.
- Drive document linking.
- Docs read/edit workflows.
- Gmail send with templates.
- Scheduled reminders.

### Phase 4 - Amina assistant

- Build RAG ingestion from approved docs and CRM records.
- Add role-aware retrieval.
- Add portal assistant UI.
- Add internal assistant UI with tool confirmations.

### Phase 5 - Launch hardening

- Security review.
- QA test matrix by role.
- Data import from real files.
- Production deploy.
- Post-launch monitoring.

## 12. Source Notes

- Google recommends narrow Drive scopes and highlights `drive.file` for per-file access: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Google Docs edits use `documents.batchUpdate`, with requests applied atomically: https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate
- Gmail lists `gmail.send` as the send-on-your-behalf scope: https://developers.google.com/workspace/gmail/api/auth/scopes
- Next.js exposes browser env vars only with the `NEXT_PUBLIC_` prefix: https://nextjs.org/docs/pages/guides/environment-variables
- Current public Italprotein contact details were checked on the official site: https://www.italprotein.com/
