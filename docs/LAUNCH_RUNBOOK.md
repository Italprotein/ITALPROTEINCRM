# ITALPROTEIN CRM — Launch Runbook

**Last updated:** 2026-07-10

The single ordered path from "backend works locally" to "staging is live with real auth, real data, and verified Gmail." Each **MANUAL** step says exactly where to find what you need. Steps marked **CLAUDE** are code/config tasks Claude can do for you (status noted).

> Legend: **[MANUAL]** = only you can do it (credentials, external accounts, dashboards). **[CLAUDE]** = Claude can implement in the repo. **[MIXED]** = Claude writes the code, you supply a value.

---

## Phase 0 — Decisions to make first

1. **[MANUAL] Pick the deploy host: Netlify or Vercel.** The repo currently has *both* footprints (`netlify.toml` committed + `.env.netlify.example`, and `.env.vercel.example`/`.env.vercel.local`). The last several commits are Netlify-related, so Netlify is the de-facto target — but confirm which project your git repo is actually connected to:
   - Netlify: <https://app.netlify.com> → your site → Site configuration.
   - Vercel: <https://vercel.com/dashboard> → your project → Settings.
   - Once decided, tell Claude and it will delete the other host's stale files and update the build config. (Note: memory currently records the stack as "Vercel"; it will be reconciled to your choice.)
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

Open your host's env settings and add every var below to **Production and Preview**:

- Netlify: Site configuration → **Environment variables**.
- Vercel: Project → Settings → **Environment Variables**.

Use `.env.netlify.example` / `.env.vercel.example` as the source list. The critical ones:

```
NEXT_PUBLIC_DATA_MODE=api          # MUST be api in production (mock = fixtures, no DB, no real auth)
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

---

## Phase 6 — Provide the gitignored data files  **[MANUAL]**

`/data/` is gitignored (it holds real credentials + client data), so these never reach the host via git. Provide them to the machine/CI that runs the seed/import:

- `data/admins.json` — the admin allowlist. Shape: `[{ "firstName", "lastName", "email", "password" }]`. **The seed purges every user not in this list**, so keep it complete.
- `data/import/companies.csv` and `data/import/contacts.csv` — real company/contact data (already present locally: ~335 companies, ~447 contacts).

Deliver via the host's file injection / a secure copy to the job runner, or run seed/import from your local machine pointed at the production `DATABASE_URL`.

---

## Phase 7 — Migrate, seed, import (in this exact order)  **[MANUAL — you run; Claude added the npm scripts]**

Run from an environment with **devDependencies installed** (`tsx` is a devDep) and `DATABASE_URL` set to the target DB:

```bash
npm run db:generate     # prisma generate (creates lib/generated/prisma)
npm run db:migrate      # applies BOTH migrations (init + gmail_leads_auth_hardening)
npm run db:seed         # 12 RBAC roles + admin allowlist from data/admins.json
npm run import:dry      # validate the CSVs — fix any BLOCKING errors before the real run
npm run import          # idempotent upsert of companies + contacts
```

Verify migrations applied cleanly:

```bash
npx prisma migrate status   # expect both migrations applied, "schema is up to date"
```

> ⚠️ **Re-running `db:seed` deletes users not in `data/admins.json`** — do not re-seed after real portal users exist unless the allowlist includes them.

---

## Phase 8 — Connect the Gmail mailbox (mint the refresh token)  **[MANUAL]**

Once deployed with `NEXT_PUBLIC_DATA_MODE=api`:

1. Sign in as an internal admin at `https://<your-domain>/en/team-login`.
2. Go to **Admin → Settings → Integrations** → **Connect Gmail**.
3. Authenticate as **ad@italprotein.com** and approve the scopes.

This stores an encrypted refresh token in `google_oauth_tokens`. Until this is done, every sync/send/password-reset returns `gmail_not_connected` / `email_unavailable`. **Only someone with the mailbox credentials can do this.**

---

## Phase 9 — Schedule the Gmail sync  **[MANUAL]**

Nothing schedules `/api/gmail/sync` yet (no `vercel.json` crons, no Netlify scheduled function). Wire one:

- **Vercel:** add `vercel.json` → `{ "crons": [{ "path": "/api/gmail/sync", "schedule": "0 * * * *" }] }` (Claude can add this file), and set the `CRON_SECRET` — Vercel Cron sends it automatically if configured.
- **Netlify:** a Netlify Scheduled Function, or an external scheduler.
- **External (any host):** <https://cron-job.org> → hourly `GET https://<your-domain>/api/gmail/sync` with header `Authorization: Bearer <CRON_SECRET>`.

---

## Phase 10 — Verify & smoke test  **[MANUAL]**

```bash
npm run typecheck && npm run lint && npm run build   # all green today
npm run verify                                       # backend smoke test (needs DATABASE_URL)
```

Then in a browser against staging:
- Log in as super-admin; confirm admin sections load real data.
- Trigger **Sync now** in Communications; confirm messages appear.
- Send a test email from the CRM; confirm it arrives and is logged.
- Run forgot-password; confirm the 6-digit code email arrives.
- Confirm an external (portal) user is scoped to only their company (once portal login exists — see below).

---

## Phase 11 — Outstanding code work (Claude can implement — pick scope)

These are **[CLAUDE]** tasks found in the subsystem audit. Ordered by priority; the top block are launch blockers:

**Critical (security/correctness):**
- **Server-side permission enforcement.** `requireAction`/`requireUser` guards exist (`lib/backend/session.ts`) but are **called nowhere** — no mutation checks role, and `update*/remove*` on several services skip company scoping (IDOR: a portal user could edit/delete another company's records by id). Add guards + re-scope writes across all 22 services.
- **Registration-approval provisioning.** Approving a registration only writes a status row (`registration.actions.ts:76`). It should create Company + primary Contact + external owner User, backfill the decision link fields, and send the invite email.
- **External portal login.** `auth.ts:40` admits only `super_admin`/`crm_admin`; external (client) accounts can't authenticate and there's no set-password/invite route — the portal login door is dead.

**High:**
- Staff invite / set-password flow (`createUser` currently makes a login-incapable account).
- Broaden **audit logging** to every CRM mutation (today only auth/Gmail events are audited).
- **Object storage** for uploaded documents (uploads currently drop their bytes — only inbound Gmail NDA attachments are persisted, in Postgres).
- Boot-time env assertion (fail fast when required vars are missing).

**Medium:**
- Route-level workspace separation (internal ↔ /portal, external ↔ /admin) in middleware + layouts.
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
| `NEXT_PUBLIC_DATA_MODE=api` | you set on host | ✅ critical |
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
