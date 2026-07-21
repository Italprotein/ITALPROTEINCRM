# Gmail, Password Auth, Invitations, And Security Setup

Status: current implementation handoff for Gmail, password auth, and account activation as of 2026-07-21.

This repo now has the backend pieces for:

- Workspace-bound Auth.js credential login for all active internal roles and company-scoped external roles with `User.passwordHash`, database-fresh identity checks, and revocable `authVersion` JWTs.
- Staff and registration-approval portal invitations/resend through Gmail, with header-safe recipients, quotas, and failed-resend preservation of the older working link.
- Hashed, single-use 72-hour account activation links at `/[locale]/activate`.
- Password change in Admin Settings.
- Password reset by six-digit code sent through the connected Gmail mailbox.
- Gmail OAuth for the shared `ad@italprotein.com` mailbox.
- Gmail inbox sync into `email_messages`.
- NDA attachment detection and filing into the NDA/document tables.
- Per-admin `My Leads` entries extracted from Gmail greetings or first-sent-message signatures.
- DB-backed fixed-window rate limits for login, reset, public registration, invitation/resend, mail send, and sync.

## Environment Variables

Set these in local `.env.local` and in Vercel Production and Preview environments:

```env
NEXT_PUBLIC_DATA_MODE=api
APP_URL=https://italproteincrm-theta.vercel.app
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/italprotein_crm
AUTH_SECRET=replace-with-a-long-random-secret
GOOGLE_TOKEN_ENC_KEY=replace-with-a-separate-random-secret
CRON_SECRET=replace-with-a-long-random-secret

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://italproteincrm-theta.vercel.app/api/auth/google/callback

GMAIL_SENDER_EMAIL=ad@italprotein.com
GMAIL_REPLY_TO=ad@italprotein.com
```

`GOOGLE_TOKEN_ENC_KEY` is recommended even though the code falls back to `AUTH_SECRET`. Rotating it will make stored Google tokens unreadable, so reconnect Gmail after rotation.

`APP_URL` must be the public bare origin. Invitation emails build localized activation links from it; if it is missing, provisioning remains committed but the durable email-log row is marked `failed` with `app_url_missing`.

`NEXT_PUBLIC_DATA_MODE` is only a development selector. Production forces API/Prisma mode even if this variable is absent or set to `mock`; keeping `api` in deployed configuration is recommended for clarity.

## Google Cloud Setup

1. Create or open the Italprotein Google Cloud project.
2. Enable the Gmail API.
3. Configure the OAuth consent screen for the Italprotein Workspace.
4. Create an OAuth client of type Web application.
5. Add the authorized redirect URI. **Important: it has NO `/it` (or any locale) prefix** — the callback route lives at `app/api/auth/google/callback`, outside `app/[locale]`. Registering an `/it/...` URI will fail with `redirect_uri_mismatch`.

```text
https://italproteincrm-theta.vercel.app/api/auth/google/callback
```

For local testing, also add:

```text
http://localhost:3000/api/auth/google/callback
```

6. Add the client id and secret to the env vars.
7. The app requests only:

```text
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
```

## Connect The Mailbox

1. Deploy the production build (`NEXT_PUBLIC_DATA_MODE=api` is recommended for explicit configuration, but production forces API mode).
2. Sign in as a `super_admin` or `crm_admin` with `settings.edit` at `/en/team-login`.
3. Go to `/en/admin/settings`.
4. Open the Integrations tab.
5. Click Connect Gmail.
6. Sign in with the `ad@italprotein.com` Google account.

The OAuth refresh token is stored encrypted in `google_oauth_tokens`. OAuth start/callback and signed-in manual Gmail sync require a database-fresh internal identity with `settings.edit`. The scheduled sync route instead authenticates `CRON_SECRET` as a bearer token. The app reads and sends mail only through the connected mailbox.

## Sync Inbox, NDAs, And My Leads

Manual sync:

- Go to `/en/admin/communications`.
- Click Sync now.

Scheduled sync:

- Use Vercel Cron or another scheduler to call:

```text
GET https://italproteincrm-theta.vercel.app/api/gmail/sync
Authorization: Bearer <CRON_SECRET>
```

Recommended starting schedule: every hour on paid hosting, or daily if the hosting plan limits cron frequency.

The sync flow:

1. Reads recent Gmail inbox messages.
2. Stores new messages in `email_messages`.
3. If a document attachment has `NDA` in the filename, or the email mentions the uppercase word `NDA` and has a document attachment, it creates a document, attachment, document version, and NDA row.
4. It attributes leads to admins by first checking a greeting such as `Dear Giuseppe`; if not found, it looks for an admin name in the signature of the first sent mail in the thread.
5. It stores only the counterparty company name in `leads`.

## Account Invitations And Activation

The schema now has four migrations. `20260721131500_account_activation` adds `account_activation_tokens` and the `account_invitation` email trigger; `20260721143000_auth_version` adds the User session-revocation counter.

