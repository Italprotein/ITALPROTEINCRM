/**
 * Tell apart the ways an AI provider call can fail.
 *
 * The inbox-to-task action used to wrap its whole model pass in `catch {}` and
 * return one opaque code, so a spent Groq quota, a dropped connection, a
 * rejected API key and unparseable model output all reached the user as
 * "check your AI and Gmail connections, then retry" — wrong in every case, and
 * actively harmful for a quota, where retrying only spends more of it.
 *
 * Pure and provider-agnostic: it duck-types the OpenAI SDK's APIError (which is
 * what the Groq client throws, since Groq is reached through that SDK) rather
 * than importing it, so it stays unit-testable with no network.
 */

export type AiFailureKind =
  /** Provider accepted the key but the allowance is spent (HTTP 429). */
  | "quota_exhausted"
  /** Provider is unreachable or erroring (HTTP 5xx, DNS, socket). */
  | "provider_down"
  /** Provider rejected us — bad or revoked key, unknown model (other 4xx). */
  | "provider_refused"
  /** Provider replied, but the body was empty, unparseable or off-schema. */
  | "invalid_output";

export interface AiFailure {
  kind: AiFailureKind;
  /** Present for quotas when the provider said when to come back. */
  retryAfterSeconds?: number;
  /** The original message, for the server log — never shown to the user. */
  detail: string;
}

function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

/** `retry-after` is delta-seconds. Headers may be a plain object or a Headers. */
function retryAfterOf(error: unknown): number | undefined {
  const headers = (error as { headers?: unknown } | null)?.headers;
  if (!headers) return undefined;

  const raw =
    typeof (headers as Headers).get === "function"
      ? (headers as Headers).get("retry-after")
      : (headers as Record<string, string>)["retry-after"];

  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : undefined;
}

function isUnusableOutput(error: unknown): boolean {
  if (error instanceof SyntaxError) return true; // JSON.parse
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "ZodError") return true; // schema mismatch
  const message = error instanceof Error ? error.message : "";
  return message.startsWith("EMPTY_AI_");
}

export function classifyAiFailure(error: unknown): AiFailure {
  const detail = error instanceof Error ? error.message : String(error);
  const status = statusOf(error);

  if (status === 429) {
    return { kind: "quota_exhausted", retryAfterSeconds: retryAfterOf(error), detail };
  }
  if (status !== undefined && status >= 500) return { kind: "provider_down", detail };
  if (status !== undefined && status >= 400) return { kind: "provider_refused", detail };
  if (isUnusableOutput(error)) return { kind: "invalid_output", detail };

  // No HTTP status and nothing recognisable: a transport failure (fetch failed,
  // ECONNRESET, abort). Treat as an outage — retrying later is the right advice.
  return { kind: "provider_down", detail };
}
