import type { EmailMessage as PrismaEmailMessage, Lead as PrismaLead } from "@/lib/generated/prisma/client";
import type { EmailMessageRecord, LeadEntry } from "@/lib/types";

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);

export function emailMessageToDTO(m: PrismaEmailMessage): EmailMessageRecord {
  return {
    id: m.id,
    gmailMessageId: m.gmailMessageId,
    gmailThreadId: m.gmailThreadId,
    direction: m.direction,
    fromAddress: m.fromAddress,
    fromName: undef(m.fromName),
    toAddresses: m.toAddresses,
    ccAddresses: m.ccAddresses,
    subject: undef(m.subject),
    snippet: undef(m.snippet),
    bodyText: undef(m.bodyText),
    internalDate: m.internalDate.toISOString(),
    hasAttachments: m.hasAttachments,
    attachmentNames: m.attachmentNames,
    ndaDetected: m.ndaDetected,
    ndaId: undef(m.ndaId),
    matchedAdminUserId: undef(m.matchedAdminUserId),
    leadId: undef(m.leadId),
    companyId: undef(m.companyId),
    sentByUserId: undef(m.sentByUserId),
    syncedAt: m.syncedAt.toISOString(),
  };
}

export function leadToDTO(l: PrismaLead): LeadEntry {
  return {
    id: l.id,
    companyName: l.companyName,
    adminUserId: l.adminUserId,
    sourceDomain: undef(l.sourceDomain),
    source: l.source,
    emailCount: l.emailCount,
    firstSeenAt: l.firstSeenAt.toISOString(),
    lastSeenAt: l.lastSeenAt.toISOString(),
  };
}
