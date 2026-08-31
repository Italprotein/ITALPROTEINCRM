-- Investor outreach register (additive; nothing existing is touched).
-- See model Investor in schema.prisma for why this is its own table and not
-- a Company subtype.

-- CreateEnum
CREATE TYPE "InvestorStatus" AS ENUM ('in_contact', 'to_recontact', 'rejected', 'first_contact');

-- CreateTable
CREATE TABLE "investors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "InvestorStatus" NOT NULL DEFAULT 'first_contact',
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "country" TEXT,
    "city" TEXT,
    "domain" TEXT,
    "firstContactAt" TIMESTAMP(3),
    "lastContactAt" TIMESTAMP(3),
    "responseType" TEXT,
    "nextStep" TEXT,
    "gmailUrl" TEXT,
    "notes" TEXT,
    "logoUrl" TEXT,
    "logoUpdatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "investors_name_key" ON "investors"("name");

-- CreateIndex
CREATE INDEX "investors_status_idx" ON "investors"("status");

-- CreateIndex
CREATE INDEX "investors_country_idx" ON "investors"("country");

-- CreateIndex
CREATE INDEX "investors_domain_idx" ON "investors"("domain");
