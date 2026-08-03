import { describe, expect, it } from "vitest";
import { z } from "zod";

import { classifyAiFailure } from "@/lib/ai/ai-failure";

/** Shaped like an OpenAI SDK APIError, which is what the Groq client throws. */
function apiError(status: number, message: string, headers?: Record<string, string>) {
  return Object.assign(new Error(message), { status, headers });
}

describe("AI failure classification", () => {
  it("reads a spent provider quota as its own kind, not a connection fault", () => {
    const failure = classifyAiFailure(apiError(429, "Rate limit reached for model"));

    expect(failure.kind).toBe("quota_exhausted");
  });

  it("carries the provider's retry-after so the UI can say when to come back", () => {
    const failure = classifyAiFailure(
      apiError(429, "Rate limit reached", { "retry-after": "7200" }),
    );

    expect(failure.kind).toBe("quota_exhausted");
    expect(failure.retryAfterSeconds).toBe(7200);
  });

  it("treats a rejected key as a configuration fault, not an outage", () => {
    expect(classifyAiFailure(apiError(401, "Invalid API Key")).kind).toBe("provider_refused");
    expect(classifyAiFailure(apiError(403, "Forbidden")).kind).toBe("provider_refused");
  });

  it("treats provider 5xx and bare network errors as an outage", () => {
    expect(classifyAiFailure(apiError(503, "Service Unavailable")).kind).toBe("provider_down");
    expect(classifyAiFailure(new Error("fetch failed")).kind).toBe("provider_down");
  });

  it("separates unusable model output from provider faults", () => {
    expect(classifyAiFailure(new Error("EMPTY_AI_TASKS")).kind).toBe("invalid_output");

    let syntax: unknown;
    try {
      JSON.parse("not json");
    } catch (error) {
      syntax = error;
    }
    expect(classifyAiFailure(syntax).kind).toBe("invalid_output");

    const zod = z.object({ tasks: z.array(z.string()) }).safeParse({ tasks: 5 });
    expect(zod.success).toBe(false);
    if (!zod.success) expect(classifyAiFailure(zod.error).kind).toBe("invalid_output");
  });

  it("always keeps the original message for the server log", () => {
    expect(classifyAiFailure(apiError(429, "Rate limit reached for model")).detail).toContain(
      "Rate limit reached",
    );
  });
});
