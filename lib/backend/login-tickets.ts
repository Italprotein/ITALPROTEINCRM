import { createHmac, timingSafeEqual } from "node:crypto";

type TicketPurpose = "mfa_challenge" | "login" | "trusted_device";
type TicketPayload = {
  purpose: TicketPurpose;
  userId: string;
  workspace: "internal" | "external";
  authVersion: number;
  userAgentHash?: string;
  exp: number;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not configured");
  return value;
}

export function userAgentHash(userAgent: string) {
  return createHmac("sha256", secret()).update(userAgent).digest("base64url");
}

export function issueLoginTicket(
  payload: Omit<TicketPayload, "exp">,
  lifetimeSeconds: number,
) {
  const encoded = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + lifetimeSeconds,
  })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyLoginTicket(token: string, purpose: TicketPurpose): TicketPayload | null {
  const [encoded, supplied] = token.split(".");
  if (!encoded || !supplied) return null;
  const expected = createHmac("sha256", secret()).update(encoded).digest();
  const suppliedBytes = Buffer.from(supplied, "base64url");
  if (expected.length !== suppliedBytes.length || !timingSafeEqual(expected, suppliedBytes)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TicketPayload;
    if (payload.purpose !== purpose || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
