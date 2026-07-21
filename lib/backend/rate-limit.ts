import { prisma } from "./prisma";

// DB-backed fixed-window rate limiter. Works on serverless (no shared memory
// needed) and fails CLOSED: if the counter cannot be read/written the caller
// is treated as over the limit. Used for login, password reset, mail send and
// Gmail sync — the app-level complement to platform DDoS protection.

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const entry = await prisma.rateLimitEntry.upsert({
        where: { key_windowStart: { key, windowStart } },
        create: { key, windowStart, count: 1 },
        update: { count: { increment: 1 } },
      });

      // Opportunistic cleanup of stale windows so the table stays small.
      if (Math.random() < 0.02) {
        prisma.rateLimitEntry
          .deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } })
          .catch(() => undefined);
      }

      const ok = entry.count <= limit;
      return {
        ok,
        remaining: Math.max(0, limit - entry.count),
        retryAfterSeconds: ok ? 0 : Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000),
      };
    } catch {
      // A concurrent create can race the upsert (P2002); retry once, then fail closed.
    }
  }
  return { ok: false, remaining: 0, retryAfterSeconds: windowSeconds };
}

/**
 * Read the current window WITHOUT consuming quota. Use this to gate an attempt
 * before you know whether it will fail, then call checkRateLimit() only on the
 * failure path — so a successful login never spends quota and an admin cannot
 * lock themselves out by signing in normally. Fails CLOSED like checkRateLimit.
 */
export async function peekRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  try {
    const entry = await prisma.rateLimitEntry.findUnique({
      where: { key_windowStart: { key, windowStart } },
    });
    const count = entry?.count ?? 0;
    const ok = count < limit;
    return {
      ok,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: ok ? 0 : Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000),
    };
  } catch {
    return { ok: false, remaining: 0, retryAfterSeconds: windowSeconds };
  }
}

/** Clear a counter across all windows (e.g. on a successful login). Best effort. */
export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimitEntry.deleteMany({ where: { key } }).catch(() => undefined);
}

/** Best-effort client IP from proxy headers (Vercel/Netlify set x-forwarded-for). */
export function clientIpFromHeaders(headers: Pick<Headers, "get"> | null | undefined): string {
  const forwarded = headers?.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers?.get("x-real-ip")?.trim() || "unknown";
}
