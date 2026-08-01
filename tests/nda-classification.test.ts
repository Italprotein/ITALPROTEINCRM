import { describe, expect, it } from "vitest";

import {
  isItalproteinNdaDocumentName,
  isNdaEligibleFileName,
  pickNdaAttachments,
  textMentionsItalprotein,
  textMentionsNda,
} from "@/lib/backend/nda-classification";

describe("ITALPROTEIN NDA document classification", () => {
  it.each([
    "ITALPROTEIN NDA.pdf",
    "nda_italprotein_signed.docx",
    "ITAL PROTEIN - N.D.A.pdf",
    "Client-NDA-for-ItalProtein.odt",
    "Italprotéin NDA.docx",
    "NDA_ITALPROTEIN_countersigned.pdf.p7m",
    "Accordo di riservatezza Italprotein.pdf",
  ])("matches both required tokens in %s", (filename) => {
    expect(isItalproteinNdaDocumentName(filename)).toBe(true);
  });

  it.each([
    "Acme NDA.pdf",
    "ITALPROTEIN price list.pdf",
    "financial-data.xlsx",
    "ital proteins agreement.pdf",
    // "agenda" contains the letters n-d-a but is not an NDA token.
    "Italprotein agenda.pdf",
    "Italprotein standard terms.pdf",
  ])("rejects incomplete or unrelated names in %s", (filename) => {
    expect(isItalproteinNdaDocumentName(filename)).toBe(false);
  });

  it("never treats body-style text mentions as a company match on filenames alone", () => {
    expect(textMentionsItalprotein("Re: Italprotein — draft agreement")).toBe(true);
    expect(textMentionsItalprotein("Quarterly protein market report")).toBe(false);
    expect(textMentionsNda("NDA to sign")).toBe(true);
    expect(textMentionsNda("Agenda for Monday")).toBe(false);
  });
});

describe("NDA attachment picking", () => {
  const meta = (filename: string) => ({ filename });

  it("returns every high-confidence match, not only the first", () => {
    const picked = pickNdaAttachments(
      [meta("ITALPROTEIN NDA v1.pdf"), meta("photo.png"), meta("Italprotein NDA v2.docx")],
      "Documents",
    );
    expect(picked.map((p) => p.attachment.filename)).toEqual([
      "ITALPROTEIN NDA v1.pdf",
      "Italprotein NDA v2.docx",
    ]);
    expect(picked.every((p) => p.confidence === "high")).toBe(true);
  });

  it("uses the subject only as a tie-breaker for NDA-named files", () => {
    const attachments = [meta("NDA draft.pdf")];
    expect(pickNdaAttachments(attachments, "Italprotein partnership")).toEqual([
      { attachment: attachments[0], confidence: "medium" },
    ]);
    // Without the company token in the subject, an NDA-only name stays unfiled.
    expect(pickNdaAttachments(attachments, "Partnership documents")).toEqual([]);
    // A subject mention alone never drags in a non-NDA-named file.
    expect(pickNdaAttachments([meta("brochure.pdf")], "Italprotein NDA attached")).toEqual([]);
  });

  it("accepts CAdES signatures and rejects non-document types", () => {
    expect(isNdaEligibleFileName("nda.pdf.p7m")).toBe(true);
    expect(isNdaEligibleFileName("nda.p7m")).toBe(true);
    expect(isNdaEligibleFileName("nda.zip")).toBe(false);
    expect(isNdaEligibleFileName("nda.xlsx")).toBe(false);
  });
});
