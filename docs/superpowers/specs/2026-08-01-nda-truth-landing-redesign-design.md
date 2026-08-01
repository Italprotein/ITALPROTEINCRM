# NDA counts from one source of truth, Scarica dati cleanup, landing page redesign

Date: 2026-08-01 · Status: approved by user

Three independent pieces of work, ordered by risk. They share no code and can
land in any order; they are specced together because they came from one report.

---

## 1. NDA counts — the register becomes the only thing anyone counts

### The defect

`Aziende` shows `29 NDA firmati`. The NDA register shows a different number.
Both are computed honestly; they answer different questions.

Two representations of the same fact exist:

- **The register** — `NDA` rows. `listNdas()` reduces them to one *current* row
  per company (`lib/nda-current.ts`, ordered `updatedAt desc`). This is what the
  NDA table renders.
- **The cache** — `Company.ndaStatus`, a materialised copy kept for fast list
  rendering and as the portal document-access gate.

Every KPI reads the cache:

- `companyStatistics().ndaSigned` — `lib/services/company.actions.ts:214`
- `ndaStatistics()` — `lib/services/nda.actions.ts:188-207` (counts companies
  whose `ndaStatus` is not `not_required`, *not* register rows)

The NDA page therefore contradicts its own table, and `Aziende` contradicts the
register.

### Why they drift

Three writers move the cache without the register:

1. `lib/backend/gmail-sync.ts:190` — auto-creates a company with
   `ndaStatus: "under_review"` and **no NDA row at all**. That company is
   counted in `ndaStatistics().total` but can never appear in the table.
2. `lib/backend/gmail-sync.ts:292-298` (`advanceCompanyNdaStatus`) — advances
   the company field on a condition evaluated against the *company field*, while
   advancing the NDA row on a different condition against the *row*. The two can
   disagree on the same call.
3. `app/api/documents/upload/route.ts:189-198` — `updateMany` sets
   `ndaStatus: "under_review"` directly.

Local Postgres was down during this investigation (`ECONNREFUSED` on 5432), so
the live drift was not measured. The mechanism is established from the code and
is sufficient to specify the fix; the fix does not depend on the magnitude.

### The fix

**Count the register, everywhere.**

New pure module `lib/nda-stats.ts`:

```
ndaStatusTallies(currentStatuses: Iterable<NDAStatus>) -> {
  total, byStatus, awaitingSignature, signed, toPrepare
}
```

It takes already-reduced *current* statuses (one per company) and returns the
tallies. Expiry-window counting stays at the call sites, which have the dates.

The Prisma-side reduction lives in one server-only module,
`lib/backend/nda-current-status.ts`, exporting
`currentNdaStatusByCompany(where: Prisma.NDAWhereInput): Promise<Map<string, NDAStatus>>`.
It is a plain module, not `"use server"`, so both action files can import it
without its functions becoming callable server actions. The `where` argument is
how each caller passes its own scope (`nda.actions.ts` passes its NDA
`scopeWhere()`; `company.actions.ts` passes `{}` for internal users and the
company filter for external ones), so external users keep seeing only their own
company.

Consumed by both data modes so `DATA_MODE` cannot itself cause drift — the
same anti-drift convention the repo already applies in `lib/labels.ts`:

- `lib/services/nda.actions.ts` — `ndaStatistics()` reduces register rows via
  `currentNdaStatusByCompany()`, then tallies.
- `lib/services/company.actions.ts` — `companyStatistics().ndaSigned` uses the
  same reduction rather than `Company.ndaStatus`. This adds one NDA query to a
  function that previously read only the company table; it is a single
  `findMany` of `(companyId, status)` and runs alongside the existing company
  read, so the cost is one extra round trip.
- `lib/mock-services/ndaService.ts` and `lib/mock-services/companyService.ts` —
  the same pure `ndaStatusTallies` over the `NDAS` fixture, reduced with the
  existing `lib/nda-current.ts` helper. Today the mock NDA service counts raw
  rows rather than current-per-company, which is a third answer again; this
  removes it. `companyService` gains an import of the NDA fixture.
- `lib/services/analytics.actions.ts` — the NDA funnel uses the same reduction.

`Company.ndaStatus` keeps exactly two jobs after this: gating portal document
access, and rendering the per-row badge in the companies table.

### Plugging the leaks

Every writer routes through `syncCompanyNdaStatus`, which gains one option:

| Writer | Behaviour |
| --- | --- |
| `createNda`, `updateNda`, `removeNda`, `setCurrentNdaStatus` | full mirror of the register — unchanged from today |
| `gmail-sync.ts` `advanceCompanyNdaStatus`, `documents/upload/route.ts` | mirror, but **never downgrade out of a signature state** (`partially_signed`, `fully_signed`) |
| `gmail-sync.ts:190` company auto-create | stops hand-setting `ndaStatus`; the NDA filing step creates the register row and syncs from it |

