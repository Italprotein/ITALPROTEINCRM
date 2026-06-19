# Asset Inventory — ITALPROTEIN CRM

This document catalogues every asset discovered under `/assets` for the **ITALPROTEIN CRM** prototype (Italprotein Srl / Proamina(R)). It records what each asset is, how it should (or should not) be used in the frontend, its confidentiality class, and whether it is safe to surface in the **external portal**.

> **Prototype phase note.** This is a **frontend-first** prototype: there is **no production database, no real backend, and no live integrations**. The assets below are raw source material. They will be consumed by the mock service layer (typed services reading TS/JSON fixtures with a localStorage overlay) and by static UI (logos, marketing imagery). Real client documents listed here are **not** part of the demo build — they describe the *existing CRM content to be imported later*, once a real backend and access controls exist. Until then, all confidential material stays out of the shipped prototype and out of source control where feasible.

**Confidentiality classes used below:** Public · Portal General · Pre-NDA · Post-NDA · Company Specific · Internal Only.

---

## 1. Asset Inventory Table

| Filename | Type | Description | Intended frontend use | Confidentiality | Safe for external portal? | NDA access required later? | Duplicate / Outdated |
|---|---|---|---|---|---|---|---|
| `assets/LOGO .jpeg` (105 KB) | Image (JPEG) | Italprotein **PRIMARY** logo — navy "ITALPROTEIN" wordmark, molecular-hexagon "O", royal-blue accent, "OFFICIAL DISTRIBUTORS" subtitle on a white circle. | Login / portal / admin header logo + source for favicon generation. | Public | Yes | No | No |
| `assets/Logo Officiale.png` (140 KB) | Image (PNG) | "CONTAINS PROAMINA(R) / METABOLIC BALANCE" circular **seal** — navy + sage-green ring, hexagonal "P". | Product seal / badge accents on product cards, certificates, portal product pages. | Public | Yes | No | **Duplicate** of `PROAMINA/Logo Officiale.png` (identical 140 KB) |
| `assets/115183 NDA Sudzucker -ITALPROTEIN (16-06-2026).docx` (47 KB) | Document (DOCX) | NDA naming a **real counterparty** (Südzucker). | None in prototype. Real legal document; import later behind access control as an NDA record. | Internal Only / Company Specific | No | It **is** an NDA | No |
| `assets/Italprotein_BusinessPlan_3Anni_v3 (1) (1).docx` (656 KB) | Document (DOCX) | 3-year business plan narrative. | None. Internal strategy document. | Internal Only | No | No (highly confidential) | No |
| `assets/Italprotein_BusinessPlan_v2_2026-2028.xlsx` (254 KB) | Spreadsheet (XLSX) | Business plan **financial model**. | None. Internal financial model. | Internal Only | No | No (highly confidential) | No |
| `assets/Italprotein_OnePager_FINAL_v7 (1) (1).pdf` (356 KB) | Document (PDF) | Investor **one-pager** (revenue, EBITDA, segments, roadmap). | None in prototype. A **redacted** overview *could* later become Portal General. | Internal Only | No | No | **Duplicate pair** with the DOCX below |
| `assets/Italprotein_OnePager_FINAL_v7.docx` (67 KB) | Document (DOCX) | Editable source of the investor one-pager. | None. Source of the PDF above. | Internal Only | No | No | **Duplicate pair** with the PDF above |
| `assets/Italprotein_Proamina_InvestorDeck_2026_modificato.pptx (1) (1).pptx.pdf` (1.5 MB) | Document (PDF export of PPTX) | Investor **deck**. | None. Internal fundraising material. | Internal Only | No | No | Messy duplicated filename (`.pptx … .pptx.pdf`) |
| `assets/Italprotein_Team_AdvisoryBoard_2026 (1) (2).pptx` (6.1 MB) | Presentation (PPTX) | Team / advisory board deck. | None. Internal material. | Internal Only | No | No | No |
| `assets/WhatsApp Image 2026-05-26 at 11.58.19.jpeg` (140 KB) | Image (JPEG) | Informal product / marketing photo. | Candidate marketing imagery for landing / portal **after review & cropping**. | Portal General / Public marketing | Yes (after review) | No | Possibly informal / outdated |
| `assets/WhatsApp Image 2026-05-28 at 14.44.21.jpeg` (92 KB) | Image (JPEG) | Informal product / marketing photo. | Candidate marketing imagery for landing / portal **after review & cropping**. | Portal General / Public marketing | Yes (after review) | No | Possibly informal / outdated |
| `assets/list of approved initial admin users.txt` (163 B) | Text | Initial admin **allowlist** — superadmin + 5 admin emails (some personal). | Seed for future invitation-based admin access only. **Never displayed**; personal emails must be anonymized in any UI. | Internal Only | No | No | No |
| **— `/assets/PROAMINA` (Vite marketing-site repo — REFERENCE) —** | | | | | | | |
| `PROAMINA/tailwind.config.js` | Config (JS) | Brand design tokens (navy / gold / teal / cream) + Inter / Playfair fonts + animations. | **Internal reference** — canonical source of the CRM's CSS-variable design tokens. | Internal Only | No (reference) | No | No |
| `PROAMINA/src/translations/index.js` | Source (JS) | EN / IT / FR / AR marketing copy. | **Internal reference** — reuse EN/IT strings to seed CRM marketing copy and next-intl i18n. | Internal Only | No (reference) | No | No |
| `PROAMINA/Logo.png` (811 KB) | Image (PNG) | Proamina **taupe / gold leaf** circular logo. | Product / brand logo on landing, portal, product pages. | Public | Yes | No | No |
| `PROAMINA/Proamina-removebg-preview.png` (69 KB) | Image (PNG, transparent) | Product jar photo, transparent background. | Hero / product imagery on landing & portal. | Public marketing | Yes | No | No |
| `PROAMINA/Logo Officiale.png` (140 KB) | Image (PNG) | Contains-Proamina / Metabolic-Balance seal. | Product seal / badge. | Public | Yes | No | **Duplicate** of `assets/Logo Officiale.png` (identical 140 KB) |
| `PROAMINA/4cappuccini.jpg` | Image (JPEG) | Marketing photo (cappuccini). | Marketing imagery, landing / portal. | Public marketing | Yes | No | No |
| `PROAMINA/Crema Caffe.png` | Image (PNG) | Marketing photo (coffee cream application). | Marketing imagery, landing / portal. | Public marketing | Yes | No | No |
| `PROAMINA/Proamina Da Sola.png` | Image (PNG) | Marketing photo (product on its own). | Marketing imagery, landing / portal. | Public marketing | Yes | No | No |
| `PROAMINA/Proamina Products.png` | Image (PNG) | Marketing photo (product range). | Marketing imagery, landing / portal. | Public marketing | Yes | No | No |
| `PROAMINA/Proamina.png` | Image (PNG) | Marketing / brand image. | Marketing imagery, landing / portal. | Public marketing | Yes | No | No |
| `PROAMINA/Sacco_pasticceria.png` | Image (PNG) | Marketing photo (bakery / pasticceria bag). | Marketing imagery, segment pages. | Public marketing | Yes | No | No |
| `PROAMINA/Sostituto dolcificante in busta elegante.png` | Image (PNG) | Marketing photo (elegant sweetener sachet). | Marketing imagery, segment pages. | Public marketing | Yes | No | No |
| `PROAMINA/barattolo.png` | Image (PNG) | Marketing photo (jar). | Marketing imagery, product pages. | Public marketing | Yes | No | No |
| `PROAMINA/barattolo-cucina.jpg` | Image (JPEG) | Marketing photo (jar in kitchen). | Marketing imagery, product pages. | Public marketing | Yes | No | No |
| `PROAMINA/bustina-cappuccino.jpg` | Image (JPEG) | Marketing photo (sachet with cappuccino). | Marketing imagery, segment pages. | Public marketing | Yes | No | No |
| `PROAMINA/desserts.jpg` | Image (JPEG) | Marketing photo (desserts). | Marketing imagery, segment pages. | Public marketing | Yes | No | No |
| `PROAMINA/dispenser_rosso_final-removebg-preview.png` | Image (PNG, transparent) | Marketing photo (red dispenser, transparent bg). | Marketing / product imagery. | Public marketing | Yes | No | No |
| `PROAMINA/espresso_cuore.jpg` | Image (JPEG) | Marketing photo (espresso with heart). | Marketing imagery, segment pages. | Public marketing | Yes | No | No |
| `PROAMINA/fronte_bustina.jpg` | Image (JPEG) | Product packaging photo (sachet front). | Product / packaging imagery. | Public marketing | Yes | No | No |
| `PROAMINA/hero-powder-gold.jpg` | Image (JPEG) | Hero marketing photo (gold powder). | **Landing / portal hero** imagery. | Public marketing | Yes | No | No |
| `PROAMINA/logo.jpg` | Image (JPEG) | Logo raster. | Logo usage where raster needed. | Public | Yes | No | Likely duplicate of a brand logo (lowercase variant) |
| `PROAMINA/proamina-powder-marble.jpg` | Image (JPEG) | Marketing photo (powder on marble). | Marketing / hero imagery. | Public marketing | Yes | No | No |
| `PROAMINA/retro_bustina.jpg` | Image (JPEG) | Product packaging photo (sachet back). | Product / packaging imagery. | Public marketing | Yes | No | No |
| `PROAMINA/sacchetti 100% proteine e logo.png` | Image (PNG) | Marketing photo (100% protein bags + logo). | Marketing imagery, segment pages. | Public marketing | Yes | No | No |
| `PROAMINA/shot.jpg` | Image (JPEG) | Marketing photo (product shot). | Marketing imagery. | Public marketing | Yes | No | No |
| `PROAMINA/public/assets/*` | Images | **Normalized copies** of the marketing images above (web-ready). | Preferred web-ready source for any image reused in the CRM. | Public marketing | Yes | No | Normalized duplicates of root `PROAMINA` images |
| `PROAMINA/node_modules/`, `dist/`, `.git/`, `package.json`, `package-lock.json`, `postcss.*`, `vite.*`, `vite-dev.out.log`, `vite-dev.err.log` | Build artifacts / tooling | Dependency tree, build output, lockfiles, bundler/PostCSS/Vite config, dev server logs, git history. | **None — ignore.** Not assets; build/tooling noise. | Internal | No | No | Build artifacts — ignore |
| **— `/assets/CLIENTI` (REAL CLIENT DATA — CONFIDENTIAL) —** | | | | | | | |
| `CLIENTI/Clienti Industriali/Proamina_Rotta_Campioni_04-06-2026.pdf` (7 KB) | Document (PDF) | **Sample route / logistics report** with REAL client names, addresses, contacts, sample quantities (IT + international, customs). | None in prototype. **Structural reference** for the sample/shipment data model — **anonymize** before any seed use. | Internal Only / Company Specific | No | Yes (client-confidential) | No |
| `CLIENTI/<~40 per-client folders>/` (NDAs, pitch decks, TDS) | Documents (PDF / DOCX / PPTX) | Real client NDAs (several **signed**), client pitch decks (`Italprotein_x_<Client>.pptx`), and the comparative TDS (below). Real counterparties incl. Barilla, Südzucker, Ehrmann, Galbusera, Colussi, Venchi, Fabbri 1905, Emmi, NOM, Groupe Bel, NaturaSì, ABS Food, Casillo, Foodness, Suntory, Al Ain Farms, Almarai/Bakemart, The Protein Works, Nick's, Nutrimuscle, Disproquima, Funky Veggie, Innofoods, Milaf, Possible Foods, Prontofoods, Crave, Icedog, Vegamore, etc. | None in prototype. **Existing CRM content to import later** behind access control. Never reuse real names verbatim in seed data. | Internal Only / Company Specific | No | Yes | No |
| `CLIENTI/.../Proamina_vs_Sucrose_Comparative_TDS_v2.pdf` | Document (PDF) | Technical Data Sheet — Proamina vs. sucrose comparative. | **Post-NDA technical document.** Surfaced to companies in the portal **only after an executed NDA**, via documentService. | Post-NDA | No (until NDA executed) | Yes | No |
| `CLIENTI/Bar & Pasticcerie/Vegamore/nda/1819.jpg`, `1820.jpg`, `1821.jpg` | Images (JPEG) | Photos of a **signed NDA**. | None in prototype. Import later as an NDA record behind access control. | Internal Only / Company Specific | No | Yes (signed NDA) | No |

