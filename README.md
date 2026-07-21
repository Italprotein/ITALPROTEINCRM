# ITALPROTEIN CRM

Bilingual (EN/IT) B2B CRM + client portal for **Italprotein Srl** and its **Proamina®** protein-sweetener business. Next.js app with a real backend: PostgreSQL (Prisma), workspace-aware Auth.js credential login for staff and portal users, account invitations/activation, and Gmail OAuth/sync/send.

> **Current phase:** backend foundation working; hardening toward a staging-ready launch. See [`docs/LAUNCH_RUNBOOK.md`](docs/LAUNCH_RUNBOOK.md) for the exact go-live steps and what is still outstanding.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, React 19), `next-intl` (EN/IT) |
| Language | TypeScript (strict) |
| Database | PostgreSQL via **Prisma 7** (`@prisma/adapter-pg`) |
| Auth | **Auth.js / next-auth v5** (workspace-bound Credentials, bcrypt, revocable/versioned JWT sessions, single-use activation links) |
| Email / Leads | Hand-rolled Gmail OAuth2 + REST (`lib/backend/gmail*.ts`) |
| AI assistant (Amina) | Anthropic Claude (`@anthropic-ai/sdk`) — not yet wired to UI |
| Styling | Tailwind CSS, Radix UI |
| Hosting | Vercel (`vercel.json` cron for Gmail sync) |

## Development mock mode / production API mode — read this first

Every data call goes through `lib/mock-services/index.ts`. `lib/data-mode.ts` selects the implementation with a fail-safe production rule:

- **Development:** `NEXT_PUBLIC_DATA_MODE=mock` (or omitted) uses fixtures + `localStorage`; `api` uses the real backend.
- **Production:** always uses real Prisma/Postgres services and Auth.js, even if `NEXT_PUBLIC_DATA_MODE` is missing or says `mock`. Demo Mode is development-only.

Internal accounts use `/[locale]/team-login`; company-scoped external accounts use `/[locale]/login`. Invited users first set a password through a hashed, single-use 72-hour `/[locale]/activate?token=...` link. Protected layouts, Server Actions, and API routes re-read the current database identity; password, role, or status changes increment `authVersion` so existing JWTs are rejected immediately.

## Local development

```bash
# 1. Install deps
npm install

# 2. Env: copy the template and fill values
cp .env.example .env.local          # app secrets (AUTH_SECRET, ANTHROPIC_API_KEY, …)
#   DATABASE_URL lives in .env (Prisma CLI reads .env, NOT .env.local)

# 3a. Mock mode (no DB needed) — set NEXT_PUBLIC_DATA_MODE=mock, then:
npm run dev

# 3b. Api mode (real backend) — start Postgres, then:
docker compose up -d                 # local Postgres (reads POSTGRES_PASSWORD)
npm run db:generate                  # prisma generate
npm run db:migrate                   # apply migrations
npm run db:seed                      # roles + admin allowlist (data/admins.json)
npm run import:dry                   # validate data/import/*.csv
npm run import                       # load companies + contacts
npm run dev
```

## npm scripts

| Script | Does |
|---|---|
| `dev` / `build` / `start` | Next.js dev / production build / serve |
| `lint` / `typecheck` | ESLint (flat config) / `tsc --noEmit` |
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate deploy` (apply migrations) |
| `db:seed` | non-destructively upsert 12 RBAC roles + bootstrap super-admins |
| `db:studio` | Prisma Studio (browse the DB) |
| `import:dry` / `import` | validate / import real company+contact CSVs |
| `verify` | backend/DB smoke test (crypto, limits, header safety, reset/activation/resend lifecycle) — needs `DATABASE_URL` |
| `verify:auth` | live Auth.js/API/workspace/revocation/scoping suite — run against a production server; defaults to `http://localhost:3121` or set `SMOKE_BASE_URL` |

## Secrets & data hygiene

`.gitignore` protects `/data/` (bootstrap admins + import CSVs), `.env*`, and `/assets/` (confidential source material). **Never commit real credentials or client data.** `data/admins.json` and `data/import/*.csv` exist only locally and must be provided to the host out-of-band (see runbook). Re-running `db:seed` upserts configured bootstrap admins, increments their `authVersion`, and never deletes invited staff or portal users.

## Documentation

- [`docs/LAUNCH_RUNBOOK.md`](docs/LAUNCH_RUNBOOK.md) — **start here for deploy/launch** (ordered steps, every env var, where to get each secret).
- [`docs/GMAIL_AUTH_SECURITY_SETUP.md`](docs/GMAIL_AUTH_SECURITY_SETUP.md) — Gmail OAuth, password auth, invitation activation, and security setup.
- [`docs/PERMISSION_MATRIX.md`](docs/PERMISSION_MATRIX.md) — canonical role → section/action rules and current server-enforcement boundaries.
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md), [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md) — product specification and current login/registration flows; later feature flows retain historical mock markers where noted.
- `docs/BACKEND_HANDOFF.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/FRONTEND_ARCHITECTURE.md`, `docs/LAUNCH_READINESS_ROADMAP.md` — historical design docs (carry a status banner; predate the backend build).
