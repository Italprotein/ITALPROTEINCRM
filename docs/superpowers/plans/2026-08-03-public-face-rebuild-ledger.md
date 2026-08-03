# SDD ledger — plan: docs/superpowers/plans/2026-08-03-public-face-rebuild.md
Task 1: complete (commits 526d793..5040fb2, review clean)
Task 1: minor (deferred): rail.tsx:61 aria-label="Access" is hardcoded English, bypasses next-intl (touches the i18n global constraint — final review should triage)
Task 1: minor (deferred): rail.tsx uses raw sky-400/sky-300 instead of brand-gold/brand-goldLight tokens (pixel-identical today)
Task 1: minor (deferred): rail.tsx uses string concat for className instead of the cn() helper
Task 2: review — spec OK, 1 Critical (headline demoted to 11px mono designation; column has no display-weight type), 1 Important (access-menu.tsx dead)
Task 2: minor (deferred): PartnerMarquee lost full-bleed width, now column-constrained
Task 2: minor (deferred): ~14 Landing message keys orphaned (radarBadge, productsTitle, internalTitle/Desc, externalTitle/Desc, ctaBanner*, platformNote, footerNote, ctaInternal/External/Register, contactWebsite, eyebrow)
Task 2: fix round 1/5 dispatched (resumed implementer a88cab2a6dd3e4458)
Task 2: fix round 1/5 (2 addressed, 0 open; commits cb93e95..c495357)
Task 2: complete (commits 5040fb2..c495357, review clean)
Task 3: review — spec OK, auth-behaviour guard independently verified clean; 1 Important (verify page nests a full min-h-screen light page inside the column, duplicate Logo/LanguageSwitcher, live font-display violation via mfa-challenge.tsx:80 + Logo variant=full)
Task 3: controller ruling — the "MfaChallenge out of scope" boundary was mine, not the plan's; widened to allow presentation-only edits there. Plan Global Constraints forbid font-display on public pages, so the fix is required.
Task 3: minor (deferred): hardcoded "Remember my email on this device" string in email-login.tsx:250 (pre-existing, not introduced here)
Task 3: fix round 1/5 dispatched (resumed implementer a6555d8e16167a441)
Task 3: fix round 1/5 (1 addressed, 0 open; commits b30afee..06ff351)
Task 3: complete (commits c495357..06ff351, review clean)
Task 3: minor (deferred): pre-existing hardcoded IT/EN strings in mfa-challenge.tsx not routed through next-intl
Task 4: complete (no commits — verification pass, all checks passed as-built at 06ff351)
Task 4: FINDING — app/[locale]/register/page.tsx still uses its own standalone shell, not PublicShell. In the user's stated scope ("landing + the 6 auth screens"); Task 3's dispatch wrongly told the implementer it needed no change. Dispatching Task 5 to close it.
Task 5: register brought into PublicShell (commit cedff00)
Task 5: FINDING — components/ui/label.tsx hardcodes text-foreground (near-black); form labels unreadable on navy across register/activate/forgot-password/login. Controller ruling: fix at call sites only, never the shared primitive (it is shared with the light-mode admin CRM).
Task 5: fix round 1/5 dispatched (resumed implementer a4847849f8dda9366)
Task 5: fix round 1/5 (contrast addressed at 7 call sites, 0 open; commits cedff00..541c8ab)
Task 5: complete (commits 06ff351..541c8ab)
Controller ruling: Task 5 had no separate task review (it was a gap-closer dispatched after Task 4). Folding its review into the final whole-branch review rather than running a narrower gate first — the final review is strictly more thorough and covers the same range.
FINAL REVIEW: findings must be fixed first. Auth verified unmodified (clean).
  Critical 1: /register unreachable — zero links site-wide after access-menu.tsx deletion + CTA removal.
  Critical 2: /verify renders the rail TWICE (page wraps PublicShell AND mfa-challenge.tsx:68 now renders its own). Caused by the controller's own Task 3 fix instruction.
  Important 3: stale doc comment in verify/page.tsx:6-11. Important 4: not-found.tsx uses font-display (constraint violation) + hardcoded href="/en". Important 5: partner-marquee light-theme tokens on navy.
  Design: largest type on the page describes the CRM, not the company; product image deleted; a visitor learns "this company sells internal software". Reviewer calls the plan's "no new copy" rule the cause.
  Minor triage: fix aria-label i18n, orphaned keys (62 across both files, not 14), mfa-challenge hardcoded strings. Defer: sky-* tokens, cn(), marquee width.
ONE fix wave dispatched (per skill: not one fixer per finding).
FIX WAVE: complete (commits 541c8ab..5581331; report at final-fix-report.md). All 6 findings + 3 minors fixed, 0 blocked.
  Register door added to the rail (third, subordinate); verify page owns the shell and MfaChallenge returns a Module — one rail on every public route, verified live.
  Landing leads with Proamina® + the bottle image; platform copy demoted behind a hairline. not-found in PublicShell, no font-display left on any public route.
  Orphan recount: 26/file, 52 total deleted (review's 31/file was stale — Access.register/registerHint, Common.backToHome, Landing.eyebrow/platformNote are all live again). Pre-existing orphans (TeamLogin.twoFactor*, Common.comingSoon, Errors.permission*) left alone.
  Auth guard clean; typecheck/lint(0 errors)/97 tests/build all pass.
FIX WAVE re-review: all findings addressed, no new breakage, auth behaviourally identical (commits 541c8ab..5581331).
PARKED (residual, not load-bearing — no second fix wave per skill):
  - IT hero product line renders as a lowercase mid-sentence fragment ("il dolcificante…") under display type. Ruling: real, cosmetic, and it is the default locale — worth a one-line copy fix, but it needs a new/edited string and the plan forbade new copy. Surface to the user.
  - Landing.heroCaption is both the rail caption and the bottle's alt text, so a screen reader hears it twice on /it. Ruling: real, minor, one-line fix next pass.
BRANCH COMPLETE at 5581331. Not pushed — user has not seen this design.
