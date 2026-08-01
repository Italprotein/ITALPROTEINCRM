/**
 * ITALPROTEIN NDA detection. Pure string logic — no Prisma — so the whole
 * rule is unit-testable (tests/nda-classification.test.ts).
 *
 * A document qualifies for automatic NDA filing only when its NAME carries
 * both the ITALPROTEIN token and an NDA token. The email body is deliberately
 * ignored: every message in an Italprotein thread mentions "Italprotein"
 * somewhere (signature, footer, address), so body text adds zero signal and
 * only widens the match. The subject may corroborate an NDA-named file whose
 * name lacks the company token.
 *
 * This classifier never infers signature status. A filename is untrusted
 * metadata; only a staff review may mark an NDA signed.
 */

/** NFKD → strip diacritics → uppercase → every non-alphanumeric run becomes one space. */
export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

// "ITALPROTEIN", "Ital-Protein", "ITAL_PROTEIN", "Italprotéin" — but not "ital proteins".
const ITALPROTEIN_TOKEN = /\bITAL ?PROTEIN\b/;
// "NDA", "N.D.A.", "non-disclosure", "accordo di riservatezza" — but not "agenda" or "standard".
const NDA_TOKEN = /\bN ?D ?A\b|\bNON ?DISCLOSURE\b|\bACCORDO DI RISERVATEZZA\b|\bRISERVATEZZA\b/;

export function textMentionsItalprotein(value: string): boolean {
  return ITALPROTEIN_TOKEN.test(normalizeForMatch(value));
}

export function textMentionsNda(value: string): boolean {
  return NDA_TOKEN.test(normalizeForMatch(value));
}

export function isItalproteinNdaDocumentName(filename: string): boolean {
  const normalized = normalizeForMatch(filename);
  return ITALPROTEIN_TOKEN.test(normalized) && NDA_TOKEN.test(normalized);
}

/**
 * File types an NDA can plausibly arrive as. `p7m` covers CAdES-signed Italian
 * documents, including the `*.pdf.p7m` double extension (the last dot segment
 * is `p7m` either way).
 */
const NDA_ELIGIBLE_EXTENSIONS = new Set(["pdf", "doc", "docx", "rtf", "odt", "p7m"]);

export function fileExtensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function isNdaEligibleFileName(filename: string): boolean {
  return NDA_ELIGIBLE_EXTENSIONS.has(fileExtensionOf(filename));
}

export type NdaMatchConfidence = "high" | "medium";

export interface NdaAttachmentMatch<T extends { filename: string }> {
  attachment: T;
  confidence: NdaMatchConfidence;
}

/**
 * Select EVERY attachment that should be auto-filed as an ITALPROTEIN NDA.
 *
 * - high:   the filename itself names both ITALPROTEIN and NDA.
 * - medium: the filename names only NDA, and the subject supplies the
 *           ITALPROTEIN token (tie-breaker; still filed as under_review).
 */
export function pickNdaAttachments<T extends { filename: string }>(
  attachments: T[],
  subject: string,
): NdaAttachmentMatch<T>[] {
  const subjectHasItalprotein = textMentionsItalprotein(subject);
  const matches: NdaAttachmentMatch<T>[] = [];
  for (const attachment of attachments) {
    if (!isNdaEligibleFileName(attachment.filename)) continue;
    if (isItalproteinNdaDocumentName(attachment.filename)) {
      matches.push({ attachment, confidence: "high" });
    } else if (subjectHasItalprotein && textMentionsNda(attachment.filename)) {
      matches.push({ attachment, confidence: "medium" });
    }
  }
  return matches;
}