- `/admin/users` can invite an internal staff member and resend while the account is still `invited`. A CRM admin can manage only non-super-admin staff; only a super admin can create/resend/manage a super admin. Self-suspend/delete and removal of the last active super admin are blocked.
- Approving a registration transactionally creates the Company, primary Contact, invited external `company_owner`, decision/link fields, hashed activation token, email-log row, and audit event.
- Invitation delivery happens after the database transaction commits. Gmail success/failure updates the existing `email_logs` row; a transport outage never rolls back valid provisioning.
- Staff and portal resend are limited to 20 attempts per actor/hour and 5 per recipient/hour. Recipient emails are normalized and rejected if invalid or unsafe for mail headers.
- Resend stages a new 72-hour token. Successful delivery retires older unused links; failed delivery retires only the candidate and preserves the previous working link.
- `/[locale]/activate?token=...` requires a password of at least 10 characters with a letter and digit. Activation is rate-limited, atomically consumes the token, sets the password, activates/verifies the User, invalidates other live tokens, and redirects to the correct login door.
- Plaintext activation tokens are never stored. Malformed, expired, already-used, wrong-workspace, or structurally invalid invited identities are rejected.

Gmail must be connected for invitation delivery. Staff resend is available from Users; an authorized registration reviewer can resend an approved portal-owner invitation. If transport remains unavailable, the durable email log records failure without invalidating the last successfully delivered link.

## Password Login And Reset

Active internal users sign in at `/en/team-login`; active external users with a company scope sign in at `/en/login`. The requested workspace is part of the credential contract, so credentials are rejected at the wrong door.

Password change:

- Admin Settings -> Security.
- Requires the current password.
- New password must be at least 10 characters and contain a letter and a digit.
- Success increments `authVersion`, so every JWT issued with the prior version is rejected on its next protected database-backed check.

Password reset:

- `/en/forgot-password?workspace=internal` or `?workspace=external` (the login pages supply the correct query).
- Sends a six-digit code through Gmail.
- Codes expire after 15 minutes, are stored hashed, are single use, and allow at most 5 attempts.
- Successful reset increments `authVersion` and revokes previously issued JWTs.

Any active, structurally valid internal or external account can reset its password without exposing whether an email exists. If Gmail is not connected, password reset cannot send codes. Use a seeded admin password to sign in and connect Gmail first.

## Security Controls

Implemented app-level controls:

- Login rate limit per IP and per email.
- Password-reset request rate limit per IP and per email.
- Password-reset confirmation rate limit per IP.
- Account-activation rate limits per IP and token hash.
- Public-registration limits of 8 submissions per IP/hour and 3 per normalized contact email/hour, plus strict bounded validation, required privacy/terms consent, and server-generated approval/admin fields.
- Staff and portal invitation/resend limits of 20 per actor/hour and 5 per recipient/hour.
- Gmail sync rate limit.
- Manual email send rate limit per admin and per IP.
- Encrypted Google tokens at rest with AES-256-GCM.
- HMAC-signed OAuth state with a 10-minute TTL.
- Database-fresh server session checks plus section/action/edit guards across protected layouts, Server Actions, and API routes. Inactive users, role/workspace drift, missing external company scope, and `authVersion` mismatch fail closed.
- Workspace-bound login plus middleware and server-layout separation of `/admin` and `/portal`.
- Server-derived company scope for external reads/writes and protected APIs; client-supplied or stale-JWT scope is not authoritative. Company reassignment immediately removes access to the former company's attachments.
- HMAC-hashed, expiring, atomic single-use account activation tokens.
- Header-safe recipient normalization and staged invitation replacement, so a failed resend does not break an already delivered activation link.
- `settings.edit` on Gmail OAuth and signed-in manual sync; `CRON_SECRET` on scheduled sync.
- Super-admin hierarchy checks and serializable protection of the last active super admin.
- Server-side identity checks on Gmail OAuth/sync, assistant and attachment APIs, email send, password change, and lead reads.
- Attachment downloads are private, no-store, and external users can access only non-internal files for their own company.

Platform controls still required before public launch:

- Use a patched Next.js release for the deployed branch.
- Enable Vercel Firewall or equivalent WAF/CAPTCHA bot protection for public registration; decide whether policy requires pre-approval email verification in addition to post-approval activation.
- Add staff MFA and tested account-recovery operations.
- Add database invariants/constraints (and optionally row-level policies) as defense in depth for application-enforced identity, role, and company boundaries.
- Complete broader audit/denial-path QA, registration decision/more-info email templates, and private object-storage/signed-URL hardening.
- Keep database connection pooling enabled.
- Set monitoring and alerting on `/api/gmail/sync`, auth failures, and high 429 rates.
- Rotate `AUTH_SECRET`, `GOOGLE_TOKEN_ENC_KEY`, Google OAuth credentials, and `CRON_SECRET` if any secret leaks.

## Verification Commands

```bash
npm run typecheck
npm run lint
npm run build
npm run verify
npm run verify:auth
```

`npm run verify` (`scripts/verify-backend.ts`) is a local DB harness for crypto, rate limits, header-injection rejection, Gmail MIME parsing, sync guards, reset-code storage, hashed activation, weak-password rejection, activation/replay rejection, and successful-versus-failed invitation resend semantics. It requires a reachable `DATABASE_URL`.

`npm run verify:auth` (`scripts/verify-auth-runtime.ts`) targets a running production server (default `http://localhost:3121`, override with `SMOKE_BASE_URL`). It uses the real Auth.js HTTP flow to verify anonymous redirects, internal/external login, wrong-door and workspace redirects, suspended-user API denial, `authVersion` revocation, Google OAuth permission enforcement, activation-page rendering, and immediate attachment denial after external-company reassignment, then removes its test rows. Neither verification command is required in production request handling.
