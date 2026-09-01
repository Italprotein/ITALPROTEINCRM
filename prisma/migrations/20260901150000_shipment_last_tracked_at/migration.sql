-- Quota discipline for the DHL tracking poll.
--
-- The free Unified Tracking tier has a daily call budget, so the sync orders by
-- this column (nulls first) and skips anything polled inside the cooldown
-- window. Without it every run would re-ask about the same few parcels.

ALTER TABLE "shipments" ADD COLUMN "lastTrackedAt" TIMESTAMP(3);

CREATE INDEX "shipments_lastTrackedAt_idx" ON "shipments"("lastTrackedAt");
