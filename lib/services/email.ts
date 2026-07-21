import type { EmailService } from "@/lib/mock-services/emailService";
import type { OutboundEmailInput } from "@/lib/types";
import {
  disconnectGmail,
  gmailConnectionStatus,
  listEmailMessages,
  sendAdminEmail,
  syncGmailInbox,
} from "./email.actions";

// Real (Gmail + Prisma-backed) emailService — contract-identical to the mock.
export const emailService: EmailService = {
  listInbox: (limit?: number) => listEmailMessages("inbound", limit),
  list: () => listEmailMessages(),
  sync: () => syncGmailInbox(),
  send: (input: OutboundEmailInput) => sendAdminEmail(input),
  status: () => gmailConnectionStatus(),
  disconnect: () => disconnectGmail(),
  reset: () => {},
};
