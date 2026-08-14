# Funding / Investor pipeline — infrastructure recon

Read-only recon of C:\Users\Labid\Desktop\ITALPROTEIN CRM (branch backend-phase-1).
Purpose: build an automated Investor/Funding pipeline — discover investor outreach
from Gmail via the attachment "Pitch Finale.pptx", reconstruct threads, classify with
Groq into NO_RESPONSE / INTERESTED / WON / LOST, surface on the Funding page.

## 1. Gmail integration

- `lib/backend/gmail.ts` — hand-rolled OAuth2 + Gmail REST v1 over `fetch` (no googleapis).
  Scopes at :24-33 = `gmail.readonly`, `gmail.send`, `gmail.compose`, `calendar.events`,
  `calendar.readonly`, `drive.readonly`. Base `https://gmail.googleapis.com/gmail/v1/users/me` (:12).
- Tokens: `googleOAuthToken` table, AES-256-GCM via `lib/backend/crypto.ts`.
  `getGmailAuth()` (:205) returns a live access token, auto-refreshing when <60s remain and
  flipping the row to `expired` on failure.
- Single SHARED mailbox, not per-user: `findMailboxTokenRow()` (:187) prefers
  `GMAIL_SENDER_EMAIL` (default `ad@italprotein.com`), `isServiceAccount:false`.
- **Arbitrary Gmail `q` is supported** — `listMessageIds(auth, query, max)` (:304-326) passes `q`
  straight through and pages via `nextPageToken` up to `max`.
  `'has:attachment filename:"Pitch Finale.pptx"'` works, as does `in:sent` / `label:sent`.
  Precedent for exotic queries: `gmail-sync.ts:592`
  (`newer_than:5y has:attachment {filename:nda filename:"n.d.a"}`) and :600 (courier OR-query).
  **No blocker.**
- Full bodies available: `getMessage(auth,id)` uses `format=full` (:346); `getThread(auth,threadId)`
  also `format=full` (:349) → whole thread with bodies.
  `extractBodyText()` (:508) prefers text/plain, falls back to stripped HTML.
  `listAttachmentMeta()` (:534) returns filename/mimeType/attachmentId/size.
  `getAttachmentBytes()` (:353) fetches bytes.
- Outbound detection already exists: `gmail-sync.ts:638` —
  `const direction = fromEmail === mailboxEmail ? "outbound" : "inbound"`.
- CAVEAT: `runGmailSync` normally lists only `in:inbox`, so SENT mail is stored only in the
  NDA-backfill path. A Pitch-Finale discovery pass needs its own query path.

## 2. Email storage

- `prisma/schema.prisma:2374-2413` `EmailMessage` → table `email_messages`.
  Fields: id, `gmailMessageId @unique`, `gmailThreadId`, `direction (EmailDirection)`,
  fromAddress, fromName, `toAddresses[]`, `ccAddresses[]`, subject, snippet, `bodyText`,
  internalDate, `hasAttachments`, `attachmentNames String[]`, ndaDetected, ndaId,
  matchedAdminUserId, leadId, companyId, sentByUserId, syncedAt, createdAt, updatedAt.
- Relations: `matchedAdmin User?`, `lead Lead?`, `company Company?` ("CompanyEmailMessages",
  onDelete SetNull). Indexes: direction, internalDate, gmailThreadId, matchedAdminUserId, companyId.
- Body: PLAIN TEXT only, truncated to 20 000 chars (`gmail-sync.ts:653`).
- Attachments: FILENAMES ONLY (`attachmentNames`), no bytes. Bytes are stored only for matched
  NDAs via `Document` + `Attachment` (`storeNdaDocument`, :247).
- Idempotency: `gmailMessageId @unique` + pre-query of existing rows (`gmail-sync.ts:610-619`)
  + duplicate-Document check (:260-269). Per-message try/catch so one bad message doesn't abort a run (:815).

## 3. Groq / AI

