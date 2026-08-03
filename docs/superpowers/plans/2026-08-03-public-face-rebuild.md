# Public Face Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild ITALPROTEIN's public face — the landing page and the six auth screens — on a single non-template page architecture.

**Architecture:** A fixed instrument rail beside a scrolling record. The rail holds identity, the two doors and contact, permanently; the column holds the substance. Both the landing content and the auth forms render inside the same shell, so the public face is one object rather than seven unrelated pages.

**Tech Stack:** Next.js 16 App Router (server components) · TypeScript · Tailwind · next-intl · lucide-react

## Why this structure

The user's diagnosis, verbatim: *"the colours and type are fine but the page reads like a standard marketing template — hero, stats, features, CTA — and you want a genuinely different structure."*

Two prior rebuilds changed the skin and kept the skeleton: full-width sections stacked vertically, with the call to action repeated three times on the way down. That repetition is itself the template tell — a page repeats its CTA because the reader has scrolled away from the last one.

A fixed rail removes the reason to repeat. The doors are never more than a glance away, so the column is free to carry content in whatever order serves it, and the page stops performing the funnel.

## Global Constraints

- **Palette is settled and unchanged.** `brand-navy #0a1628` field, `brand-navy800 #0d1f38` panel, `brand-gold #38bdf8` (this token is **sky blue**, not gold — it was re-themed and the name kept), `brand-goldLight #7dd3fc`, `brand-teal #0eb89a`. No new colours.
- **Type is settled.** Inter (`font-sans`) at 800 for display, Inter for body, `font-mono` (system stack, no download) for every label, figure and unit. **Playfair / `font-display` must not appear on any public page.**
- Every user-visible string goes through `next-intl` under an existing or new namespace, in **both** `messages/it.json` and `messages/en.json`. Key sets must stay identical between the two files.
- Server components by default. Client components only where interaction demands it.
- **No new dependencies.** No animation library on the public routes.
- Nothing may animate on a loop except the existing `PartnerMarquee` (CSS keyframes).
- `prefers-reduced-motion` respected via the `motion-safe:` variants used by `components/landing/reveal.tsx`.
- The footer credit `Creato Da : Amine , con <3` stays byte-for-byte.
- Auth behaviour must not change: same server actions, same redirects, same MFA challenge flow, same error handling. This is a presentation rebuild.
- `npm run typecheck`, `npm run lint` (0 errors) and `npm run test` must pass at the end of every task.

---

## File Structure

**Created**
- `components/public/public-shell.tsx` — the rail + column frame. Server component.
- `components/public/rail.tsx` — the rail's contents: wordmark scan, the two doors, contact block. Server component wrapping the existing client islands.
- `components/public/module.tsx` — one content module in the column: mono designation, hairline rule, children.

**Modified**
- `app/[locale]/page.tsx` — landing content, rebuilt as modules inside the shell.
- `components/auth/email-login.tsx` — its own split-screen shell removed; renders inside `PublicShell`.
- `app/[locale]/activate/page.tsx`, `app/[locale]/forgot-password/page.tsx`, `app/[locale]/verify/page.tsx` — same.
- `messages/it.json`, `messages/en.json` — new `Public` namespace.

**Reused unchanged**
- `components/landing/wordmark-scan.tsx`, `components/ui/text-hover-effect.tsx`, `components/landing/reveal.tsx`, `components/landing/partner-marquee.tsx`, `components/landing/feature-radar.tsx`, `components/landing/access-menu.tsx`.

---

### Task 1: The public shell

**Files:**
- Create: `components/public/public-shell.tsx`, `components/public/rail.tsx`, `components/public/module.tsx`
- Modify: `messages/it.json`, `messages/en.json`

**Interfaces:**
- Produces: `<PublicShell>{children}</PublicShell>`, `<Rail />`, `<Module designation="…">{children}</Module>`. Tasks 2 and 3 render inside `PublicShell`.

The rail is `lg:fixed lg:inset-y-0 lg:left-0 lg:w-[26rem]`, navy, with a right hairline border. The column is `lg:ml-[26rem]`. Below `lg` the rail becomes a normal static block at the top of the page and the column follows it — no fixed positioning on mobile, where a fixed rail would eat the viewport.

Rail contents, top to bottom: `Logo`, the `WordmarkScan` signature, a short positioning line, the two doors as stacked panels (team → `/team-login`, portal → `/login`), then the contact block and the language switcher pinned to the bottom.

`Module` renders a mono designation, a hairline rule with a lit tick (the existing `ModuleRule` treatment in `app/[locale]/page.tsx`), and its children below.

