import { describe, expect, it } from "vitest";

import { reconcileNdaStatus } from "@/lib/nda-status";

describe("NDA status reconciliation", () => {
  it("keeps a staff-verified signature over an auto-filed review status", () => {
    expect(reconcileNdaStatus("fully_signed", "under_review")).toBe("fully_signed");
  });

  it("promotes the company when the register is further ahead", () => {
    expect(reconcileNdaStatus("sent", "fully_signed")).toBe("fully_signed");
    expect(reconcileNdaStatus("sent", "under_review")).toBe("under_review");
  });

  it("uses the register when the company cache is empty", () => {
    expect(reconcileNdaStatus(undefined, "under_review")).toBe("under_review");
  });

  it("does not revive a terminal current agreement from a stale company cache", () => {
    expect(reconcileNdaStatus("fully_signed", "expired")).toBe("expired");
  });
});

