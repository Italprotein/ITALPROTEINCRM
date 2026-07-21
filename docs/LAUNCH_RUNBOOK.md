# ITALPROTEIN CRM — Launch Runbook

**Last updated:** 2026-07-21

The single ordered path from "backend works locally" to "staging is live with real auth, real data, and verified Gmail." Each **MANUAL** step says exactly where to find what you need. Steps marked **CLAUDE** are code/config tasks Claude can do for you (status noted).

> Legend: **[MANUAL]** = only you can do it (credentials, external accounts, dashboards). **[CLAUDE]** = Claude can implement in the repo. **[MIXED]** = Claude writes the code, you supply a value.

---

## Phase 0 — Decisions to make first

1. **[MANUAL] Confirm the connected Vercel project and production domain.** The active repo footprint is Vercel (`vercel.json`, `.env.vercel.example`, `.env.vercel.local`). Open <https://vercel.com/dashboard> → your project → Settings, confirm the Git repository/branch and capture the final production origin for `APP_URL` and the Google redirect URI.
2. **[MANUAL] Confirm the org mailbox** used for Gmail send/sync and the super-admin identity: `ad@italprotein.com` (already the default everywhere). You need login access to this Google account.

---

## Phase 1 — Provision the production database  **[MANUAL]**

You need a hosted PostgreSQL and its **pooled** connection string.

