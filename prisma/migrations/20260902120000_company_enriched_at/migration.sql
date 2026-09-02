-- Enrichment bookkeeping. Purely additive.
--
-- Apollo's plans meter calls (600/day on the current one), so the pass orders
-- by this column nulls-first and skips anything inside the cooldown window.
-- Without it every run would re-enrich the same head of the list.

ALTER TABLE "companies" ADD COLUMN "enrichedAt" TIMESTAMP(3);

CREATE INDEX "companies_enrichedAt_idx" ON "companies"("enrichedAt");
