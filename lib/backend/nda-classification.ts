/**
 * A document is eligible for automatic NDA filing only when its name contains
 * both ITALPROTEIN and NDA. Separators and casing do not matter.
 *
 * This classifier deliberately does not infer signature status. A filename is
 * untrusted metadata; only a staff review may unlock post-NDA documents.
 */
export function isItalproteinNdaDocumentName(filename: string): boolean {
  const normalized = filename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();

  return normalized.includes("italprotein") && normalized.includes("nda");
}
