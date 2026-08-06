/**
 * ITALPROTEIN NDA detection. Pure string logic — no Prisma — so the whole
 * rule is unit-testable (tests/nda-classification.test.ts).
 *
 * Gmail filing is intentionally filename-only: an eligible document must carry
 * the standalone wording "NDA" in its NAME. Email subjects and bodies are
 * ignored because signatures, quoted history and ordinary discussion widen the
 * match without proving that a particular attachment is an NDA.
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
// Gmail auto-filing follows the narrower business rule: the filename itself
// must contain the wording NDA (separator variants such as N.D.A. are fine).
const NDA_WORDING_TOKEN = /\bN ?D ?A\b/;

export function textMentionsItalprotein(value: string): boolean {
  return ITALPROTEIN_TOKEN.test(normalizeForMatch(value));
}

export function textMentionsNda(value: string): boolean {
  return NDA_TOKEN.test(normalizeForMatch(value));
}

export function textContainsNdaWording(value: string): boolean {
  return NDA_WORDING_TOKEN.test(normalizeForMatch(value));
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
 * Select EVERY attachment that should be auto-filed from a company email
 * thread. Only the filename supplies classification evidence.
 *
 * - high:   the filename names both ITALPROTEIN and NDA.
 * - medium: the filename contains the standalone NDA wording.
 */
export function pickNdaAttachments<T extends { filename: string }>(
  attachments: T[],
  _subject: string,
): NdaAttachmentMatch<T>[] {
  const matches: NdaAttachmentMatch<T>[] = [];
  for (const attachment of attachments) {
    if (!isNdaEligibleFileName(attachment.filename)) continue;
    if (!textContainsNdaWording(attachment.filename)) continue;
    matches.push({
      attachment,
      confidence: textMentionsItalprotein(attachment.filename) ? "high" : "medium",
    });
  }
  return matches;
}