---

## 2. Brand Palette & Typography Extracted

Extracted from `PROAMINA/tailwind.config.js` and the design-token decisions. These map directly to the CRM's Tailwind CSS v3 **CSS-variable design tokens** (shadcn/ui convention).

### Core palette

| Token role | Hex | Notes |
|---|---|---|
| Navy — foundation | `#0a1628` | Primary background / foundation color |
| Navy — variant 2 | `#0d1f38` | Surface / elevated background |
| Navy — variant 3 | `#112840` | Surface / border accents |
| Gold — accent | `#c9a227` | Primary accent |
| Gold — light | `#e8c84a` | Accent hover / highlight |
| Gold — dark | `#a07c1a` | Accent pressed / deep |
| Teal | `#0eb89a` | Secondary accent |
| Teal — dark | `#0a9980` | Teal pressed / deep |
| Cream | `#f8f4ed` | Light surface / paper |

**Secondary brand colors:** **sage green** (seal ring / "Metabolic Balance" mark) and **molecular / royal blue** (Italprotein wordmark accent). White + charcoal/navy form the foundation.

### Status colors

success / green · warning / amber · danger / red · info / blue · neutral / slate.

### Typography

- **Inter** — UI / body text.
- **Playfair Display** — display / serif headings.

> The palette and fonts above are the **single source of truth** for the CRM's design tokens; `PROAMINA/tailwind.config.js` is the internal reference they were derived from.

