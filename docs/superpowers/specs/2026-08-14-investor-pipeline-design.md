# Investor / Funding pipeline — design

Companion to `2026-08-14-investor-pipeline-recon.md` (infrastructure map). This
document records what the **actual mailbox** contains, because it overturned the
obvious design.

## Goal

Answer, on one page: **how many investors did we contact, and what happened with
them?** — every investor in exactly one of NO_RESPONSE / INTERESTED / WON / LOST.

## Evidence from the live mailbox (ad@italprotein.com, read 2026-08-14)

Query `in:sent has:attachment filename:"Pitch Finale.pptx"` → **~201 threads**.

The campaign was sent two different ways, and this is the single most important
fact in this document:

1. **1:1 sends (6 Aug).** One thread per fund, `toRecipients` = one address.
   e.g. `segreteria@wisesgr.com`, `alenotti@yarpa.it`, `n.buttignol@pfh.eu`.
2. **Three mass BCC blasts (12–13 Aug).** `toRecipients` = `ad@italprotein.com`
   (self), and **`bccRecipients` carries ~100–190 addresses each**:
   - `19ff6a67d8eaa012` (12 Aug 15:45) — ~100 funds
   - `19ff6b4af60167b4` (12 Aug 16:01) — ~100 incubators/accelerators
   - `19ffaa0ba950a5cb` (13 Aug 10:17) — ~190 funds/family offices

Consequences, each of which changes the implementation:

- **Recipients must be read from `to` + `cc` + `bcc`.** Reading `to` alone finds
  ~198 investors and misses ~400. This is the difference between the feature
  working and the feature being a rounding error.
- **One thread ≠ one investor.** A blast thread is one thread and hundreds of
  outreach records. The unit of the pipeline is `(organization)`, reached via
  `(thread, recipient)` pairs.
- **Bounces are everywhere.** `mailer-daemon@googlemail.com` replies are threaded
  into all three blasts (4+ each). They MUST NOT count as replies, or every
  blast becomes "INTERESTED".
- **Reply attribution is per-address, not per-thread.** An inbound message in a
  blast thread belongs to the one contact whose address matches its sender —
  never to the other 189 recipients on that blast.
- **The same organisation appears in both waves.** `quattror.com` was mailed at
  `matilde.cucuzza@` (1:1) and `info@` (blast); `charmecapitalpartners.com`
  appears ~13 times in one blast plus `segreteria@` individually. Without
  org-level dedupe the page reports several hundred "investors" that are really
  a few hundred *contacts* at far fewer funds.
- **At least one genuine human reply exists** — `p.pendenza@equita.eu`, 6 Aug —
  so INTERESTED is reachable and the classifier will be exercised on real data.

## Where it lives

New route `/admin/funding`, its own `InternalSection`. NOT a tab on
`/admin/finance`, which is "Preventivi, Ordini & Finanza" — quotes, orders and
invoices for customers. The two share no field, permission rationale or
workflow; merging them would re-complicate the simplest page in the CRM.

## Data model (additive, two tables + one enum)

Reusing `Company`/`Contact` was rejected: `CompanyType` has no `investor` value,
and every Company surface (pipeline stage, NDA status, sample status, shipments)
is meaningless for a VC — an investor added there leaks into all of them.

`InvestorOpportunity` — the pipeline unit, one per organisation:
- identity: `organizationName`, `normalizedName` (dedupe key), `domain`, `country`
- outreach: `firstOutreachAt`, `lastMessageAt`, `gmailThreadIds String[]`,
  `outboundCount`, `humanReplyCount`, `autoReplyCount`
- AI: `aiStatus`, `aiConfidence`, `aiReason`, `aiEvidence String[]`, `aiSummary`,
  `aiNextAction`, `aiSignals String[]`, `requiresHumanReview`, `aiClassifiedAt`,
  `aiModel`
- WON (nullable, only when explicitly stated): `investmentAmountMinor`,
  `investmentCurrency`, `investmentRound`, `investmentConfirmedAt`
