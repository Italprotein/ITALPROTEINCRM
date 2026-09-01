-- The follow-up register. Purely additive.

CREATE TYPE "FollowUpSource" AS ENUM ('quiet_detection', 'suppression_list', 'manual');
CREATE TYPE "FollowUpStatus" AS ENUM ('pending', 'scheduled', 'waiting', 'contacted', 'closed');

CREATE TABLE "follow_ups" (
    "id"                TEXT NOT NULL,
    "companyId"         TEXT,
    "companyName"       TEXT NOT NULL,
    "normalizedName"    TEXT NOT NULL,
    "domain"            TEXT,
    "status"            "FollowUpStatus" NOT NULL DEFAULT 'pending',
    "source"            "FollowUpSource" NOT NULL DEFAULT 'manual',
    -- A plain DATE, not a timestamp: "11 October" must not shift by timezone.
    "followUpOn"        DATE,
    "reason"            TEXT,
    "notes"             TEXT,
    "lastContactAt"     TIMESTAMP(3),
    "quietDays"         INTEGER,
    "statusChangedAt"   TIMESTAMP(3),
    "statusChangedById" TEXT,
    "createdById"       TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- One open follow-up per company. NULL is allowed many times over, which is
-- what lets the suppression list carry counterparties that have no company row.
CREATE UNIQUE INDEX "follow_ups_companyId_key" ON "follow_ups"("companyId");

CREATE INDEX "follow_ups_status_idx"         ON "follow_ups"("status");
CREATE INDEX "follow_ups_source_idx"         ON "follow_ups"("source");
CREATE INDEX "follow_ups_followUpOn_idx"     ON "follow_ups"("followUpOn");
CREATE INDEX "follow_ups_normalizedName_idx" ON "follow_ups"("normalizedName");

ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_statusChangedById_fkey"
    FOREIGN KEY ("statusChangedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
