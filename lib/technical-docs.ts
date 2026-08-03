import type { DocumentCategory } from "@/lib/types";

/**
 * The shared technical-document library: files imported from the Drive folder
 * "Documenti Tecnici", plus anything staff add through that page.
 *
 * Membership needs no schema column. Company-specific files carry a companyId
 * and NDAs carry category "nda", so "no company, not an NDA" already describes
 * the shared library exactly. Pure and shared by the Prisma service and the
 * fixture-backed mock service, so DATA_MODE cannot make the two disagree —
 * the same anti-drift convention as lib/labels.ts and lib/nda-stats.ts.
 */

export const TECHNICAL_CATEGORIES: DocumentCategory[] = [
  "technical_data_sheet",
  "safety_data_sheet",
  "application_guide",
  "certificate",
  "regulatory",
  // Imports whose filename matches no rule land here, so the library must
  // include it or freshly synced files would be invisible.
  "other",
];

export function isTechnicalLibraryDoc(document: {
  companyId?: string | null;
  category: DocumentCategory;
}): boolean {
  if (document.companyId) return false;
  return TECHNICAL_CATEGORIES.includes(document.category);
}

/**
 * Filename rules, most specific first. Italian and English both appear in Drive.
 *
 * Acronyms use an explicit non-alphanumeric boundary rather than `\b`: filenames
 * routinely separate words with underscores, and `_` is a word character, so
 * `\btds\b` never fires on "PROAMINA_TDS_rev4.pdf".
 */
const CATEGORY_RULES: { pattern: RegExp; category: DocumentCategory }[] = [
  { pattern: /sicurezz|safety|(^|[^a-z0-9])m?sds([^a-z0-9]|$)/i, category: "safety_data_sheet" },
  {
    pattern: /scheda[\s_-]*tecnica|data[\s_-]*sheet|(^|[^a-z0-9])tds([^a-z0-9]|$)/i,
    category: "technical_data_sheet",
  },
  { pattern: /guid[ae]|application|applicativ/i, category: "application_guide" },
  { pattern: /certificat/i, category: "certificate" },
  { pattern: /regolament|regulatory|compliance/i, category: "regulatory" },
];

/**
 * Best-effort category for an imported file. Safety sheets are tested before
 * technical ones: "scheda di sicurezza" contains "scheda" but is not a TDS.
 */
export function inferTechnicalCategory(filename: string): DocumentCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(filename)) return rule.category;
  }
  return "other";
}