- LOST: `lostReason` enum incl. `not_specified`
- override: `manualStatus`, `manualStatusById`, `manualStatusAt`, `manualNotes`
- reclassify guard: `threadHash`, `lastClassifiedMessageId`

`InvestorContact` — the person, preserved under the org:
- `opportunityId`, `email @unique`, `name`, `role`, `firstOutreachAt`,
  `repliedAt`, `bounced Boolean`

**Effective status is derived, never stored twice:** `manualStatus ?? aiStatus`.

## Deduplication

First match wins:
1. existing `InvestorContact.email` (lowercased)
2. `InvestorOpportunity.domain` — non-free-mail only
3. `normalizedName` (lowercased, punctuation and legal/fund suffixes stripped:
   ltd/llc/srl/spa/sgr/gmbh/bv/ab/oy/plc/inc/capital/ventures/partners/vc)
4. otherwise a new opportunity

Free-mail domains never key an organisation — see `[[company-logo-identity]]`,
the same trap that made website-based identity useless. Two people at one fund
merge into one opportunity with two contacts; two funds never merge.

## Auto-reply detection — in code, before Groq

A reply counts as human engagement only if it survives all of:
- headers `Auto-Submitted: auto-*`, `X-Autoreply`, `Precedence: bulk|auto_reply`,
  empty `Return-Path`
- senders `mailer-daemon@`, `postmaster@`, `no-reply@`, `noreply@`, `*bounce*`
- subjects (it/en/de/fr): out of office, autoreply, risposta automatica,
  assente, fuori sede, abwesenheit, absence, undeliverable,
  delivery status notification, returned mail, mail delivery failed

**Hard rule, enforced in code and not delegated to the model:**
`humanReplyCount === 0` ⇒ status is `no_response`, whatever the model says.
There is no elapsed-time input to the classifier at all, so silence can never
decay into LOST.

## Groq classification

Copies the existing structured-output pattern verbatim from
`lib/ai/crm-task-ai.ts:111-129`: OpenAI SDK at `https://api.groq.com/openai/v1`,
`response_format: {type:"json_schema", json_schema:{strict:true}}`, then a **zod
parse**. Model from `GROQ_MODEL` (default `openai/gpt-oss-20b`) — never
hardcoded. Failures go through `lib/ai/ai-failure.ts`'s existing taxonomy.

Preprocessing before the call (tokens AND privacy): chronological, oldest first;
per message direction/sender/date/subject/cleaned body; strip quoted history,
HTML, tracking URLs, base64, repeated signatures; attachments by filename only;
cap each body ~1500 chars and the conversation ~12k, keeping the NEWEST messages
when truncating, since recency decides current status.

Structural guards around the model:
- `won` with empty `aiEvidence` ⇒ downgrade to `interested` + `requiresHumanReview`
- `confidence < 0.65` ⇒ `requiresHumanReview`
- reclassify only when `threadHash` or `lastClassifiedMessageId` changed

Concurrency capped at 4 (no limiter exists in the codebase; this module brings
its own).

## Manual override

`manualStatus` always wins in the UI. Sync never writes it, and keeps updating
`aiStatus` underneath so "Reset to AI classification" stays meaningful. Trust
order, enforced structurally: manual > explicit email evidence > Groq > heuristic.

## Sync

Server action + a cron-guarded route mirroring `app/api/gmail/sync/route.ts`
(Bearer `CRON_SECRET` or a signed-in user with the right permission, then
`checkRateLimit`). Idempotent: rerunning updates, never duplicates. Groq being
down must leave existing classifications untouched and surface a retryable error.

## Page

Metrics strip (5 counts + response/interest/win rates, suppressed when the
denominator is 0), four status views + "Needs review", search, sort, one dense
`DataTable`, and a detail sheet: organisation, contacts, dates, pitch filename,
AI summary, evidence bullets (never chain-of-thought), next action, thread
history. NO_RESPONSE rows carry days-since-outreach and follow-up count — flagged,
never auto-actioned. No email is ever sent by this feature.
