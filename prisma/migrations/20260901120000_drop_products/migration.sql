-- Retire the product catalogue.
--
-- The section was never used: production held 0 products, 0 sample requests
-- with a productId, and 0 application projects with one. The two existing
-- quote line items carry their own `productName`, which stays — the FK was
-- always optional and denormalised alongside it, so no line item loses its
-- description here.
--
-- Order matters: the referencing columns go before the table they point at.

ALTER TABLE "quote_line_items"   DROP COLUMN IF EXISTS "productId";
ALTER TABLE "order_line_items"   DROP COLUMN IF EXISTS "productId";
ALTER TABLE "invoice_line_items" DROP COLUMN IF EXISTS "productId";

ALTER TABLE "sample_requests"      DROP COLUMN IF EXISTS "productId";
ALTER TABLE "application_projects" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "application_projects" DROP COLUMN IF EXISTS "productName";

DROP TABLE IF EXISTS "products";

DROP TYPE IF EXISTS "ProductStatus";
