import { describe, expect, it } from "vitest";

import {
  SHIPPED_COMPANY_EVIDENCE,
  countUniqueShippedCompanies,
} from "@/lib/data/shipped-company-evidence";

describe("shipped company evidence", () => {
  it("contains one representative Gmail message for each of 30 counterparties", () => {
    expect(SHIPPED_COMPANY_EVIDENCE).toHaveLength(30);
    expect(new Set(SHIPPED_COMPANY_EVIDENCE.map((entry) => entry.companyKey)).size).toBe(30);
    expect(new Set(SHIPPED_COMPANY_EVIDENCE.map((entry) => entry.gmailMessageId)).size).toBe(30);
  });

  it("does not double-count a persisted company already present in the evidence", () => {
    expect(countUniqueShippedCompanies(["Venchi", "NÖM", "Casillo Next Gen Food Srl"])).toBe(30);
  });

  it("adds a newly persisted shipment counterparty", () => {
    expect(countUniqueShippedCompanies(["New Company"])).toBe(31);
  });
});
