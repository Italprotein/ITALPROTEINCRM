-- Provenance for the company logo pipeline.
--
-- `logoUrl` already existed but said nothing about where a logo came from or
-- whether anyone had looked at it. The favicon importer needs all three:
--   logoSource    — which provider produced the bytes ('favicon' today)
--   logoVerified  — a human approved this logo; the importer must skip the row
--   logoUpdatedAt — when the bytes last changed; also the ETag and the "has a
--                   logo" flag the list DTO carries in place of the base64 blob
--
-- Purely additive: three nullable/defaulted columns. No existing value is
-- changed, no row is destroyed, and there is deliberately NO backfill.
--
-- An earlier draft backfilled logoUpdatedAt/logoVerified for any row already
-- holding a logoUrl. Nothing in this repo has ever written logoUrl, so that
-- UPDATE was a no-op on real data — but it carried a permanent downside: if the
-- assumption that logoUrl always holds a servable base64 data URI were ever
-- wrong, it would set logoVerified = true on those rows and exclude them from
-- the importer forever, recoverable only by hand-written SQL. A no-op with a
-- permanent downside loses to no statement at all.
--
-- The live behaviour for such a row is safe without it: the importer's
-- candidate filter requires logoUrl IS NULL (see LOGO_IMPORT_CANDIDATE_WHERE in
-- lib/company-logo.ts), so the row is skipped rather than overwritten, and the
-- UI simply shows its initials tile.
ALTER TABLE "companies" ADD COLUMN "logoSource" TEXT;
ALTER TABLE "companies" ADD COLUMN "logoVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN "logoUpdatedAt" TIMESTAMP(3);
