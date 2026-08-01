import { describe, expect, it } from "vitest";

import { ndaFunnelCounts, ndaStatusTallies } from "@/lib/nda-stats";

describe("NDA status tallies", () => {
  it("counts one entry per company across the lifecycle buckets", () => {
    const tallies = ndaStatusTallies([
      "fully_signed",
      "fully_signed",
      "sent",
      "under_review",
      "to_prepare",
      "draft",
    ]);

    expect(tallies.total).toBe(6);
    expect(tallies.signed).toBe(2);
    expect(tallies.awaitingSignature).toBe(2);
    expect(tallies.toPrepare).toBe(2);
    expect(tallies.byStatus.fully_signed).toBe(2);
  });

  it("ignores companies that need no NDA", () => {
    const tallies = ndaStatusTallies(["not_required", "not_required", "fully_signed"]);

    expect(tallies.total).toBe(1);
    expect(tallies.signed).toBe(1);
    expect(tallies.byStatus.not_required).toBeUndefined();
  });

  it("returns zeroes for an empty register", () => {
    const tallies = ndaStatusTallies([]);

    expect(tallies.total).toBe(0);
    expect(tallies.signed).toBe(0);
    expect(tallies.awaitingSignature).toBe(0);
    expect(tallies.toPrepare).toBe(0);
  });

  it("builds a funnel where every signed NDA also counts as sent and prepared", () => {
    expect(ndaFunnelCounts(["fully_signed", "sent", "to_prepare", "not_required"])).toEqual({
      prepared: 3,
      sent: 2,
      signed: 1,
    });
  });
});
