-- Email reconciliation registers: company aliases, company domains, suppression.
--
-- Purely additive: three new enum types and three new tables. No existing
-- column is altered or dropped, no index on an existing table is touched, and
-- not one row anywhere is inserted, updated or deleted. The 438 companies in
-- production are untouched and all three tables start empty — every row in them
-- will be written by the Gmail sync (with an audit event) or by a person.
-- This deploys automatically against live data, which is why it is only ever
-- CREATE.
--
-- WHY THESE THREE TABLES
--
-- company_domains."domain" is UNIQUE, and that single constraint is the fix for
-- the bug that paid for this migration: on 2026-08-24 the Gmail sync created
-- FOUR "Pphosted" companies in one day from Proofpoint bounce messages, because
-- a bare prisma.company.create had nothing to collide with. Domains are stored
-- registrable (pphosted.com), never as the per-message bounce host
-- (mx0a-0025e601.pphosted.com), so the collision actually happens. It also
-- makes concurrent syncs safe: two runs racing on one new domain, the loser's
-- INSERT fails and its transaction falls back to a lookup.
--
-- company_aliases is keyed (companyId, normalizedName), NOT normalizedName
-- alone. Two unrelated companies do share a trading name across markets, and a
-- global unique would make the second one unsaveable. The separate plain index
-- on normalizedName serves the cross-company lookup; when it returns more than
-- one row the sync treats the name as ambiguous and links nothing.
--
-- suppressed_entities is its own table rather than a column on leads because
-- reconcileStoredLeadOwnership DELETES and rebuilds every gmail-source lead on
-- each sync run — a flag stored there would be wiped, and the bounce host it
-- suppressed would walk straight back in on the next run. It is also NOT
-- do_not_contact_entries: that suppresses OUTBOUND contact with a company that
-- exists; this suppresses INBOUND interpretation of mail from something that
-- must never become a company at all.
--
-- FK behaviour, matching do_not_contact_entries: "companyId" cascades (once the
-- company is gone its domains and aliases are meaningless), while every
-- "createdById" is SET NULL, so deleting a staff account can never delete a
-- domain mapping or a suppression — the row survives with an unknown author.

-- CreateEnum
CREATE TYPE "CompanyAliasKind" AS ENUM ('legal_name', 'trading_name', 'former_name', 'spelling');

-- CreateEnum
CREATE TYPE "CompanyDomainSource" AS ENUM ('import', 'gmail_sync', 'manual', 'reconciliation');

-- CreateEnum
CREATE TYPE "SuppressedEntityKind" AS ENUM ('domain', 'email', 'name');

-- CreateTable
CREATE TABLE "company_aliases" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "kind" "CompanyAliasKind" NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_domains" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "source" "CompanyDomainSource" NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppressed_entities" (
    "id" TEXT NOT NULL,
    "kind" "SuppressedEntityKind" NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppressed_entities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_aliases_normalizedName_idx" ON "company_aliases"("normalizedName");

-- CreateIndex
CREATE INDEX "company_aliases_companyId_idx" ON "company_aliases"("companyId");

-- CreateIndex
CREATE INDEX "company_aliases_createdById_idx" ON "company_aliases"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "company_aliases_companyId_normalizedName_key" ON "company_aliases"("companyId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "company_domains_domain_key" ON "company_domains"("domain");

-- CreateIndex
CREATE INDEX "company_domains_companyId_idx" ON "company_domains"("companyId");

-- CreateIndex
CREATE INDEX "company_domains_createdById_idx" ON "company_domains"("createdById");

-- CreateIndex
CREATE INDEX "suppressed_entities_kind_idx" ON "suppressed_entities"("kind");

-- CreateIndex
CREATE INDEX "suppressed_entities_createdById_idx" ON "suppressed_entities"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "suppressed_entities_kind_normalizedValue_key" ON "suppressed_entities"("kind", "normalizedValue");

-- AddForeignKey
ALTER TABLE "company_aliases" ADD CONSTRAINT "company_aliases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_aliases" ADD CONSTRAINT "company_aliases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_domains" ADD CONSTRAINT "company_domains_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_domains" ADD CONSTRAINT "company_domains_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppressed_entities" ADD CONSTRAINT "suppressed_entities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
