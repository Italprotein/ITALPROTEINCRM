-- Idempotency key for machine-generated shipment events (additive).
--
-- The tracking sync re-reads the whole courier mailbox on every run, so it
-- needs to recognise an event it has already filed. `externalId` holds the
-- source's own id (the Gmail message id today, a carrier checkpoint id when a
-- courier API is added) and the unique index below turns "file this event"
-- into an upsert.
--
-- Nullable on purpose: rows created by a human have no external id, and
-- Postgres treats NULLs as distinct, so they never collide with each other.

ALTER TABLE "shipment_events" ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "shipment_events_shipmentId_source_externalId_key"
  ON "shipment_events"("shipmentId", "source", "externalId");
