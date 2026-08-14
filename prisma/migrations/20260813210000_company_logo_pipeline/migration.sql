-- Provenance for the company logo pipeline.
--
-- `logoUrl` already existed but said nothing about where a logo came from or
-- whether anyone had looked at it. The favicon importer needs all three:
--   logoSource    — which provider produced the bytes ('favicon' today)
--   logoVerified  — a human approved this logo; the importer must skip the row
--   logoUpdatedAt — when the bytes last changed; also the ETag and the "has a
--                   logo" flag the list DTO carries in place of the base64 blob
--
-- Purely additive: three nullable/defaulted columns, no existing value changes,
-- no row destroyed.
ALTER TABLE "companies" ADD COLUMN "logoSource" TEXT;
ALTER TABLE "companies" ADD COLUMN "logoVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN "logoUpdatedAt" TIMESTAMP(3);

-- Nothing writes logoUrl today, so this is expected to touch zero rows. It is
-- here so the migration is correct rather than merely lucky: the UI decides
-- "this company has a logo" from logoUpdatedAt, and a pre-existing hand-set
-- logoUrl with a NULL timestamp would render as initials and never be served.
UPDATE "companies"
SET "logoUpdatedAt" = "updatedAt", "logoSource" = 'manual', "logoVerified" = true
WHERE "logoUrl" IS NOT NULL AND "logoUpdatedAt" IS NULL;
