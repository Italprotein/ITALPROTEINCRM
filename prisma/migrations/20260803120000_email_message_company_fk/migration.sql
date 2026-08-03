-- EmailMessage.companyId carried an index but no foreign key, so nothing
-- stopped it referencing a deleted company. Production held two such orphans,
-- both from companies the Gmail sync auto-created and that were later removed.
--
-- Clear any remaining orphans first, or the constraint cannot be added. This is
-- the same correction already applied by hand on 2026-08-03; it is written here
-- so the migration is self-contained and safe on any other database.
UPDATE "email_messages" e
SET "companyId" = NULL
WHERE e."companyId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "companies" c WHERE c."id" = e."companyId");

-- SetNull, matching the existing lead relation: losing a company must not
-- delete the correspondence that referenced it.
ALTER TABLE "email_messages"
  ADD CONSTRAINT "email_messages_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