- [ ] **Step 1:** Build the three components against the Global Constraints.
- [ ] **Step 2:** Add the `Public` namespace to both message files with the rail's strings (`positioning`, `doorTeam`, `doorTeamHint`, `doorPortal`, `doorPortalHint`). Verify key parity with `node -e "const a=require('./messages/it.json'),b=require('./messages/en.json');console.log(JSON.stringify(Object.keys(a.Public))===JSON.stringify(Object.keys(b.Public)))"` → must print `true`.
- [ ] **Step 3:** `npm run typecheck && npm run lint && npm run test`.
- [ ] **Step 4:** Commit.

---

### Task 2: Landing content as modules

**Files:**
- Modify: `app/[locale]/page.tsx`

**Interfaces:**
- Consumes: `PublicShell`, `Module` from Task 1.

The page becomes `<PublicShell>` wrapping modules in this order, using the **existing** `Landing` message keys — no new copy:

1. `radarTitle` / `radarSubtitle` + `<FeatureRadar />`
2. The four `stats` as mono readings with units
3. `featuresTitle` + the six `features` as a `<dl>` specification list
4. `partnersTitle` / `partnersSubtitle` + `<PartnerMarquee />`
5. `heroTitle` / `heroSubtitle` as a closing statement

**The CTA appears exactly once, in the rail.** No call-to-action button in the column — that is the change this rebuild exists to make. `Reveal` wraps module contents below the fold only.

- [ ] **Step 1:** Rebuild the page. Delete every repeated CTA block.
- [ ] **Step 2:** Confirm no `font-display` and no `framer-motion` import: `grep -nE "font-display|framer-motion" "app/[locale]/page.tsx"` → no output.
- [ ] **Step 3:** `npm run typecheck && npm run lint && npm run test`, then `npm run build`.
- [ ] **Step 4:** Commit.

---

### Task 3: Auth screens inside the shell

**Files:**
- Modify: `components/auth/email-login.tsx`, `app/[locale]/activate/page.tsx`, `app/[locale]/forgot-password/page.tsx`, `app/[locale]/verify/page.tsx`

**Interfaces:**
- Consumes: `PublicShell` from Task 1.

`email-login.tsx` currently renders its own `grid lg:grid-cols-[minmax(0,44%)_1fr]` shell with a navy aside (line ~174). Remove that shell and the `Orb` decorations; render the form inside `PublicShell`, in the column. The rail replaces the aside.

**Behaviour must not change.** Do not touch the server actions, the redirect targets, the `workspace`/`ns`/`redirectTo`/`altHref`/`variant` props, the MFA challenge, or any error handling. Presentation only.

- [ ] **Step 1:** Rework `email-login.tsx` presentation; leave all logic untouched.
- [ ] **Step 2:** Wrap `activate`, `forgot-password` and `verify` in `PublicShell`.
- [ ] **Step 3:** Confirm the auth logic is untouched: `git diff -- components/auth/email-login.tsx | grep -E "^[-+].*(signIn|redirect|action|fetch)"` → no output.
- [ ] **Step 4:** `npm run typecheck && npm run lint && npm run test`, then `npm run build`.
- [ ] **Step 5:** Commit.

---

### Task 4: Responsive and accessibility pass

**Files:** any of the above, as defects require.

- [ ] **Step 1:** Start `npm run dev`. Fetch `/it` and `/en`, plus `/it/login`, `/it/team-login`, `/it/register`, `/it/forgot-password`. Every one must return 200.
- [ ] **Step 2:** Confirm the rail is static below `lg` and fixed at `lg` and above — a fixed rail on a phone would consume the viewport.
- [ ] **Step 3:** Confirm every interactive element has a visible focus ring, and that the wordmark scan is legible with no pointer (it must never depend on hover to be readable).
- [ ] **Step 4:** `npm run typecheck && npm run lint && npm run test && npm run build`.
- [ ] **Step 5:** Commit.

---

## Self-Review

**Spec coverage:** the shell (T1), landing (T2), auth (T3), quality floor (T4). The user's diagnosis — generic structure — is answered by T1's rail-and-column architecture and T2's single-CTA rule.

**Placeholder scan:** none. Every task names its exact files, its verification command, and the expected output.

**Type consistency:** `PublicShell`, `Rail`, `Module` are defined in Task 1 and used under those names in Tasks 2 and 3.

**Risk:** Task 3 touches live authentication. Its Step 3 grep is the guard, and the constraint that behaviour must not change is repeated in the task body.
