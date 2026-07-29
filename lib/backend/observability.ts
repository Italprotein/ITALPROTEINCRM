/*
 * Error capture.
 *
 * Self-hosted deployments have no platform dashboard, so an unhandled error that
 * only reaches the void is an error you learn about from a client phone call.
 * Everything here writes a single-line JSON record to stdout, which Docker
 * captures — `docker compose logs app | grep '"level":"error"'` is then a real
 * incident tool, and any log shipper can parse it unchanged.
 *
 * Adding a hosted APM later is a one-line change: see forwardToSentry() below.
 */

export interface ErrorContext {
  /** Where it happened, e.g. "POST /api/documents/upload". */
  source?: string;
  /** Never put secrets, tokens or client PII in here. */
  extra?: Record<string, string | number | boolean | null | undefined>;
}

function serialiseError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "NonError", message: String(error) };
}

/**
 * Records a handled or unhandled error. Never throws — an observability failure
 * must not become the user's failure.
 */
export function captureError(error: unknown, context: ErrorContext = {}): void {
  try {
    const { name, message, stack } = serialiseError(error);
    // console.error (not process.stderr) so this file stays safe to import from
    // Edge and client bundles, where `process` is not a Node object. In the
    // Node runtime it still writes to stderr, which is what Docker captures.
    console.error(
      JSON.stringify({
        level: "error",
        at: new Date().toISOString(),
        source: context.source ?? "unknown",
        name,
        message,
        stack,
        ...context.extra,
      }),
    );
    forwardToSentry(error, context);
  } catch {
    // Deliberately silent.
  }
}

/**
 * Hook for a hosted error tracker. To enable Sentry:
 *   1. npm install @sentry/nextjs
 *   2. set SENTRY_DSN in .env.production
 *   3. call Sentry.captureException(error, { extra: context.extra }) here
 * Left as a no-op so the app ships with zero external dependencies by default.
 */
function forwardToSentry(_error: unknown, _context: ErrorContext): void {
  // no-op until a DSN is configured
}
