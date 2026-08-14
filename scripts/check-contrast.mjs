#!/usr/bin/env node
/**
 * WCAG 2.1 contrast auditor — Task 2 (admin accessibility sweep).
 *
 * Pure-node relative-luminance / contrast-ratio calculator (no deps, no CSS
 * parsing). Token values below are a HAND-COPIED mirror of the custom
 * properties in `app/globals.css` — every entry cites the exact source line
 * so a reviewer can diff this table against the file by eye. This script
 * intentionally does NOT read or parse globals.css at runtime: if that file
 * changes, re-copy the affected numbers here (and update the line-number
 * comment) so the script keeps auditing what's actually shipped rather than
 * silently trusting a parse of arbitrary CSS.
 *
 * Formulas: WCAG 2.1 §1.4.3 (text contrast) / §1.4.11 (non-text contrast).
 *   relative luminance: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *   contrast ratio:     https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 *
 * Thresholds applied per row (brief step 1): 4.5:1 for normal text, 3:1 for
 * large text / UI components / borders. Each row below states which bar it
 * uses and why.
 *
 * Usage: node scripts/check-contrast.mjs
 * Exit code: 0 if every row (except explicit N/A / exempt rows) passes its
 * bar, 1 otherwise — so this can be scripted, not just eyeballed.
 *
 * Fix round 1 (post-task): added --info-text (Section H) and marked
 * Section B's `info` row exempt to close the 3 open failures from the
 * original run — see task-2-report.md's "Fix round 1" addendum.
 */

// ===========================================================================
// Color math
// ===========================================================================

