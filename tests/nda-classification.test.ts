import { describe, expect, it } from "vitest";

import { isItalproteinNdaDocumentName } from "@/lib/backend/nda-classification";

describe("ITALPROTEIN NDA document classification", () => {
  it.each([
    "ITALPROTEIN NDA.pdf",
    "nda_italprotein_signed.docx",
    "ITAL PROTEIN - N.D.A.pdf",
    "Client-NDA-for-ItalProtein.odt",
  ])("matches both required tokens in %s", (filename) => {
    expect(isItalproteinNdaDocumentName(filename)).toBe(true);
  });

  it.each([
    "Acme NDA.pdf",
    "ITALPROTEIN price list.pdf",
    "financial-data.xlsx",
    "ital proteins agreement.pdf",
  ])("rejects incomplete or unrelated names in %s", (filename) => {
    expect(isItalproteinNdaDocumentName(filename)).toBe(false);
  });
});
