/**
 * Shape and threshold for the follow-up list. A plain module, not the
 * `"use server"` one beside it: a server-action file may only export async
 * functions, so the constant and the type live here.
 */

/** Days of silence before a conversation counts as stalled. */
export const FOLLOW_UP_AFTER_DAYS = 10;

export interface FollowUpCandidate {
  companyId: string;
  companyName: string;
  countryCode: string;
  /** Days since the last message in either direction. */
  quietDays: number;
  /** How many times they have written to us. */
  inboundCount: number;
  /** Subject of their most recent reply — the thread to pick back up. */
  lastInboundSubject: string | null;
  lastInboundAt: string;
}