---

## 3. Logos & Marks

Three distinct marks are in scope:

1. **Italprotein wordmark** — navy "ITALPROTEIN" with a **molecular-hexagon "O"**, royal-blue accent, and "OFFICIAL DISTRIBUTORS" subtitle.
   - Source: `assets/LOGO .jpeg` (primary). Use: login / portal / admin header + favicon source. **Public · portal-safe.**
2. **Proamina leaf circular mark** — **taupe / gold leaf** circular logo.
   - Source: `PROAMINA/Logo.png`. Use: product / brand logo on landing, portal, product pages. **Public · portal-safe.**
3. **"Contains Proamina(R) / Metabolic Balance" seal** — navy + **sage-green** ring with a **hexagonal "P"**.
   - Source: `assets/Logo Officiale.png` (= `PROAMINA/Logo Officiale.png`, duplicate). Use: product seal / badge accents. **Public · portal-safe.**

---

## 4. Confidential Assets — Do NOT Expose

The following must **never** appear in the external portal or the public landing page, and must not be bundled into the shipped prototype. They are listed here only so the team knows they exist and represent content to be imported later behind real backend access control.

- **Business plan (narrative + financial model):** `Italprotein_BusinessPlan_3Anni_v3 (1) (1).docx`, `Italprotein_BusinessPlan_v2_2026-2028.xlsx`.
- **Investor deck:** `Italprotein_Proamina_InvestorDeck_2026_modificato.pptx (1) (1).pptx.pdf`; plus the team/advisory deck `Italprotein_Team_AdvisoryBoard_2026 (1) (2).pptx`.
- **One-pager financials:** `Italprotein_OnePager_FINAL_v7 (1) (1).pdf` + `Italprotein_OnePager_FINAL_v7.docx` (a *redacted* overview could later be Portal General — the raw files are Internal Only).
- **All client NDAs:** `115183 NDA Sudzucker -ITALPROTEIN (16-06-2026).docx`, every NDA inside `CLIENTI/`, and NDA photo scans (`CLIENTI/Bar & Pasticcerie/Vegamore/nda/1819–1821.jpg`).
- **Client pitch decks:** all `Italprotein_x_<Client>.pptx` files under `CLIENTI/`.
- **Sample route report:** `CLIENTI/Clienti Industriali/Proamina_Rotta_Campioni_04-06-2026.pdf` (real names, addresses, contacts, quantities, customs).
- **Initial-admin email list:** `assets/list of approved initial admin users.txt` (contains personal emails — anonymize in any UI).
- **Post-NDA technical doc:** `Proamina_vs_Sucrose_Comparative_TDS_v2.pdf` — portal-visible **only after** an executed NDA.

