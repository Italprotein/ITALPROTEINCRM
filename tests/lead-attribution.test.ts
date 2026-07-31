import { describe, expect, it } from "vitest";

import {
  currentIncomingMessageText,
  firstMentionedLeadMember,
  type LeadMemberIdentity,
} from "@/lib/backend/lead-attribution";

const members: LeadMemberIdentity[] = [
  { id: "amine", fullName: "Amine Labid", firstName: "Amine" },
  { id: "matteo", fullName: "Matteo Pittarello", firstName: "Matteo" },
  { id: "lucio", fullName: "Lucio Becker", firstName: "Lucio" },
];

describe("Gmail lead attribution", () => {
  it("assigns the lead to the member whose name appears first", () => {
    expect(
      firstMentionedLeadMember("Hello Matteo and Amine, thanks for the samples.", members)?.id,
    ).toBe("matteo");
  });

  it("finds a name outside a formal greeting", () => {
    expect(
      firstMentionedLeadMember("Thanks for your help. Lucio, could you send the price list?", members)?.id,
    ).toBe("lucio");
  });

  it("does not attribute from an older quoted reply", () => {
    const body = [
      "Thank you, we will review it.",
      "",
      "On Tue, 30 Jul 2026 at 10:00, Sales wrote:",
      "> Dear Amine,",
    ].join("\n");
    expect(currentIncomingMessageText(body)).toBe("Thank you, we will review it.");
    expect(firstMentionedLeadMember(body, members)).toBeNull();
  });

  it("requires a full name when two active members share a first name", () => {
    const duplicate = [
      ...members,
      { id: "matteo-2", fullName: "Matteo Rossi", firstName: "Matteo" },
    ];
    expect(firstMentionedLeadMember("Hello Matteo,", duplicate)).toBeNull();
    expect(firstMentionedLeadMember("Hello Matteo Pittarello,", duplicate)?.id).toBe("matteo");
  });

  it("matches whole names rather than substrings", () => {
    expect(firstMentionedLeadMember("The laminate samples arrived.", members)).toBeNull();
  });
});