The signature guard is the existing forward-only intent from the previous NDA
design, made explicit and moved into the one helper: an inbound email must never
revoke a client's portal document access.

Signature: `syncCompanyNdaStatus(tx, companyId, opts?: { keepSignedState?: boolean })`.
Default `false` (full mirror) so explicit staff edits behave as today; the two
background paths pass `true`.

### Not doing

No reconcile script, no rewrite of existing `Company.ndaStatus` values — the
user's explicit call. Consequence, stated plainly: rows that already drifted
stay drifted in that column, and a company whose cache says `fully_signed`
while its current register row says otherwise will keep its portal document
access. What changes is that **no count is computed from that column any more**,
so the displayed numbers agree regardless, and no new drift is created.

### Tests

`lib/nda-stats.ts` is pure and gets vitest coverage: tallies over a mixed
status set, empty input, and a company with several register rows reducing to
one. Plus a test that `keepSignedState: true` refuses to move a company out of
`fully_signed` and `false` allows it.

---

## 2. Scarica dati — remove both stat cards

`app/[locale]/admin/import-export/page.tsx` renders two cards above the download
grid:

- **Download format: CSV** — restates the page subtitle.
- **Available records: 1169** — worse than cosmetic. Lines 53-56 load *all
  seven datasets* on mount purely to sum their lengths, so the page pays a full
  data load before the user clicks anything.

Both are removed, together with the now-unused `count` state, effect, and the
`StatCard`/`Database` imports. The page keeps its header and the download grid,
and renders instantly. Per-dataset row counts still reach the user in the toast
that fires after each download (line 63), which is where the number is actually
useful.

---

## 3. Landing page — editorial premium

`app/[locale]/page.tsx`, 481 lines, entirely `'use client'`.

### Direction

Ingredient-house confidence rather than SaaS template. Playfair Display (already
wired as `font-display` in `app/[locale]/layout.tsx`) at genuine display scale
with tight tracking; an eyebrow/kicker treatment; measure held near 62ch;
hairline rules instead of a card around every element. Two deep-navy anchor
bands frame the light sections. Brand navy/gold/teal is preserved throughout.

Section order: sticky header → asymmetric 7/5 hero → localized stats rule →
navy platform band with the radar → two editorial product panels → features on
a hairline grid → partner strip → navy CTA → footer.

### Performance

This is the substantive half of the redesign.

- The page becomes a **server component**. Interactivity and motion drop to
  small client islands: `AccessMenu`, `LanguageSwitcher`, `FeatureRadar`, and a
  new `Reveal` wrapper. Today every one of the 481 lines is client code, so
  framer-motion ships before first paint.
- **Every infinite animation is deleted**: 3 `FloatOrb`s in the hero, 2 in the
  radar band, 2 in the CTA band, the 44-second rotating ring, the 6-second
  pulsing gradient overlay, the bobbing bottle, and the bobbing seal. They run
  forever on every device, costing battery and interaction latency. Static CSS
  gradients replace them.
- `FadeUp` and `AnimatedTitle` are replaced by `Reveal`, a small
  IntersectionObserver + CSS-transition client component.
- `PartnerMarquee` is reimplemented with CSS keyframes (currently framer).
- `TracingBeam` is dropped — decorative, and it costs a scroll listener plus a
  framer dependency.
- `FeatureRadar` stays as a client island; it is a signature element and worth
  its cost.

Net effect: framer-motion leaves the landing route's critical path entirely.
`prefers-reduced-motion` is honoured by `Reveal` and the marquee. The hero
image keeps `priority` and gains explicit `sizes`; the seal loads lazily.

### Content bug fixed on the way

The stats strip (lines 300-303) is hardcoded English — `"Active partners"`,
`"Protein sweetener"`, `"Countries reached"`, `"CRM modules"` — on a site whose
default locale is Italian. The four labels move into `messages/it.json` and
`messages/en.json` under `Landing`.

The footer credit `Creato Da : Amine , con <3` is left exactly as it is.

---

## Verification

- `npm run typecheck`, `npm run lint`, `npm run test` all green.
- New vitest coverage for `lib/nda-stats.ts` and the `keepSignedState` guard.
- Landing page screenshotted live at 1366px and 390px, light and dark.
- Code review pass (`superpowers:requesting-code-review`, then
  `superpowers:receiving-code-review`) before the work is called done.

Because local Postgres is down, the NDA count agreement cannot be verified
against real data on this machine. Verification is therefore: unit tests on the
pure helper, plus reading the call sites to confirm every count now flows
through it. The numbers agreeing on the VPS is the user's confirmation step.

## Non-goals

- No reconcile or backfill of existing `Company.ndaStatus` values.
- No change to the `0 Clienti` figure — it is correct; no company currently sits
  in the `customer` or `repeat_customer` stage.
- No redesign of the admin dashboard or the Aziende table in this pass.
