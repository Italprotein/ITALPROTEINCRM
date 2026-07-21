-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('inbound', 'outbound');

-- AlterEnum
ALTER TYPE "GoogleScope" ADD VALUE 'gmail_readonly';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'password_reset';
ALTER TYPE "NotificationType" ADD VALUE 'manual_email';

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "bytes" BYTEA;

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "subject" TEXT,
    "snippet" TEXT,
    "bodyText" TEXT,
    "internalDate" TIMESTAMP(3) NOT NULL,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "attachmentNames" TEXT[],
    "ndaDetected" BOOLEAN NOT NULL DEFAULT false,
    "ndaId" TEXT,
    "matchedAdminUserId" TEXT,
    "leadId" TEXT,
    "companyId" TEXT,
    "sentByUserId" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "sourceDomain" TEXT,
    "source" TEXT NOT NULL DEFAULT 'gmail',
    "emailCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "requestIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_entries" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_gmailMessageId_key" ON "email_messages"("gmailMessageId");

-- CreateIndex
CREATE INDEX "email_messages_direction_idx" ON "email_messages"("direction");

-- CreateIndex
CREATE INDEX "email_messages_internalDate_idx" ON "email_messages"("internalDate");

-- CreateIndex
CREATE INDEX "email_messages_gmailThreadId_idx" ON "email_messages"("gmailThreadId");

-- CreateIndex
CREATE INDEX "email_messages_matchedAdminUserId_idx" ON "email_messages"("matchedAdminUserId");

-- CreateIndex
CREATE INDEX "email_messages_companyId_idx" ON "email_messages"("companyId");

-- CreateIndex
CREATE INDEX "leads_adminUserId_idx" ON "leads"("adminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_adminUserId_companyName_key" ON "leads"("adminUserId", "companyName");

-- CreateIndex
CREATE INDEX "password_reset_codes_userId_idx" ON "password_reset_codes"("userId");

-- CreateIndex
CREATE INDEX "password_reset_codes_email_idx" ON "password_reset_codes"("email");

-- CreateIndex
CREATE INDEX "password_reset_codes_expiresAt_idx" ON "password_reset_codes"("expiresAt");

-- CreateIndex
CREATE INDEX "rate_limit_entries_windowStart_idx" ON "rate_limit_entries"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_entries_key_windowStart_key" ON "rate_limit_entries"("key", "windowStart");

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_matchedAdminUserId_fkey" FOREIGN KEY ("matchedAdminUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
