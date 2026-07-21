-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'account_invitation';

-- CreateTable
CREATE TABLE "account_activation_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_activation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_activation_tokens_tokenHash_key" ON "account_activation_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "account_activation_tokens_userId_idx" ON "account_activation_tokens"("userId");

-- CreateIndex
CREATE INDEX "account_activation_tokens_expiresAt_idx" ON "account_activation_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "account_activation_tokens" ADD CONSTRAINT "account_activation_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
