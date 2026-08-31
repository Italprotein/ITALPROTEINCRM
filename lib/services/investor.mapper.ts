import { Prisma } from "@/lib/generated/prisma/client";
import type { Investor as PrismaInvestor } from "@/lib/generated/prisma/client";
import { INVESTOR_STATUSES, normalizeDomain, splitEmails } from "@/lib/investors";
import type { Investor, InvestorStatus } from "@/lib/types";

// Prisma row <-> Investor DTO. `logoUrl` (megabytes of base64 across 562 rows)
// deliberately never travels in the DTO — the client gets `logoUpdatedAt` and
// fetches bytes from /api/investors/[id]/logo, same as companies.

export function investorToDTO(row: PrismaInvestor): Investor {
  return {
    id: row.id,
    name: row.name,
    status: row.status as InvestorStatus,
    emails: row.emails,
    country: row.country ?? undefined,
    city: row.city ?? undefined,
    domain: row.domain ?? undefined,
    firstContactAt: row.firstContactAt?.toISOString(),
    lastContactAt: row.lastContactAt?.toISOString(),
    responseType: row.responseType ?? undefined,
    nextStep: row.nextStep ?? undefined,
    gmailUrl: row.gmailUrl ?? undefined,
    notes: row.notes ?? undefined,
    logoUpdatedAt: row.logoUpdatedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** What the create/edit form may submit. Everything optional except the name. */
export interface InvestorFormInput {
  name: string;
  status?: string;
  /** Either a ready array or the form's raw "a@x; b@y" string. */
  emails?: string[] | string;
  country?: string | null;
  city?: string | null;
  domain?: string | null;
  firstContactAt?: string | null;
  lastContactAt?: string | null;
  responseType?: string | null;
  nextStep?: string | null;
  gmailUrl?: string | null;
  notes?: string | null;
}

const toStatus = (value: unknown): InvestorStatus =>
  INVESTOR_STATUSES.includes(value as InvestorStatus)
    ? (value as InvestorStatus)
    : "first_contact";

const trimOrNull = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

const dateOrNull = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

/** Form input -> Prisma write payload (shared by create and update). */
export function investorWriteData(input: InvestorFormInput) {
  const emails = Array.isArray(input.emails)
    ? splitEmails(input.emails.join(";"))
    : splitEmails(input.emails);
  return {
    name: input.name.trim(),
    status: toStatus(input.status),
    emails,
    country: trimOrNull(input.country),
    city: trimOrNull(input.city),
    domain: normalizeDomain(input.domain ?? undefined) ?? null,
    firstContactAt: dateOrNull(input.firstContactAt),
    lastContactAt: dateOrNull(input.lastContactAt),
    responseType: trimOrNull(input.responseType),
    nextStep: trimOrNull(input.nextStep),
    gmailUrl: trimOrNull(input.gmailUrl),
    notes: trimOrNull(input.notes),
  } satisfies Prisma.InvestorUncheckedUpdateInput;
}
