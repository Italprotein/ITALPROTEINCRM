# Investor / Funding pipeline — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to implement this plan task by task.

**Goal:** Discover every investor who received `Pitch Finale.pptx`, reconstruct each
conversation from Gmail, classify it with Groq into NO_RESPONSE / INTERESTED / WON /
LOST, and present it at `/admin/funding` with manual override.

**Spec:** `docs/superpowers/specs/2026-08-14-investor-pipeline-design.md`
**Recon:** `docs/superpowers/specs/2026-08-14-investor-pipeline-recon.md`

## Global Constraints

- **No new npm dependencies. `package.json` + `package-lock.json` byte-identical at the end.** The npm-11-writes-what-npm-10-rejects trap cost two production deploys.
- Implementers NEVER commit; the controller stages exact paths and commits.
- Additive migration only. Production DB holds 438 companies and 600 emails; nothing may be dropped, rewritten or reseeded.
- Every user-facing string in BOTH `messages/it.json` and `messages/en.json`, identical key sets. `Funding` namespace must NOT be added to `PUBLIC_NAMESPACES` (that would re-inflate the public payload this repo just cut by 92%).
- Server-side only: Gmail tokens and `GROQ_API_KEY` never reach the browser. Only threads identified as pitch outreach are sent to Groq.
- Accent discipline: `brand-molecular` text/fills in light, `brand-blueBright` in dark, `brand-blue` DECORATION ONLY (3.95:1), `brand-navy` structure. Status colour via `lib/labels.ts` getTone.
- Motion: hover 150ms, entrance fade-up 400ms ≤80ms stagger, `motion-safe:` guarded.
- Gates per task: `npx prisma generate` → `npx vitest run` → `npm run typecheck` → `npm run lint` (0 errors) → i18n parity → `git diff --stat package.json package-lock.json` empty.

## Evidence that constrains the build

From the live mailbox, 2026-08-14 (see spec):
- ~201 threads match `in:sent has:attachment filename:"Pitch Finale.pptx"`
- three of them are **mass BCC blasts** carrying ~100/~100/~190 recipients; the rest are 1:1
- **recipients live in `bcc`**, not `to` — `to` is `ad@italprotein.com` on the blasts
- `mailer-daemon` bounces are threaded into all three blasts
- one real human reply exists (`p.pendenza@equita.eu`, 6 Aug)
- organisations repeat across waves (`quattror.com`, `charmecapitalpartners.com`)

---

### Task 1: Pure domain logic (TDD, no I/O)

**Create:** `lib/investor/identity.ts`, `lib/investor/auto-reply.ts`, `lib/investor/thread-clean.ts`, `lib/investor/classification.ts` (+ one test file each)

- `normalizeOrganizationName`, `domainFromEmail` (reuse the free-mail set already in `lib/company-logo.ts` — export it rather than duplicating), `organizationNameFromDomain`, `resolveIdentity(existing, candidate)` implementing the 4-step order.
- `isAutomatedReply({from, subject, headers})` covering every pattern in the spec. Must NOT match a human reply containing the word "automatic".
- `cleanThreadForModel(messages)` — strip quoted history / HTML / signatures / tracking, cap bodies ~1500 and total ~12k KEEPING NEWEST.
- `InvestorClassificationSchema` (zod) + `parseClassification(raw, ctx)` applying the structural guards: `humanReplyCount===0 ⇒ no_response`; `won` with empty evidence ⇒ `interested` + review; confidence <0.65 ⇒ review.
- Tests FIRST, red step reported honestly. These four modules are the correctness core — everything else is plumbing.

### Task 2: Schema + migration

**Modify:** `prisma/schema.prisma` · **Create:** `prisma/migrations/<ts>_investor_pipeline/migration.sql`
- `InvestorOpportunity`, `InvestorContact`, enums `InvestorStatus`, `InvestorLostReason` exactly as the spec lists. Indexes on `domain`, `normalizedName`, `aiStatus`, `manualStatus`, `InvestorContact.email @unique`.
- Additive only. Verify with `npx prisma validate` and by reading the generated SQL — no DROP, no ALTER of an existing column.

### Task 3: Gmail discovery

**Create:** `lib/backend/investor-discovery.ts` (+ tests with a faked gmail client)
- `discoverPitchOutreach()`: `listMessageIds(auth, 'in:sent has:attachment filename:"Pitch Finale.pptx"', max)`, then per message confirm an attachment filename really equals `Pitch Finale.pptx` (case-insensitive, trimmed) — the `filename:` operator is fuzzy, the attachment is the identifier.
- Recipients = `to` ∪ `cc` ∪ **`bcc`**. Skip `ad@italprotein.com` itself.
- `getThread` for the full conversation; attribute each inbound message to the contact whose address matches its sender; count human vs auto replies via `isAutomatedReply`.
- Reuse `lib/backend/gmail.ts` entirely. Do NOT write a second Gmail client.

### Task 4: Groq classifier

**Create:** `lib/ai/investor-classifier.ts` (+ tests mocking the provider)
- Copy the structured-output shape from `lib/ai/crm-task-ai.ts:111-129`. `GROQ_MODEL` from env.
- System prompt per spec, plus: silence is NEVER lost; an automated response is not engagement; a meeting alone is not won; due diligence alone is not won; prefer INTERESTED over WON and NO_RESPONSE over LOST when uncertain; weigh newer messages more heavily; do not invent amounts.
- Concurrency 4. Failure → typed error via `lib/ai/ai-failure.ts`, existing classifications preserved.

### Task 5: Sync orchestration + persistence

**Create:** `lib/backend/investor-sync.ts`, `lib/services/investor.ts|.actions.ts|.mapper.ts`, `lib/mock-services/investorService.ts`, `app/api/funding/sync/route.ts` · **Modify:** `lib/mock-services/index.ts`, `lib/types.ts`
- Idempotent: rerun updates, never duplicates. Reclassify only when `threadHash`/`lastClassifiedMessageId` changed.
- **Never writes `manualStatus`.**
- Cron route mirrors `app/api/gmail/sync/route.ts` (Bearer `CRON_SECRET` or signed-in user + `checkRateLimit`).
- Mock service so the page works in mock mode.

### Task 6: The Funding page

**Create:** `app/[locale]/admin/funding/page.tsx` + components · **Modify:** `components/navigation/nav-config.ts`, `lib/permissions/index.ts` (new `funding` section), messages it+en
- Metrics strip, four status views + Needs review, search/sort, dense `DataTable` (compose with the existing one — do NOT rebuild), detail sheet, manual override + "Reset to AI classification", sync button with progress.
- Rates suppressed when denominator is 0.

### Task 7: Run against the real mailbox, verify, deploy

- Deploy, run the sync, report real counts.
- Cross-check a sample against Gmail by hand: the `equita.eu` reply must not be NO_RESPONSE; a bounced-only contact must be NO_RESPONSE; no WON without explicit evidence; blast recipients must not duplicate the 1:1 records for the same org.
- Rendered verification of `/admin/funding` light+dark, desktop+mobile.
