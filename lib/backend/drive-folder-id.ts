/**
 * Reading a Drive folder id out of the environment.
 *
 * Pure string logic, deliberately in its own module rather than inside
 * `google-drive.ts`: that file is `server-only`, which does not resolve outside
 * the Next bundler, so the rule would be untestable there. `google-drive.ts`
 * re-exports this, so callers still import it from the Drive module.
 *
 * Two shapes of "set but meaningless" have both reached production:
 *
 *   GOOGLE_DRIVE_INDUSTRIAL_CLIENTS_FOLDER_ID=""            (compose default)
 *   GOOGLE_DRIVE_TECHNICAL_FOLDER_ID=<1abc…>                (template placeholder)
 *
 * `??` does not catch the first and nothing caught the second, so the sync
 * queried Drive for `'' in parents` and got back a bare 404 — an error that says
 * nothing about the folder id being the problem. Deciding what "configured"
 * means happens here, once, instead of at each call site.
 */
// Overloaded so a caller that supplies a fallback gets a plain `string` back and
// needs no non-null assertion to prove the obvious.
export function driveFolderId(value: string | undefined, fallback: string): string;
export function driveFolderId(value: string | undefined, fallback?: string): string | undefined;
export function driveFolderId(value: string | undefined, fallback?: string): string | undefined {
  const trimmed = (value ?? "").trim();
  // One pair only: an id that merely contains a bracket is left alone, and
  // "<<a>>" unwraps to "<a>" rather than silently swallowing both pairs.
  const unwrapped = trimmed.length >= 2 && trimmed.startsWith("<") && trimmed.endsWith(">")
    ? trimmed.slice(1, -1).trim()
    : trimmed;
  return unwrapped || fallback;
}