- `lib/ai/provider.ts`: `getAiProviderName()` = `AI_PROVIDER === 'groq' ? groq : openai`.
  Groq goes through the **OpenAI SDK** with `baseURL: https://api.groq.com/openai/v1`.
  `getAiSdkProviderClient()` returns a Vercel-`ai`-SDK `LanguageModel` via `@ai-sdk/groq`
  (used by Amina's tool loop).
- Env (`lib/backend/env.ts:106-109`): `GROQ_API_KEY`, `GROQ_MODEL` default **`openai/gpt-oss-20b`**;
  `AI_PROVIDER` default `openai` in code but `groq` in `docker-compose.prod.yml:77`.
- **Structured-output precedent to copy**: `lib/ai/crm-task-ai.ts:111-129` uses
  `chat.completions.create({ response_format: { type:"json_schema",
  json_schema: { name, strict:true, schema } }, reasoning_effort:"low", max_completion_tokens })`,
  then a `zod` parse of the JSON. Hand-written JSON Schema (`TaskOutputJsonSchema`) mirrored by a zod schema.
  Tool-calling with the `ai` SDK lives in `lib/ai/assistant-tools.ts` + `lib/ai/assistant-runtime.ts`.
- Error taxonomy already built: `lib/ai/ai-failure.ts`
  (`quota_exhausted` / `provider_down` / `provider_refused` / `invalid_output`, honours `retry-after`).
- **No concurrency limiter / batching anywhere** (no p-limit, no chunking). Pattern used instead:
  one model call over a batch of <=80 emails serialized, guarded by `checkRateLimit`/`peekRateLimit`
  (`lib/backend/rate-limit.ts`) — e.g. one AI pass per member per day, `lib/services/ai-task.actions.ts:78-86`.
- AI persistence precedent: `AssistantMessage` (schema :2321) with
  `toolName/toolArgs/toolCallStatus/tokenUsage` + `AssistantCitation` (:2346) with
  `snippet`, `label`, `targetType/targetId`.
  **No existing "AI classification + confidence + reason" column on any business record** —
  `Task.source` enum is only `manual|rnd_generated|system` (:573); AI evidence is stuffed into the
  task description as text. Classification storage is NEW work.

## 4. The Funding page

- `app/[locale]/admin/finance/page.tsx` is a `'use client'` page, Nav label
  **"Quotes, Orders & Finance"** (`messages/en.json:62`).
  Calls `financeService.list()`, `financeService.getStatistics()`, `companyService.list()`
  from `@/lib/mock-services` (:20, :143-146). Renders 5 `StatCard` KPIs
  (revenue/outstanding/overdue/quotes/orders+invoices), a `Tabs` set (all/quote/order/invoice),
  a `DataTable<FinanceDocument>`, a create-quote dialog and a detail `Sheet`.
  Edit gated by `can(role,'finance.edit')`.
- **No investor concept anywhere.** grep for `investor|cap.table|fundrais|pitch` over the schema
  returns nothing; over app/lib only two incidental hits (`lib/ai/assistant-profile.ts:45` prose,
  `app/api/attachments/[id]/route.ts`). No Investor/Fund/CapTable model.
- `CompanyType` (:172-193) values: distributor, fb_manufacturer, horeca, bakery_manufacturer,
  dairy_manufacturer, confectionery_manufacturer, ingredient_company, retailer, agency, laboratory,
  consultant, other, beverage_agency, innovation_agency, food_manufacturer, beverage_manufacturer,
  sports_nutrition — **no `investor`**. A new enum value + migration is needed (or a separate model).
- Nav: `components/navigation/nav-config.ts:55` —
  `{ section:'finance', href:'/admin/finance', labelKey:'finance', icon: Receipt }`.
  Filtered by `canView(role,'finance')`; `finance` is a member of `InternalSection`
  (`lib/permissions/index.ts:14`).
  NOTE: Task 3 of the redesign moved this item into `group_operations`.

## 5. Schema + conventions

- Company (schema :1039) has ownerUserId, relationshipStage, tags[], type, firstContact Json,
  lastActivityAt, `emailMessages` back-relation.
  Contact (:1145) has role booleans (isPrimary/isTechnical/isFinance/...), email/secondaryEmail,
  decisionRole — adequate to model investor orgs + people if `CompanyType.investor` is added.
- Migrations: `prisma/migrations/<YYYYMMDDHHMMSS>_snake_name/migration.sql` (13 folders, latest
  `20260803120000_email_message_company_fk`). Applied automatically on container boot by
  `scripts/docker-entrypoint.sh` → `npx prisma migrate deploy`.
- Service convention (one representative each):
  - read service `lib/services/finance.ts` (exports an object typed by the mock's interface `FinanceService`)
  - write/read server actions `lib/services/finance.actions.ts` (starts `"use server"`, guards with
    `requireAction`/`requireSection`/`requireSectionEdit`, company-scoped `where`)
  - mapper `lib/services/finance.mapper.ts` (Prisma row <-> DTO, minor-units, composite ids)
  - DTO types in `lib/types.ts` (e.g. `GmailSyncResult` :968, `EmailMessageRecord`)
- `requireAction` — `lib/backend/session.ts:102`: `requireUser()` then
  `if (!can(user.role, action)) throw new Error("FORBIDDEN")`.
  Finance/admin-relevant action strings: `finance.edit`, `data.export`, `settings.edit`,
  `audit.view`, `integrations.manage`, `user.manage`.
  Section rights: `finance` is `full` for super_admin/crm_admin/finance, `view` for
  business_dev/management_readonly, `hidden` for rnd_technical/logistics.

## 6. Background jobs / cron

- No queue, no in-repo scheduler. The only mechanism: `app/api/gmail/sync/route.ts` — GET+POST,
  `dynamic="force-dynamic"`, `maxDuration=60`; auth is either
  `Authorization: Bearer <CRON_SECRET>` (`isCron`, :14-16) or a signed-in user with
  `can(role,'settings.edit')`; then `checkRateLimit("gmail:sync", 4, 60)` and `runGmailSync()`.
- The hourly job is a **host crontab entry on the VPS**, documented at `docs/DEPLOY_VPS.md:124-134`:
  `0 * * * * curl -fsS -X POST https://crm.italprotein.com/api/gmail/sync -H "Authorization: Bearer <CRON_SECRET>"`
- Same pattern exists for `app/api/documents/sync-technical/route.ts` and `app/api/ndas/sync-drive/route.ts`.
  `CRON_SECRET` is plumbed in `docker-compose.prod.yml:56`.

## 7. Data mode

- `lib/data-mode.ts` (7 lines): `isApiMode = NODE_ENV === 'production' || NEXT_PUBLIC_DATA_MODE === 'api'`
  — production is ALWAYS api-mode.
- The seam is `lib/mock-services/index.ts`: import mock + api implementations, then
  `export const xService = isApiMode ? apiX : mockX`.
- A new module must ship: (a) a mock service exposing the interface, (b) a Prisma-backed
  `lib/services/<x>.ts` typed `: XService`, (c) `<x>.actions.ts` with `"use server"` + guards,
  (d) `<x>.mapper.ts`, (e) DTOs in `lib/types.ts`, (f) the ternary export in `mock-services/index.ts`.
- Correct end-to-end example: **finance**
  (`lib/mock-services/financeService.ts` + `lib/services/finance.ts|.actions.ts|.mapper.ts` + index line).
- `NEXT_PUBLIC_DATA_MODE=api` is a Docker **build arg** (`docker-compose.prod.yml:31`), not just runtime.

## 8. Deployment

- Single VPS, `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`;
  three services: `db` (postgres:16, internal only), `app`, `caddy` (TLS 80/443). Branch `backend-phase-1`.
- Migrations apply on every boot via the entrypoint. Seed + CSV import are one-off `exec` steps.
- Env already wired to the app container: `AI_PROVIDER` (default **groq**), `AI_MODEL`,
  `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `GROQ_MODEL` (default `openai/gpt-oss-20b`),
  `OPENAI_API_KEY/MODEL`, `GMAIL_SENDER_EMAIL`, `GMAIL_REPLY_TO`,
  `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `GOOGLE_TOKEN_ENC_KEY`, `CRON_SECRET`, object-storage vars.
- `.env.production.example` lists `GROQ_API_KEY=` **empty** — the actual production value is
  unverifiable from the repo.

## Flags / risks

- No Gmail blocker: `filename:` + `in:sent` queries are fully supported by `listMessageIds`.
- `GROQ_API_KEY` blank in `.env.production.example`; whether it is set on the live host cannot be
  verified from the repo — CONFIRM before relying on classification in prod.
- `CompanyType` has no `investor` value → Postgres enum-add migration required.
- No concurrency limiter for AI calls; Groq quota (`quota_exhausted`) is a real failure mode already
  handled in `ai-failure.ts` — reuse it.
- `runGmailSync` only lists `in:inbox` in its normal path; outbound Pitch-Finale mail will NOT be
  discovered unless a new query path is added.
- No `updatedById`/override precedent on AI outputs — manual-override columns must be designed fresh.
  Nearest analogue: NDA status never regressing, `syncCompanyNdaStatus(..., { neverRegress: true })`.
