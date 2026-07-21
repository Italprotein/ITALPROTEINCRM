# ITALPROTEIN CRM

Bilingual (EN/IT) B2B CRM + client portal for **Italprotein Srl** and its **Proamina®** protein-sweetener business. Next.js app with a real backend: PostgreSQL (Prisma), Auth.js login, and a Gmail OAuth/sync/send integration.

> **Current phase:** backend foundation working; hardening toward a staging-ready launch. See [`docs/LAUNCH_RUNBOOK.md`](docs/LAUNCH_RUNBOOK.md) for the exact go-live steps and what is still outstanding.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, React 19), `next-intl` (EN/IT) |
| Language | TypeScript (strict) |
| Database | PostgreSQL via **Prisma 7** (`@prisma/adapter-pg`) |
| Auth | **Auth.js / next-auth v5** (Credentials, bcrypt, JWT sessions) |
| Email / Leads | Hand-rolled Gmail OAuth2 + REST (`lib/backend/gmail*.ts`) |
| AI assistant (Amina) | Anthropic Claude (`@anthropic-ai/sdk`) — not yet wired to UI |
| Styling | Tailwind CSS, Radix UI |
| Hosting | Vercel (`vercel.json` cron for Gmail sync) |

## The mock / api switch — read this first

Every data call goes through `lib/mock-services/index.ts`, which picks an implementation from the public env var **`NEXT_PUBLIC_DATA_MODE`**:

- `mock` (default) — in-memory fixtures + `localStorage`. No database, Demo-Mode login. Good for UI work.
- `api` — real Prisma/Postgres services, real Auth.js login, real Gmail. **Production must run `api`.**

Middleware auth enforcement, real login, and Gmail all activate **only** in `api` mode.

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
| `db:seed` | seed 12 RBAC roles + admin allowlist |
| `db:studio` | Prisma Studio (browse the DB) |
| `import:dry` / `import` | validate / import real company+contact CSVs |
| `verify` | backend smoke test (crypto, rate-limit, Gmail MIME, reset flow) — needs `DATABASE_URL` |

## Secrets & data hygiene

`.gitignore` protects `/data/` (admin allowlist + import CSVs), `.env*`, and `/assets/` (confidential source material). **Never commit real credentials or client data.** The `data/admins.json` allowlist and `data/import/*.csv` files exist only locally and must be provided to the host out-of-band (see runbook).

## Documentation

- [`docs/LAUNCH_RUNBOOK.md`](docs/LAUNCH_RUNBOOK.md) — **start here for deploy/launch** (ordered steps, every env var, where to get each secret).
- [`docs/GMAIL_AUTH_SECURITY_SETUP.md`](docs/GMAIL_AUTH_SECURITY_SETUP.md) — Gmail OAuth + password-auth setup (accurate/current).
- [`docs/PERMISSION_MATRIX.md`](docs/PERMISSION_MATRIX.md) — role → section/action rules (canonical; server enforcement still partial).
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md), [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md) — product & flows (phase headers stale; bodies valid).
- `docs/BACKEND_HANDOFF.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/FRONTEND_ARCHITECTURE.md`, `docs/LAUNCH_READINESS_ROADMAP.md` — historical design docs (carry a status banner; predate the backend build).
