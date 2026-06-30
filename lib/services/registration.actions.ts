"use server";

import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
import type { Registration, RegistrationStatus } from "@/lib/types";
import { registrationToDTO, registrationWriteData } from "./registration.mapper";

// Registrations are public-intake / admin-review records — they have no companyId,
// so they are NOT company-scoped: internal staff review all of them, and the public
// submit path creates one. No scopeWhere() is needed for this entity.

export async function listRegistrations(): Promise<Registration[]> {
  const rows = await prisma.registration.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(registrationToDTO);
}

export async function getRegistration(id: string): Promise<Registration | undefined> {
  const row = await prisma.registration.findUnique({ where: { id } });
  return row ? registrationToDTO(row) : undefined;
}

export async function createRegistration(input: Registration): Promise<Registration> {
  const user = await getCurrentUser();
  // Public submit: persists a registration record only. Any new-registration
  // notification/email side effect is wired separately.
  // TODO(side-effect): notify internal reviewers of the new registration (email/notification).
  const row = await prisma.registration.create({
    data: {
      ...registrationWriteData(input, user?.id ?? null),
      id: input.id,
      createdById: user?.id ?? null,
    },
  });
  return registrationToDTO(row);
}

export async function updateRegistration(
  id: string,
  patch: Partial<Registration>,
): Promise<Registration | undefined> {
  const user = await getCurrentUser();
  const existing = await prisma.registration.findUnique({ where: { id } });
  if (!existing) return undefined;

  const merged: Registration = { ...registrationToDTO(existing), ...patch };

  // Stamp the decision actor/time when an admin transitions to a terminal status.
  const wasDecided = existing.status === "approved" || existing.status === "rejected";
  const nowDecided = merged.status === "approved" || merged.status === "rejected";
  if (nowDecided && !wasDecided) {
    merged.decidedByUserId = merged.decidedByUserId ?? user?.id ?? undefined;
    merged.decidedAt = merged.decidedAt ?? new Date().toISOString();
  }

  const row = await prisma.registration.update({
    where: { id },
    data: registrationWriteData(merged, user?.id ?? null),
  });

  // Record an audit-style decision row + stub the heavy provisioning side effects.
  if (nowDecided && !wasDecided) {
    await prisma.registrationDecision
      .create({
        data: {
          registrationId: id,
          decision: merged.status === "approved" ? "approve" : "reject",
          reason: merged.adminNote ?? null,
          note: merged.adminNote ?? null,
          decidedByUserId: user?.id ?? row.createdById ?? id,
          decidedAt: new Date(),
          createdById: user?.id ?? null,
        },
      })
      .catch(() => undefined);

    if (merged.status === "approved") {
      // TODO(side-effect): provision the account from this registration —
      //   1) create a Company from the registration's company fields,
      //   2) create the primary Contact + an external owner User,
      //   3) backfill RegistrationDecision.provisioned{Company,Contact,OwnerUser}Id
      //      and Registration.linkedCompanyId,
      //   4) send the approval / account-invite email.
      // Persisted here: the registration status + decision record. The external
      // provisioning + email steps are stubbed until those integrations land.
    } else {
      // TODO(side-effect): send the rejection / more-info email to the contact.
    }
  } else if (merged.status === "more_info_requested" && existing.status !== "more_info_requested") {
    // TODO(side-effect): email the contact requesting the additional information.
  }

  return registrationToDTO(row);
}

export async function removeRegistration(id: string): Promise<void> {
  await prisma.registration.delete({ where: { id } }).catch(() => undefined);
}

export async function registrationsByStatus(
  status: RegistrationStatus,
): Promise<Registration[]> {
  const rows = await prisma.registration.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(registrationToDTO);
}

export async function registrationStatistics() {
  const rows = await prisma.registration.findMany({ select: { status: true } });
  const has = (...st: RegistrationStatus[]) =>
    rows.filter((r) => st.includes(r.status)).length;
  return {
    total: rows.length,
    pending: has("submitted", "email_verification", "pending_approval"),
    moreInfo: has("more_info_requested"),
    approved: has("approved"),
    rejected: has("rejected"),
  };
}