> **Where the real backend connects later:** confidential documents will be served through `documentService` / `ndaService` gated by the `lib/permissions` role→permission matrix and by NDA status — never as static public files.

---

## 5. Recommendations

1. **Reuse the Proamina marketing imagery for the portal & landing.** The `PROAMINA/public/assets/*` normalized copies (and root originals) — hero shots (`hero-powder-gold.jpg`, `proamina-powder-marble.jpg`), product/packaging photos, and application photos (cappuccini, desserts, espresso) — are Public marketing and portal-safe. Prefer the `public/assets` web-ready versions. The two WhatsApp photos may be used **after review and cropping**.
2. **Anonymize all real client names in seed data.** The 36 companies / 75 contacts / opportunities / samples / shipments must be **fictional/anonymized**. The `CLIENTI/` folder (NDAs, pitch decks, sample route report) and the real counterparties (Barilla, Südzucker, Ehrmann, Venchi, Fabbri 1905, Emmi, Groupe Bel, NaturaSì, etc.) are the *structure* to model — never the literal names. Use the sample route report only as a **shape reference** for the sample/shipment data model.
3. **Treat build artifacts as noise to ignore.** `PROAMINA/node_modules/`, `PROAMINA/dist/`, lockfiles, PostCSS/Vite/Tailwind tooling configs, and `vite-dev.out.log` / `vite-dev.err.log` are build artifacts — exclude them from the inventory's "assets" and from any import.
4. **Resolve duplicates.** `Logo Officiale.png` exists identically in both `assets/` and `PROAMINA/`; keep one canonical copy. The one-pager exists as a PDF/DOCX pair, and the investor deck has a malformed double-extension filename — normalize naming when archiving.
5. **Derive tokens & i18n from the reference repo.** Use `PROAMINA/tailwind.config.js` as the source for CRM design tokens and `PROAMINA/src/translations/index.js` (EN/IT) to seed marketing copy and next-intl translations.
6. **Gate everything confidential behind the future backend.** No business plan, investor/team deck, financials, client NDA, client pitch deck, sample route report, or admin email list should ship in the static prototype; wire them through services + permissions when the real backend lands.
