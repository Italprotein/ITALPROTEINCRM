import { describe, expect, it } from "vitest";

import { inferTechnicalCategory, isTechnicalLibraryDoc } from "@/lib/technical-docs";

describe("technical document category inference", () => {
  it("recognises technical data sheets in both languages", () => {
    expect(inferTechnicalCategory("Proamina scheda tecnica 2026.pdf")).toBe("technical_data_sheet");
    expect(inferTechnicalCategory("Proamina Technical Data Sheet.pdf")).toBe("technical_data_sheet");
    expect(inferTechnicalCategory("PROAMINA_TDS_rev4.pdf")).toBe("technical_data_sheet");
  });

  it("reads a safety sheet as safety, not technical, despite the shared word", () => {
    // "scheda di sicurezza" contains "scheda" — the safety rule must win.
    expect(inferTechnicalCategory("Scheda di sicurezza Proamina.pdf")).toBe("safety_data_sheet");
    expect(inferTechnicalCategory("Safety Data Sheet EN.pdf")).toBe("safety_data_sheet");
    expect(inferTechnicalCategory("proamina-msds.pdf")).toBe("safety_data_sheet");
  });

  it("recognises the remaining categories", () => {
    expect(inferTechnicalCategory("Guida applicativa gelato.docx")).toBe("application_guide");
    expect(inferTechnicalCategory("Certificato ISO 22000.pdf")).toBe("certificate");
    expect(inferTechnicalCategory("Regulatory dossier EU.pdf")).toBe("regulatory");
  });

  it("falls back to other rather than guessing", () => {
    expect(inferTechnicalCategory("scan_00412.pdf")).toBe("other");
    expect(inferTechnicalCategory("")).toBe("other");
  });
});

describe("technical library membership", () => {
  it("includes shared documents in the technical categories", () => {
    expect(isTechnicalLibraryDoc({ category: "technical_data_sheet" })).toBe(true);
    expect(isTechnicalLibraryDoc({ companyId: null, category: "safety_data_sheet" })).toBe(true);
    // Freshly imported files with an unrecognised name must still appear.
    expect(isTechnicalLibraryDoc({ companyId: null, category: "other" })).toBe(true);
  });

  it("excludes anything belonging to one company", () => {
    expect(isTechnicalLibraryDoc({ companyId: "c_redbull", category: "technical_data_sheet" }))
      .toBe(false);
  });

  it("excludes NDAs, which have their own register", () => {
    expect(isTechnicalLibraryDoc({ companyId: null, category: "nda" })).toBe(false);
  });

  it("excludes marketing and photo assets", () => {
    expect(isTechnicalLibraryDoc({ companyId: null, category: "marketing" })).toBe(false);
    expect(isTechnicalLibraryDoc({ companyId: null, category: "photo" })).toBe(false);
  });
});
