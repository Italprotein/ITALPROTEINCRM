import { describe, expect, it } from "vitest";

import type { NDA } from "@/lib/types";
import { currentNdasOf, ndaFunnelCounts, ndaStatusTallies } from "@/lib/nda-stats";

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

describe("current register row per company", () => {
  const nda = (id: string, companyId: string, createdAt: string, status: NDA["status"]): NDA => ({
    id,
    reference: id.toUpperCase(),
    companyId,
    type: "mutual",
    status,
    versions: [],
    createdAt,
  });

  it("keeps only the newest row for a company that has several", () => {
    const older = nda("a", "acme", "2026-01-10", "sent");
    const newer = nda("b", "acme", "2026-05-02", "fully_signed");

    expect(currentNdasOf([older, newer])).toEqual([newer]);
  });

  it("picks deterministically when two rows share a creation date", () => {
    const a = nda("a", "acme", "2026-04-01", "sent");
    const b = nda("b", "acme", "2026-04-01", "fully_signed");

    // Same answer regardless of the order the rows arrive in.
    expect(currentNdasOf([a, b])).toEqual(currentNdasOf([b, a]));
  });

  it("counts a company with three register rows once", () => {
    const rows = [
      nda("a", "acme", "2026-01-10", "fully_signed"),
      nda("b", "acme", "2026-03-10", "fully_signed"),
      nda("c", "acme", "2026-05-10", "fully_signed"),
      nda("d", "redbull", "2026-02-01", "fully_signed"),
    ];

    expect(ndaStatusTallies(currentNdasOf(rows).map((n) => n.status)).signed).toBe(2);
  });
});