/** CSS Color 4 hsl->rgb (h in degrees, s/l in 0-100). Returns 0-255 channels. */
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: 255 * f(0), g: 255 * f(8), b: 255 * f(4) };
}

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function channelLuminance(c) {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }) {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(rgbA, rgbB) {
  const l1 = relativeLuminance(rgbA);
  const l2 = relativeLuminance(rgbB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Standard source-over alpha compositing in sRGB (gamma) space — this is how
 * a browser actually paints e.g. `bg-brand-gold/15` over whatever surface
 * sits behind it (simple background-color alpha blending is NOT done in
 * linear-light space by default), so blending gamma-encoded channels here
 * matches what renders on screen.
 */
function compositeOver(fg, alpha, bg) {
  return {
    r: alpha * fg.r + (1 - alpha) * bg.r,
    g: alpha * fg.g + (1 - alpha) * bg.g,
    b: alpha * fg.b + (1 - alpha) * bg.b,
  };
}

// ===========================================================================
// Token mirror — HAND-COPIED from app/globals.css. [h, s, l] exactly as
// written in the file (s/l are percentages without the % sign; the file
// itself stores raw HSL channels with no hsl() wrapper, same convention).
// ===========================================================================

// :root (light theme) — app/globals.css lines 12-121
const LIGHT = {
  background: [210, 38, 98.5], // line 22
  foreground: [216.67, 60, 9.8], // line 23
  card: [0, 0, 100], // line 24
  cardForeground: [216.67, 60, 9.8], // line 25
  popover: [0, 0, 100], // line 26
  popoverForeground: [216.67, 60, 9.8], // line 27
  primary: [216.67, 60, 9.8], // line 30
  primaryForeground: [210, 40, 98], // line 31
  secondary: [207, 48, 95], // line 34
  secondaryForeground: [216.67, 60, 12], // line 35
  muted: [210, 28, 96], // line 36
  mutedForeground: [214, 18, 42], // line 37
  accent: [202, 61, 93], // line 38
  accentForeground: [216.67, 60, 12], // line 39
  destructive: [0, 72, 48], // line 42
  destructiveForeground: [0, 0, 100], // line 43
  border: [211, 31, 88], // line 46
  input: [211, 31, 84], // line 47
  ring: [200, 98, 39], // line 48
  success: [160, 72, 30], // line 59 (tuned from 34 — see comment above it in globals.css)
  successForeground: [0, 0, 100], // line 60
  successSubtle: [160, 55, 94], // line 61
  successText: [160, 84, 22], // line 66 (added this task)
  warning: [38, 92, 48], // line 67
  warningForeground: [30, 80, 14], // line 68
  warningSubtle: [42, 96, 92], // line 69
  warningText: [30, 90, 32], // line 77 (added this task)
  danger: [0, 72, 50], // line 78
  dangerForeground: [0, 0, 100], // line 79
  dangerSubtle: [0, 84, 96], // line 80
  dangerText: [0, 74, 45], // line 88
  info: [221, 83, 53], // line 89
  infoForeground: [0, 0, 100], // line 90
  infoSubtle: [221, 92, 96], // line 91
  infoText: [221, 83, 53], // line 99 (fix round 1 — identical to --info; see comment above it)
  sidebar: [216, 62, 9], // line 106
  sidebarForeground: [210, 30, 86], // line 107
  sidebarMuted: [213, 18, 58], // line 108
  sidebarAccent: [199, 92, 60], // line 109
};

// .dark — app/globals.css lines 123-160. `.dark` only OVERRIDES a subset of
// custom properties; anything not listed here is not redefined and inherits
// its LIGHT value through the normal CSS cascade (confirmed by reading the
// file — no other block redefines them for dark). Notably: --success,
// --success-foreground, --warning, --warning-foreground, and all --sidebar-*
// tokens are theme-invariant by this mechanism, which is exactly the
// condition this script's job is to prove safe or unsafe.
const DARK_OVERRIDES = {
  background: [216, 58, 6.5], // line 125
  foreground: [210, 36, 94], // line 126
  card: [216, 48, 9.5], // line 127
  cardForeground: [210, 36, 94], // line 128
  popover: [216, 50, 8.5], // line 129
  popoverForeground: [210, 36, 94], // line 130
  primary: [199, 92, 60], // line 131
  primaryForeground: [216.67, 60, 9.8], // line 132
  secondary: [215, 35, 14], // line 133
  secondaryForeground: [210, 36, 94], // line 134
  muted: [215, 31, 13], // line 135
  mutedForeground: [211, 19, 66], // line 136
  accent: [207, 42, 17], // line 137
  accentForeground: [210, 36, 94], // line 138
  destructive: [0, 62, 46], // line 139
  destructiveForeground: [0, 0, 100], // line 140
  border: [211, 32, 20], // line 141
  input: [211, 32, 23], // line 142
  ring: [199, 92, 60], // line 143
  successSubtle: [160, 40, 16], // line 144
  successText: [152, 60, 60], // line 146 (added prior task)
  warningSubtle: [38, 50, 18], // line 147
  warningText: [43, 96, 60], // line 149 (added prior task)
  dangerSubtle: [0, 50, 20], // line 150
  dangerText: [0, 90, 70], // line 152
  infoSubtle: [221, 50, 20], // line 153
  infoText: [217, 91, 68], // line 157 (added fix round 1)
};
const DARK = { ...LIGHT, ...DARK_OVERRIDES };

// Raw brand hex — tailwind.config.ts lines 104-125 (`theme.extend.colors.brand`).
// Plain hex (not CSS vars), so identical in both themes; badge.tsx's `gold`
// variant has no `dark:` classes, confirmed by reading the file.
const BRAND_HEX = {
  navy: '#0A1628', // tailwind.config.ts line 106
  blue: '#0284C7', // line 110
  blueBright: '#38BDF8', // line 111
  gold: '#38bdf8', // line 116 (brand re-themed gold -> light blue)
  goldDark: '#0284c7', // line 118
};

// NOTE: --gold / --gold-foreground (globals.css lines 102-103, 158-159) are
// declared but DEAD — grepped the whole app/components tree for `var(--gold`
// and for a `gold:` entry in tailwind.config.ts's colors map; neither exists,
// so no Tailwind utility class resolves to this CSS var and nothing renders
// it. Excluded from the audit table because there is nothing to audit.

function resolve(spec, theme) {
  const [kind, key] = spec.split(':');
  if (kind === 'token') {
    const hsl = theme[key];
    if (!hsl) throw new Error(`Unknown token: ${key}`);
    return hslToRgb(hsl[0], hsl[1], hsl[2]);
  }
  if (kind === 'hex') {
    const hex = BRAND_HEX[key];
    if (!hex) throw new Error(`Unknown brand hex: ${key}`);
    return hexToRgb(hex);
  }
  throw new Error(`Unknown color spec: ${spec}`);
}

// ===========================================================================
// components/ui/badge.tsx lines 9-40 — variant -> {text, bg} utility classes,
// mapped to the tokens they resolve to. Mirrors the file; not parsed from it.
// `textDark` = a `dark:text-*` override this task added; omitted where the
// variant only ever had one text class (theme-invariant token or unchanged).
// ===========================================================================
const BADGE_VARIANTS = [
  { name: 'default', text: 'token:primaryForeground', bg: 'token:primary' }, // line 10
  { name: 'secondary', text: 'token:secondaryForeground', bg: 'token:secondary' }, // line 11
  {
    name: 'outline',
    text: 'token:foreground',
    bg: 'token:card',
    note: 'bg-transparent in the class (no fill) — audited against `card`, its typical container; foreground-on-background is already covered in section A',
  }, // line 12
  {
    name: 'success',
    text: 'token:successText',
    bg: 'token:successSubtle',
    note: 'FIXED this task: was text-success (3.44/3.33:1 fail both themes) — see badge.tsx',
  }, // line 15 (post-fix)
  {
    name: 'warning',
    text: 'token:warningText',
    bg: 'token:warningSubtle',
    note: 'FIXED this task: was text-warning-foreground (1.19:1 fail dark) — see badge.tsx',
  }, // line 19 (post-fix)
  {
    name: 'danger',
    text: 'token:dangerText',
    bg: 'token:dangerSubtle',
    note: 'FIXED this task: was text-danger (4.29:1 fail light, 2.92:1 fail dark) — see badge.tsx',
  }, // line 22 (post-fix)
  {
    name: 'info',
    text: 'token:info',
    textDark: 'hex:blueBright',
    bg: 'token:infoSubtle',
    note: 'FIXED this task (dark only): was text-info in both themes (2.74:1 fail dark); added dark:text-brand-blueBright — see badge.tsx',
  }, // line 29 (post-fix)
  {
    name: 'gold',
    text: 'hex:navy',
    textDark: 'hex:blueBright',
    bgHex: 'hex:gold',
    alpha: 0.15,
    onSurface: 'token:card',
    note: 'FIXED this task: was text-brand-goldDark in both themes (3.65:1 fail light, 3.38:1 fail dark); now text-brand-navy (light) / dark:text-brand-blueBright — see badge.tsx. Composited over `card`, its typical container (verified: agencies/[id] and companies/[id] both render it inside a bg-card block).',
  }, // line 38 (post-fix)
  { name: 'muted', text: 'token:mutedForeground', bg: 'token:muted' }, // line 39 (post-fix)
];

// ===========================================================================
// Row table — brief step 1 bullets, plus a few real-usage combinations
// found in the admin tree that the minimum bullet list doesn't literally
// spell out (each such row says so and names the call sites).
// ===========================================================================

const BAR_TEXT = 4.5; // normal text
const BAR_UI = 3.0; // large text / UI components / borders

const rows = [];
function addRow(section, label, textSpec, bgSpec, bar, note, exempt) {
  rows.push({ section, label, textSpec, bgSpec, bar, note, exempt });
}

// --- Section A: brief bullet 1 — foreground, muted-foreground on 5 surfaces
for (const [textKey, textLabel] of [['foreground', 'foreground'], ['mutedForeground', 'muted-foreground']]) {
  for (const [surfKey, surfLabel] of [
    ['background', 'background'],
    ['card', 'card'],
    ['muted', 'muted'],
    ['accent', 'accent'],
    ['secondary', 'secondary'],
  ]) {
    addRow('A', `${textLabel} on ${surfLabel}`, `token:${textKey}`, `token:${surfKey}`, BAR_TEXT);
  }
}

// --- Section B: brief bullet 2 — status colors on background/card/own-subtle
//
// EXEMPT rows (danger/destructive/warning/success): after this task's fixes,
// every prose/label/icon call site that used to read these DEFAULT tokens as
// copy was migrated to the corresponding *-text token (danger-text already
// existed; warning-text/success-text were added — see Section H) or, for
// `success`, to the white-chip role it's now tuned for (Section C). A repo
// grep for the bare classes (text-danger, text-warning(-foreground),
// text-success(-foreground)) in the admin/CRM scope after the fixes turns up
// nothing but that chip role and this script's own comments — see
// task-2-report.md's file list for the exhaustive per-site migration. These
// rows are kept (not deleted) because bullet 2 explicitly asks for them; a
// FAIL here is marked exempt rather than hidden, since it's still true of
// the raw token in isolation — just not reachable through any component in
// scope any more.
//
// `info` (fix round 1): was NOT exempt in the original task (no --info-text
// token existed, so text-info was still genuinely reachable and failing in
// dark mode). Now exempt for the same reason as the other three: every real
// text-info-as-copy call site was migrated to text-info-text (see Section
// H). The one remaining consumer of bare `text-info` is badge.tsx's `info`
// variant, and only in LIGHT mode (where it already passes, 4.60:1) — its
// DARK mode uses a hardcoded `dark:text-brand-blueBright` override that
// doesn't read this token at all, so `info` on dark background/card/subtle
// is orphaned there too.
const STATUS_SUBTLE = {
  danger: 'dangerSubtle',
  dangerText: 'dangerSubtle',
  warning: 'warningSubtle',
  success: 'successSubtle',
  info: 'infoSubtle',
};
const NO_LONGER_USED_AS_COPY = new Set(['danger', 'destructive', 'warning', 'success', 'info']);
for (const color of ['danger', 'dangerText', 'destructive', 'warning', 'success', 'info']) {
  const label = color === 'dangerText' ? 'danger-text' : color;
  const exempt = NO_LONGER_USED_AS_COPY.has(color) || undefined;
  const exemptNote = exempt
    ? `EXEMPT: --${color} is no longer used as copy anywhere in admin/CRM scope (migrated to *-text or, for success, kept only as the white-chip bg — see comment above Section B)`
    : undefined;
  addRow('B', `${label} on background`, `token:${color}`, 'token:background', BAR_TEXT, exemptNote, exempt);
  addRow('B', `${label} on card`, `token:${color}`, 'token:card', BAR_TEXT, exemptNote, exempt);
  const subtle = STATUS_SUBTLE[color];
  if (subtle) {
    addRow('B', `${label} on ${subtle.replace('Subtle', '-subtle')}`, `token:${color}`, `token:${subtle}`, BAR_TEXT, exemptNote, exempt);
  } else {
    addRow('B', `${label} on own-subtle`, null, null, BAR_TEXT, 'N/A — no --destructive-subtle token exists in globals.css (grepped, confirmed absent)');
  }
}

// --- Section B2: warning-foreground / success-foreground as COPY.
// Not literally in bullet 2 (which lists `warning`/`success`, not their
// `-foreground` companions) but grep of the admin tree BEFORE this task's
// fixes showed these used as prose/label/icon text, paired with their own
// subtle fill and bare against ambient background/card — e.g. badge.tsx's
// old warning variant, kpi-card.tsx, stat-card.tsx, mfa-setup.tsx,
// mfa-enrollment-notice.tsx, finance/page.tsx, companies/page.tsx,
// admin/page.tsx, pipeline-funnel.tsx, activities/page.tsx,
// calendar/page.tsx, contacts/page.tsx, registrations/page.tsx,
// companies/[id]/page.tsx. Checked here because these color values are
// theme-invariant (not redefined in .dark) while the subtle/card/background
// surfaces they sit on go very dark — exactly the shape of bug this sweep
// exists to catch. EXEMPT: every one of those sites was migrated to
// warning-text/success-text (see Section H) — the only remaining real
// consumer of *-foreground-on-solid is the passing chip role in Section C.
for (const [fg, fgLabel, subtle, subtleLabel] of [
  ['warningForeground', 'warning-foreground', 'warningSubtle', 'warning-subtle'],
  ['successForeground', 'success-foreground', 'successSubtle', 'success-subtle'],
]) {
  const exemptNote = `EXEMPT: --${fg} is no longer used as copy anywhere in admin/CRM scope (migrated to *-text — see Section H)`;
  addRow('B2', `${fgLabel} on background`, `token:${fg}`, 'token:background', BAR_TEXT, exemptNote, true);
  addRow('B2', `${fgLabel} on card`, `token:${fg}`, 'token:card', BAR_TEXT, exemptNote, true);
  addRow('B2', `${fgLabel} on ${subtleLabel}`, `token:${fg}`, `token:${subtle}`, BAR_TEXT, exemptNote, true);
}

// --- Section C: brief bullet 3 — *-foreground on solid fills (chip mode)
for (const [bg, fg] of [
  ['danger', 'dangerForeground'],
  ['destructive', 'destructiveForeground'],
  ['warning', 'warningForeground'],
  ['success', 'successForeground'],
  ['info', 'infoForeground'],
]) {
  addRow('C', `${fg} on ${bg} (filled chip)`, `token:${fg}`, `token:${bg}`, BAR_TEXT);
}

// --- Section D: brief bullet 4
addRow('D', 'primary-foreground on primary', 'token:primaryForeground', 'token:primary', BAR_TEXT);
addRow('D', 'accent-foreground on accent', 'token:accentForeground', 'token:accent', BAR_TEXT);

// --- Section E: brief bullet 5 — ring, UI component bar
addRow('E', 'ring on background', 'token:ring', 'token:background', BAR_UI);
addRow('E', 'ring on card', 'token:ring', 'token:card', BAR_UI);

// --- Section F: brief bullet 6 — sidebar
addRow('F', 'sidebar-foreground on sidebar', 'token:sidebarForeground', 'token:sidebar', BAR_TEXT);
addRow('F', 'sidebar-muted on sidebar', 'token:sidebarMuted', 'token:sidebar', BAR_TEXT, 'nav section labels render this as text (sidebar.tsx:52)');
addRow('F', 'sidebar-accent on sidebar', 'token:sidebarAccent', 'token:sidebar', BAR_UI, 'active nav icon/indicator — UI element, not body text');

// --- Section G: brief bullet 7 — badge.tsx's 9 variants
for (const v of BADGE_VARIANTS) {
  const textLabel = v.textDark ? `${v.text} / dark:${v.textDark}` : v.text;
  if (v.alpha) {
    rows.push({
      section: 'G',
      label: `badge:${v.name} (${textLabel} on ${v.bgHex}/${Math.round(v.alpha * 100)}% → ${v.onSurface})`,
      alphaSpec: v,
      bar: BAR_TEXT,
      note: v.note,
    });
  } else {
    rows.push({
      section: 'G',
      label: `badge:${v.name} (${textLabel} on ${v.bg})`,
      textSpec: v.text,
      textSpecDark: v.textDark,
      bgSpec: v.bg,
      bar: BAR_TEXT,
      note: v.note,
    });
  }
}

// --- Section H: the tokens this task added (--warning-text, --success-text
// in the original task; --info-text in fix round 1), verified directly on
// background/card/own-subtle in both themes — this is pattern 2's own
// instruction ("VERIFY these clear 4.5:1 with your script on
// background+card+subtle first; tune lightness if not") kept as a
// permanent, re-runnable check rather than a one-off. Also includes the
// --success white-chip re-tune (34%->30% lightness) verified against
// --success-foreground directly, independent of Section C's badge table
// (which already covers the same pair via button.tsx's variant).
for (const [color, colorLabel, subtle, subtleLabel] of [
  ['warningText', 'warning-text', 'warningSubtle', 'warning-subtle'],
  ['successText', 'success-text', 'successSubtle', 'success-subtle'],
  ['infoText', 'info-text', 'infoSubtle', 'info-subtle'],
]) {
  addRow('H', `${colorLabel} on background`, `token:${color}`, 'token:background', BAR_TEXT, 'new token, added this task');
  addRow('H', `${colorLabel} on card`, `token:${color}`, 'token:card', BAR_TEXT, 'new token, added this task');
  addRow('H', `${colorLabel} on ${subtleLabel}`, `token:${color}`, `token:${subtle}`, BAR_TEXT, 'new token, added this task');
}
addRow(
  'H',
  'success-foreground on success (white-chip role, re-verified directly)',
  'token:successForeground',
  'token:success',
  BAR_TEXT,
  '--success re-tuned 34%->30% lightness this task so this pair (Button variant="success" et al) clears 4.5:1 — duplicate of a Section C computation, re-run here as its own token-level check since it is the reason --success changed',
);

// ===========================================================================
// Evaluate + print
// ===========================================================================

// `isDark`: when true and the row declares a `textSpecDark` / `alphaSpec.textDark`
// (a `dark:text-*` utility class that overrides the base text color), that spec
// is used instead of the base one — mirrors how Tailwind's `dark:` variant wins.
function evalRow(row, theme, isDark) {
  if (row.note && row.note.startsWith('N/A')) return { na: true };
  let textRgb;
  let bgRgb;
  if (row.alphaSpec) {
    const textSpec = (isDark && row.alphaSpec.textDark) || row.alphaSpec.text;
    const fg = resolve(row.alphaSpec.bgHex, theme);
    const surface = resolve(row.alphaSpec.onSurface, theme);
    bgRgb = compositeOver(fg, row.alphaSpec.alpha, surface);
    textRgb = resolve(textSpec, theme);
  } else {
    const textSpec = (isDark && row.textSpecDark) || row.textSpec;
    textRgb = resolve(textSpec, theme);
    bgRgb = resolve(row.bgSpec, theme);
  }
  const ratio = contrastRatio(textRgb, bgRgb);
  return { ratio, pass: ratio >= row.bar };
}

function fmtRatio(r) {
  return `${r.toFixed(2)}:1`;
}

const results = rows.map((row) => ({
  row,
  light: evalRow(row, LIGHT, false),
  dark: evalRow(row, DARK, true),
}));

const sectionNames = {
  A: 'A — foreground/muted-foreground on core surfaces (bullet 1)',
  B: 'B — status colors as copy: background/card/own-subtle (bullet 2)',
  B2: 'B2 — warning-foreground/success-foreground as copy (real-usage addition)',
  C: 'C — *-foreground on solid fills, chip mode (bullet 3)',
  D: 'D — primary-foreground/accent-foreground (bullet 4)',
  E: 'E — ring on background/card, UI bar (bullet 5)',
  F: 'F — sidebar tokens (bullet 6)',
  G: "G — badge.tsx's 9 variants (bullet 7)",
  H: 'H — new tokens (--warning-text, --success-text, --info-text, --success re-tune)',
};

console.log('='.repeat(100));
console.log('WCAG 2.1 contrast audit — ITALPROTEIN CRM admin tree (Task 2)');
console.log('Bars: 4.5:1 normal text · 3:1 large text / UI component / border');
console.log('='.repeat(100));

let currentSection = null;
const rowLabelWidth = 62;
for (const { row, light, dark } of results) {
  if (row.section !== currentSection) {
    currentSection = row.section;
    console.log('');
    console.log(sectionNames[currentSection] ?? currentSection);
    console.log('-'.repeat(100));
    console.log(
      `${'Row'.padEnd(rowLabelWidth)} ${'Bar'.padEnd(5)} ${'Light'.padEnd(16)} ${'Dark'.padEnd(16)}`,
    );
  }
  const bar = row.bar.toFixed(1);
  const fmtCell = (cell) => {
    if (cell.na) return 'N/A';
    if (cell.pass) return `${fmtRatio(cell.ratio)} PASS`;
    return row.exempt ? `${fmtRatio(cell.ratio)} FAIL*` : `${fmtRatio(cell.ratio)} FAIL`;
  };
  const lightStr = fmtCell(light);
  const darkStr = fmtCell(dark);
  console.log(`${row.label.padEnd(rowLabelWidth)} ${bar.padEnd(5)} ${lightStr.padEnd(16)} ${darkStr.padEnd(16)}`);
  if (row.note) console.log(`  └─ ${row.note}`);
}
console.log('');
console.log('* FAIL* = fails the bar in isolation but is EXEMPT — see the row\'s note for why nothing in scope reads it this way any more.');

// --- Failures, printed prominently. Real failures and exempt failures are
// listed separately so a genuine gap (info) can never hide behind the count
// of cells that are only theoretically failing. ---
const failures = [];
const exemptFailures = [];
for (const { row, light, dark } of results) {
  if (!light.na && !light.pass) (row.exempt ? exemptFailures : failures).push({ row, theme: 'light', ratio: light.ratio });
  if (!dark.na && !dark.pass) (row.exempt ? exemptFailures : failures).push({ row, theme: 'dark', ratio: dark.ratio });
}

console.log('');
console.log('#'.repeat(100));
console.log(`REAL FAILURES (not exempt): ${failures.length}`);
console.log('#'.repeat(100));
if (failures.length === 0) {
  console.log('None. Every non-exempt row clears its bar in both themes.');
} else {
  for (const f of failures) {
    console.log(
      `[${f.row.section}] ${f.row.label} — ${f.theme.toUpperCase()}: ${fmtRatio(f.ratio)} (needs ${f.row.bar}:1)`,
    );
  }
}

if (exemptFailures.length > 0) {
  console.log('');
  console.log(`EXEMPT (fail in isolation, not reachable through any component in scope): ${exemptFailures.length}`);
  for (const f of exemptFailures) {
    console.log(
      `[${f.row.section}] ${f.row.label} — ${f.theme.toUpperCase()}: ${fmtRatio(f.ratio)} (needs ${f.row.bar}:1)`,
    );
  }
}

const totalCells = results.length * 2 - results.filter((r) => r.light.na).length - results.filter((r) => r.dark.na).length;
console.log('');
console.log(
  `${rows.length} rows checked × 2 themes = ${totalCells} pairs evaluated (N/A cells excluded). ` +
    `${failures.length} real failures, ${exemptFailures.length} exempt failures.`,
);

process.exit(failures.length > 0 ? 1 : 0);