- **Where:** Neon (<https://neon.tech>), Supabase (<https://supabase.com/dashboard>), or Vercel Postgres (Vercel dashboard → Storage). Create a database, then copy the **pooled / pgBouncer** connection string (serverless functions open many short-lived connections).
- **Value to capture:** `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/italprotein_crm?...`
- ⚠️ This must be present at **build** time too — `prisma generate` reads it via `prisma.config.ts`. Add it to **both** Production and Preview environments in the host dashboard.

---

## Phase 2 — Generate the app secrets  **[MIXED — Claude can generate the values; you paste them into the host]**

| Secret | How to generate | Purpose |
|---|---|---|
| `AUTH_SECRET` | `npx auth secret` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` | Signs Auth.js JWT sessions. **Required.** |
| `GOOGLE_TOKEN_ENC_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` | AES-256-GCM key for encrypting Google OAuth tokens at rest. Recommended (falls back to `AUTH_SECRET`). Rotating it invalidates stored Gmail tokens → must reconnect Gmail. |
| `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"` | Bearer token the scheduler sends to `/api/gmail/sync`. |
| `SEED_SUPERADMIN_PASSWORD` | any strong password (only used if `data/admins.json` is absent) | Avoids the weak `ChangeMe!2026` default in `prisma/seed.ts`. Rotate after first login. |

You paste these into the host's Environment Variables UI (see Phase 5). Never commit them.

---

## Phase 3 — Google Cloud OAuth (Gmail)  **[MANUAL]**

Needed for Gmail sync/send, password-reset emails, and account-invite emails.

1. **Project + API** — <https://console.cloud.google.com> → pick/create the Italprotein project → **APIs & Services → Library** → enable **Gmail API**.
2. **Consent screen** — **APIs & Services → OAuth consent screen** (<https://console.cloud.google.com/apis/credentials/consent>). Choose **User type = Internal** (your Google Workspace org) so the *restricted* Gmail scopes need **no Google verification**. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
3. **OAuth client** — **APIs & Services → Credentials** (<https://console.cloud.google.com/apis/credentials>) → **Create Credentials → OAuth client ID → Web application**. Under **Authorized redirect URIs** add — **with NO `/it` or locale prefix** (the callback route lives outside `app/[locale]`; a locale prefix causes `redirect_uri_mismatch`):
   - `https://<your-domain>/api/auth/google/callback`  (production)
   - `http://localhost:3000/api/auth/google/callback`  (local testing)
4. **Capture values:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI=https://<your-domain>/api/auth/google/callback`.

> Full detail: [`GMAIL_AUTH_SECURITY_SETUP.md`](GMAIL_AUTH_SECURITY_SETUP.md).

---

## Phase 4 — Anthropic API key (AI assistant "Amina")  **[MANUAL]**

- **Where:** <https://console.anthropic.com> → Settings → API Keys → Create Key.
- **Value:** `ANTHROPIC_API_KEY`. (Amina UI isn't wired yet, so this is not launch-blocking — set it when you build the assistant.)

---

## Phase 5 — Set environment variables on the host  **[MANUAL]**

In Vercel, open **Project → Settings → Environment Variables** and add every variable below to **Production and Preview**. Use `.env.vercel.example` as the source list. The critical ones:

```
NEXT_PUBLIC_DATA_MODE=api          # recommended for clarity; production forces API mode regardless
APP_URL=https://<your-domain>      # bare origin, no /it
DATABASE_URL=<pooled string from Phase 1>
AUTH_SECRET=<from Phase 2>
GOOGLE_TOKEN_ENC_KEY=<from Phase 2>
CRON_SECRET=<from Phase 2>
GOOGLE_CLIENT_ID=<from Phase 3>
GOOGLE_CLIENT_SECRET=<from Phase 3>
GOOGLE_REDIRECT_URI=https://<your-domain>/api/auth/google/callback
GMAIL_SENDER_EMAIL=ad@italprotein.com
GMAIL_REPLY_TO=ad@italprotein.com
ANTHROPIC_API_KEY=<from Phase 4, optional for launch>
```

Public (non-secret) `NEXT_PUBLIC_*` site/contact values are already correct in the templates — confirm they match the real site.

`NEXT_PUBLIC_DATA_MODE` is a development switch, not a production security control. `lib/data-mode.ts` forces API mode whenever `NODE_ENV=production`, even if this variable is absent or set to `mock`; fixture/localStorage Demo Mode is development-only.

---

## Phase 6 — Provide the gitignored data files  **[MANUAL]**

`/data/` is gitignored (it holds real credentials + client data), so these never reach the host via git. Provide them to the machine/CI that runs the seed/import:

- `data/admins.json` — the bootstrap super-admin list. Shape: `[{ "firstName", "lastName", "email", "password" }]`. The seed upserts these accounts and the 12 roles; it does **not** delete invited staff or provisioned portal users.
- `data/import/companies.csv` and `data/import/contacts.csv` — real company/contact data (already present locally: ~335 companies, ~447 contacts).

Deliver via the host's file injection / a secure copy to the job runner, or run seed/import from your local machine pointed at the production `DATABASE_URL`.

---

## Phase 7 — Migrate, seed, import (in this exact order)  **[MANUAL — you run; Claude added the npm scripts]**

Run from an environment with **devDependencies installed** (`tsx` is a devDep) and `DATABASE_URL` set to the target DB:

```bash
npm run db:generate     # prisma generate (creates lib/generated/prisma)
npm run db:migrate      # applies all 4 migrations, through auth_version
npm run db:seed         # 12 RBAC roles + admin allowlist from data/admins.json
npm run import:dry      # validate the CSVs — fix any BLOCKING errors before the real run
npm run import          # idempotent upsert of companies + contacts
```

Verify migrations applied cleanly:

```bash
npx prisma migrate status   # expect all four migrations applied, "schema is up to date"
```

`db:seed` is intentionally non-destructive: it upserts roles and bootstrap admins without deleting staff invitations, activation tokens, or portal accounts. It resets configured bootstrap admins' names, roles, active status, and passwords, and increments their `authVersion` so any older JWTs stop working.

---

## Phase 8 — Connect the Gmail mailbox (mint the refresh token)  **[MANUAL]**

Once deployed (production forces API mode):

1. Sign in as a `super_admin` or `crm_admin` with `settings.edit` at `https://<your-domain>/en/team-login`.
2. Go to **Admin → Settings → Integrations** → **Connect Gmail**.
3. Authenticate as **ad@italprotein.com** and approve the scopes.

This stores an encrypted refresh token in `google_oauth_tokens`. Both Google OAuth and signed-in manual Gmail sync require `settings.edit`; the cron path instead requires the `CRON_SECRET` bearer. Until the mailbox is connected, sync/send/reset/invitation delivery returns `gmail_not_connected` / `email_unavailable`. **Only someone with the mailbox credentials can complete consent.**

---

## Phase 9 — Verify the Gmail sync schedule  **[MANUAL]**

`vercel.json` already schedules hourly `GET /api/gmail/sync` at `0 * * * *`. Confirm the deployed project has `CRON_SECRET`; the route requires the matching `Authorization: Bearer <CRON_SECRET>` value. After deployment, inspect the first invocation/runtime log and confirm a successful sync plus the expected durable email/message records.

If the chosen Vercel plan cannot run the required cadence, use an external scheduler such as <https://cron-job.org> with the same hourly endpoint and bearer header, and disable one schedule to avoid duplicate runs.

---

## Phase 10 — Verify & smoke test  **[MANUAL]**

```bash
npm run typecheck && npm run lint && npm run build   # static/build verification
npm run verify                                       # backend + activation DB checks; needs DATABASE_URL
```

Then start the production build in API mode on the runtime-suite port and run the authenticated smoke suite from a second terminal:

```powershell
# terminal 1 (production automatically forces the guarded API path)
$env:PORT=3121; npm run start

# terminal 2; set SMOKE_BASE_URL if using another origin
npm run verify:auth
```

`verify:auth` creates isolated internal/external identities and scoped documents, then exercises Auth.js and protected HTTP routes. It covers anonymous/workspace redirects, non-admin staff and portal login, suspended-user API denial, `authVersion` JWT revocation, Gmail OAuth permission, activation-page rendering, and immediate attachment denial after external-company reassignment. It cleans up its database rows.

Then in a browser against staging:
- Log in as super-admin; confirm admin sections load real data.
- Trigger **Sync now** in Communications; confirm messages appear.
- Send a test email from the CRM; confirm it arrives and is logged.
- Invite a staff user, open the emailed activation link, set a strong password, and sign in through `/en/team-login`.
- Resend an unaccepted staff invitation; confirm a delivered replacement invalidates the previous link, while a failed delivery leaves the previous working link usable.
- Approve a test registration; confirm one Company, one primary Contact, one invited `company_owner`, linked decision ids, and one durable invitation email-log row are created.
- Resend that portal invitation from the approved registration; verify the same delivered/failed replacement behavior and the per-actor/per-recipient quota.
- Activate the portal invitation and sign in through `/en/login`; confirm an external user is scoped to only its current company and is redirected away from `/admin`.
- Run forgot-password for both a staff and portal account; confirm the 6-digit code email arrives, returns to the correct login door, and invalidates every previously issued JWT after completion.
- Change a staff password; confirm the existing session is revoked and the new password is required.
- Confirm expired, malformed, and already-used activation links are rejected without changing the account.

---

## Phase 11 — Outstanding code work (Claude can implement — pick scope)

The account/security foundation completed on 2026-07-21 includes:

- Server-side session, section/action, write-level, and company-scope guards across the real service layer.
- Workspace-bound credentials for every active internal role and company-scoped external role.
- Middleware **and** server-layout separation between `/admin` and `/portal`.
- Production-forced API mode; fixture/localStorage Demo Mode cannot be selected in a production build.
- Database-fresh identity validation on protected layouts, Server Actions, assistant/attachment APIs, Google OAuth, and signed-in Gmail sync. `authVersion` revokes old JWTs after password, role, or status changes.
- Transactional registration approval that provisions Company + primary Contact + invited portal owner and backfills decision/link fields.
- Strict, consent-required public registration with server-generated reference/status/admin fields and DB-backed limits (8/IP/hour; 3/email/hour).
- Hashed, single-use 72-hour account activation tokens; header-safe normalized recipients; staff and portal invitation resend quotas (20/actor/hour; 5/recipient/hour); failed resend preserves the older working link.
- `super_admin`/`crm_admin` management hierarchy, self-suspend/delete protection, and serializable last-active-super-admin checks.
- Non-destructive role/bootstrap-admin seeding, four migrations through `20260721143000_auth_version`, and expanded `npm run verify:auth` coverage.

The remaining **[CLAUDE]** tasks are ordered by launch impact:

**Critical (security/correctness):**
- **Public registration bot defense.** Strict validation, consent enforcement, server-owned fields, and IP/email limits are implemented; add CAPTCHA/WAF bot controls and decide whether policy requires a distinct pre-approval email-verification step. Activation currently proves mailbox control after approval.
- **Comprehensive authorization/audit QA.** Keep the runtime suite and complete a staging role-by-role read/write matrix, including cross-company denial and document confidentiality cases.
- **Database invariants.** Application transactions enforce hierarchy, scoping and provisioning, but review which invariants should also be encoded with database constraints/triggers and test concurrent admin/provisioning races.

**High:**
- Broaden **audit logging** to every CRM mutation and denied authorization decision (auth, invitations, registration decisions, and Gmail already emit targeted events).
- **Object storage** for uploaded documents (uploads currently drop their bytes — only inbound Gmail NDA attachments are persisted, in Postgres).
- Boot-time env assertion (fail fast when required vars are missing).
- Staff MFA and a documented recovery procedure remain required before treating the team workspace as fully production-hardened.

**Medium:**
- Notification fan-out + auto-create on status transitions; transactional email templates; feedback/shipment side-effects.
- Calendar invites (ICS via existing Gmail send, or add a Calendar scope).
- Serverless timeout guard for large first Gmail sync.

**Vendor-dependent [MIXED] (need a business decision + credentials first):**
- E-signature provider (`ESIGN_*`) for the NDA flow.
- Object storage bucket (`OBJECT_STORAGE_*`), carrier tracking, payments, AI vector store.

**Deferred until data/permissions are production-safe:** Google Drive/Docs, and the Amina chatbot (role-aware retrieval).

---

## Appendix — Env var quick reference

| Var | Source | Blocking? |
|---|---|---|
| `NEXT_PUBLIC_DATA_MODE=api` | optional explicit setting | development selector; production forces API mode |
| `DATABASE_URL` | DB provider (Phase 1) | ✅ critical |
| `AUTH_SECRET` | generate (Phase 2) | ✅ critical |
| `APP_URL` | your domain | ✅ critical |
| `GOOGLE_TOKEN_ENC_KEY` | generate | high |
| `CRON_SECRET` | generate | high |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | Google Cloud (Phase 3) | high (Gmail) |
| `ANTHROPIC_API_KEY` | Anthropic console (Phase 4) | low (Amina later) |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` / `GOOGLE_SHARED_DRIVE_ID` | Google Drive URLs | low (Drive later) |
| `OBJECT_STORAGE_*` / `ESIGN_*` / `CARRIER_*` / `PAYMENTS_*` | chosen vendors | low (when built) |
| `SEED_SUPERADMIN_PASSWORD` | generate (seed shell) | medium |
| `POSTGRES_PASSWORD` | local Docker only | local only |
