import type { FollowUp as PrismaFollowUp, Company } from "@/lib/generated/prisma/client";
import {
  isFollowUpSource,
  isFollowUpStatus,
  normalizeFollowUpName,
  parseDateKey,
  toDateKey,
} from "@/lib/follow-ups";
import type { FollowUp } from "@/lib/types";

// Prisma row <-> FollowUp DTO.
//
// The only subtlety is `followUpOn`: it is a DATE column, so Prisma hands back
// a Date pinned to UTC midnight. Sending it to the client as a full ISO string
// would let a browser west of UTC render "10 October" for a freeze that lifts
// on the 11th, so it crosses the wire as a bare `YYYY-MM-DD` and is parsed back
// the same way. See the date section of lib/follow-ups.ts.

/** The company columns the list query joins in, when there is a company at all. */
export type FollowUpCompanyJoin = Pick<Company, "countryCode" | "logoUpdatedAt"> | null;

const undef = <T>(value: T | null): T | undefined => value ?? undefined;

export function followUpToDTO(
  row: PrismaFollowUp & { company?: FollowUpCompanyJoin },
): FollowUp {
  return {
    id: row.id,
    companyId: undef(row.companyId),
    companyName: row.companyName,
    domain: undef(row.domain),
    status: row.status,
    source: row.source,
    followUpOn: toDateKey(row.followUpOn) || undefined,
    reason: undef(row.reason),
    notes: undef(row.notes),
    lastContactAt: row.lastContactAt?.toISOString(),
    quietDays: undef(row.quietDays),
    countryCode: undef(row.company?.countryCode ?? null),
    logoUpdatedAt: row.company?.logoUpdatedAt?.toISOString(),
    statusChangedAt: row.statusChangedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** What the add/edit sheet sends. Every field is a string, as typed. */
export interface FollowUpFormInput {
  companyId?: string | null;
  companyName: string;
  domain?: string | null;
  status?: unknown;
  source?: unknown;
  /** `YYYY-MM-DD` or empty. */
  followUpOn?: string | null;
  reason?: string | null;
  notes?: string | null;
}

const trimmed = (value: string | null | undefined): string | null => {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : null;
};

/**
 * Form input -> Prisma write payload, shared by create and update.
 *
 * An unparseable date becomes null rather than throwing: the field is optional,
 * and a typo must not cost the user the rest of what they typed.
 */
export function followUpWriteData(input: FollowUpFormInput) {
  const companyName = (input.companyName ?? "").trim();
  const followUpOn = parseDateKey(trimmed(input.followUpOn) ?? undefined);
  return {
    companyId: trimmed(input.companyId),
    companyName,
    normalizedName: normalizeFollowUpName(companyName),
    domain: trimmed(input.domain)?.toLowerCase() ?? null,
    status: isFollowUpStatus(input.status) ? input.status : ("pending" as const),
    source: isFollowUpSource(input.source) ? input.source : ("manual" as const),
    followUpOn,
    reason: trimmed(input.reason),
    notes: trimmed(input.notes),
  };
}
