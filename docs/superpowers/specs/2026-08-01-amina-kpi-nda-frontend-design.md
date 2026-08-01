# Amina reliability, daily task generation, KPI corrections, NDA auto-filing, frontend polish

Date: 2026-08-01 · Status: approved for implementation (autonomous session; user directive)

## 1. Amina "doesn't work anymore" — root cause and fix

Evidence gathered:

- The Groq layer is healthy: a direct API call with the configured key and
  model (`openai/gpt-oss-20b`, `reasoning_effort: low`) returns 200.
- Local Postgres is down (port 5432 closed, `com.docker.service` stopped), so
  localhost can only run in mock mode — and `/api/assistant` requires a real
  DB session for every call. In mock mode Amina has **always** answered with
  an error bubble; it only appeared to work while the api-mode DB was up.
- Production (`docker-compose.prod.yml`) defaults `AI_PROVIDER` to
  `anthropic`, which `lib/ai/provider.ts` resolves to the **openai** branch —
  and the compose file never passes `OPENAI_API_KEY`. Unless the VPS
  `.env.production` explicitly sets `AI_PROVIDER=groq` + `GROQ_API_KEY`,
  the assistant 503s ("not configured").

Fix (three layers):

1. `app/api/assistant/route.ts` gains a **mock-mode branch**, gated
   server-side (`NODE_ENV !== 'production'` and data mode not `api`): no DB,
   no session; the client supplies bounded history; a small in-memory rate
   limit replaces the DB one; nothing is persisted. Production behavior is
   unchanged (the gate cannot be reached when `NODE_ENV === 'production'`,
   mirroring `lib/data-mode.ts`).
2. `components/assistant/amina.tsx` always sends the last turns as `history`
   (server ignores it in api mode, where the DB thread is the truth).
3. `docker-compose.prod.yml`: default `AI_PROVIDER` becomes `groq`; pass
   `OPENAI_API_KEY`/`OPENAI_MODEL` through so the openai fallback is actually
   configurable. Operator action still required on the VPS: set
   `GROQ_API_KEY` in `.env.production`.

## 2. "Generate today's tasks" — once per 24h, user's language, better pass

- **Limit**: `peekRateLimit('ai-tasks-daily:<user>', 1, 24h)` before the run;
  the quota is **consumed only after a successful generation** so a provider
  failure does not burn the daily slot. The action result gains
  `retryAfterSeconds`; the UI turns the error into a friendly "already ran
  today, come back in ~Xh" bubble. The old 8/hour key is removed.
- **Language**: the model instruction now demands the target language even
  when the source emails are in another one, and the fixed description
  suffixes ("Source email", "AI evidence") are localized (en/it).
- **Optimize**: consider only the latest message per Gmail thread (dedupe),
  raise the free-tier batch from 6 to 8 emails at 2,200 chars each (still
  inside Groq free-tier TPM), and return created task titles so Amina lists
  what she created in the chat.
- Mock mode: the button responds honestly in-chat that inbox analysis needs
  the production database + Gmail connection (mock mailbox is empty by
  design).

## 3. KPI corrections — the 27 confirmed audit defects

Source of truth: the prior session's verified audit (saved at
`scratchpad/audit-27.json`), 15 admin + 12 portal findings with per-finding
corrected fixes. Applied file by file; highlights:

- Google Calendar events included where meetings are counted (portal
  "Upcoming calls", admin activities "Meetings", communications log).
- Denominator bugs (feedback avg rating, tasks completion rate, profile
  completion) recomputed from the correct populations.
- `REQ-2026-NNNN` support references become server-minted (year from clock,
  collision-safe), removing the guaranteed-collision client mint.
- Profile completion moves to one shared `profileCompletion()` helper
  consumed by both the portal dashboard and the profile page (anti-drift, per
  repo convention in `lib/labels.ts`).
- "Empty table" stats: zero-valued stat rows render skeletons while their
  source is still loading instead of asserting `0`.

## 4. NDA auto-filing — close the gaps vs. the approved design

Already shipped (`bde01c0`): filename matcher (`nda-classification.ts`),
upload-route hook, never-auto-sign, hourly sync cron. Remaining, implemented
now in `lib/backend/gmail-sync.ts`:

- **All** matching attachments are filed, not just the first.
- `.p7m` (CAdES) support incl. the `*.pdf.p7m` double extension.
- Corroboration tightened: filename is authoritative; subject only as
  tie-breaker for NDA-named files; the body no longer widens the match.
- **Upsert-by-company**: an open NDA row gets a new `DocumentVersion`
  (v1.0 → v1.1 → …) instead of a duplicate NDA row; cheap dedupe on
  (companyId, title, sizeBytes).
- **Freemail parking**: no more auto-created companies from freemail
  senders; the document is filed unattributed (`companyId: null`,
  `internal`) with an `nda.auto_file_unattributed` audit event.
- `Company.ndaStatus` may only move forward (`null/to_prepare/draft →
  under_review`), never downgrade a signed state.
- Tests extended in `tests/nda-classification.test.ts` + new pure-function
  tests for attachment picking.

## 5. Frontend improvement pass

The previous responsive pass fixed overflow but left the design generic.
Approach (frontend-design skill): improve the shared system first so every
page inherits it — typography hierarchy (Playfair display for page titles,
tighter label/eyebrow treatment), StatCard/PageHeader/Card/table polish,
consistent section rhythm — then hand-tune the highest-visibility surfaces
(landing, logins, admin dashboard, portal dashboard) and verify with live
screenshots at 1366px and 390px. Brand palette (navy/gold/teal) is preserved.

## Non-goals

- No retroactive NDA backfill script in this pass (production data surgery
  deserves its own reviewed run).
- No Drive-link NDA hook (tertiary; optional in the design).
- No public (anonymous) assistant exposure.
