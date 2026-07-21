/**
 * Production must never fall back to fixture/localStorage demo data because a
 * public environment variable is missing or misspelled. Demo mode is available
 * only in development; every production build uses the real guarded services.
 */
export const isApiMode =
  process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_DATA_MODE === "api";
