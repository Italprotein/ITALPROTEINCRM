# Gmail, Password Auth, And Security Setup

Status: implementation handoff for the Gmail/password-auth work added on 2026-07-08.

This repo now has the backend pieces for:

- Auth.js credential login for internal admins with `User.passwordHash`.
- Password change in Admin Settings.
- Password reset by six-digit code sent through the connected Gmail mailbox.
- Gmail OAuth for the shared `ad@italprotein.com` mailbox.
- Gmail inbox sync into `email_messages`.
- NDA attachment detection and filing into the NDA/document tables.
- Per-admin `My Leads` entries extracted from Gmail greetings or first-sent-message signatures.
- DB-backed fixed-window rate limits for login, reset, mail send, and sync.

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

1. Deploy with `NEXT_PUBLIC_DATA_MODE=api`.
2. Sign in as an internal admin at `/en/team-login`.
3. Go to `/en/admin/settings`.
4. Open the Integrations tab.
5. Click Connect Gmail.
6. Sign in with the `ad@italprotein.com` Google account.

The OAuth refresh token is stored encrypted in `google_oauth_tokens`. The app reads and sends mail only through the connected mailbox.

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

## Password Login And Reset

Internal admins can sign in at `/en/team-login` with email and password.

Password change:

- Admin Settings -> Security.
- Requires the current password.
- New password must be at least 10 characters and contain a letter and a digit.

Password reset:

- `/en/forgot-password`.
- Sends a six-digit code through Gmail.
- Codes expire after 15 minutes, are stored hashed, are single use, and allow at most 5 attempts.

If Gmail is not connected, password reset cannot send codes. Use a seeded admin password to sign in and connect Gmail first.

## Security Controls

Implemented app-level controls:

- Login rate limit per IP and per email.
- Password-reset request rate limit per IP and per email.
- Password-reset confirmation rate limit per IP.
- Gmail sync rate limit.
- Manual email send rate limit per admin and per IP.
- Encrypted Google tokens at rest with AES-256-GCM.
- HMAC-signed OAuth state with a 10-minute TTL.
- Server-side session checks on Gmail OAuth, Gmail sync, attachment download, email send, password change, and lead reads.
- Attachment downloads are private, no-store, and external users can access only non-internal files for their own company.

Platform controls still required before public launch:

- Use a patched Next.js release for the deployed branch.
- Enable Vercel Firewall or equivalent WAF/rate protection.
- Keep database connection pooling enabled.
- Set monitoring and alerting on `/api/gmail/sync`, auth failures, and high 429 rates.
- Rotate `AUTH_SECRET`, `GOOGLE_TOKEN_ENC_KEY`, Google OAuth credentials, and `CRON_SECRET` if any secret leaks.

## Verification Commands

```bash
npm run typecheck
npm run lint
npm run build
npm run verify
```

`npm run verify` (`scripts/verify-backend.ts`) is a local verification harness for crypto, rate limits, Gmail MIME parsing, sync guards, and reset-code storage. It requires a reachable `DATABASE_URL`. It should not be required in production.
