-- Remember that a follow-up was settled, so the scan does not raise it again.
--
-- Purely additive. The column holds the last-contact instant the reconcile pass
-- saw when it retired a row; the scan only raises a new one once the
-- conversation moves past it.

ALTER TABLE "companies" ADD COLUMN "followUpClearedThrough" TIMESTAMP(3);
