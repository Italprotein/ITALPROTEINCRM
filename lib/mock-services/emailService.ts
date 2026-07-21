import { sleep } from '@/lib/utils';
import type {
  EmailMessageRecord,
  GmailConnectionStatus,
  GmailSyncResult,
  OutboundEmailInput,
  SendEmailResult,
} from '@/lib/types';

/**
 * Mock Gmail service — mock mode has no mailbox, so the inbox is empty, sync
 * reports "not connected" and send simulates success. The real (Prisma+Gmail)
 * implementation lives in lib/services/email.ts.
 */
export const emailService = {
  async listInbox(limit = 100): Promise<EmailMessageRecord[]> {
    void limit;
    return [];
  },

  async list(): Promise<EmailMessageRecord[]> {
    return [];
  },

  async sync(): Promise<GmailSyncResult> {
    await sleep(400);
    return {
      ok: false,
      error: 'gmail_not_connected',
      fetched: 0,
      created: 0,
      ndasCreated: 0,
      leadsCreated: 0,
      leadsUpdated: 0,
    };
  },

  async send(input: OutboundEmailInput): Promise<SendEmailResult> {
    void input;
    await sleep(450);
    return { ok: true, providerMessageId: `mock_${Date.now().toString(36)}` };
  },

  async status(): Promise<GmailConnectionStatus> {
    return { connected: false };
  },

  async disconnect(): Promise<void> {},

  reset(): void {},
};

export type EmailService = typeof emailService;
