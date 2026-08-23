-- Do Not Contact register.
--
-- A hand-maintained list of companies nobody may contact, plus the reason.
-- Purely additive: one new enum type and one new table. No existing column is
-- altered or dropped, and no row anywhere is inserted, updated or deleted — the
-- 438 companies already in production are untouched, and the register starts
-- empty because every entry is a deliberate human decision.
--
-- "companyId" is UNIQUE on purpose. A company is either suppressed or it is
-- not; two rows could carry two different reasons and let the badge on the
-- company record disagree with the list. The application upserts on this key,
-- so re-adding an already-listed company updates it (see lib/do-not-contact.ts).
--
-- FK behaviour: companyId cascades — once the company row is gone there is
-- nobody left to protect. addedById is SET NULL, so deleting a staff account
-- can never delete a suppression; the entry survives with an unknown author.

-- CreateEnum
CREATE TYPE "DoNotContactReason" AS ENUM ('opt_out', 'not_interested', 'gdpr_request', 'competitor', 'bounced', 'complaint', 'not_relevant', 'other');

-- CreateTable
CREATE TABLE "do_not_contact_entries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reason" "DoNotContactReason" NOT NULL,
    "notes" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "do_not_contact_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "do_not_contact_entries_companyId_key" ON "do_not_contact_entries"("companyId");

-- CreateIndex
CREATE INDEX "do_not_contact_entries_reason_idx" ON "do_not_contact_entries"("reason");

-- CreateIndex
CREATE INDEX "do_not_contact_entries_addedById_idx" ON "do_not_contact_entries"("addedById");

-- AddForeignKey
ALTER TABLE "do_not_contact_entries" ADD CONSTRAINT "do_not_contact_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "do_not_contact_entries" ADD CONSTRAINT "do_not_contact_entries_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
