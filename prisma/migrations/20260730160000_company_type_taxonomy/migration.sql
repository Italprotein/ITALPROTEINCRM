-- Extends CompanyType with the categories the commercial team actually uses.
--
-- Purely additive: every existing value stays valid, so no company row changes
-- and nothing needs backfilling. Postgres only allows enum values to be added
-- one at a time, and IF NOT EXISTS keeps the migration re-runnable.
ALTER TYPE "CompanyType" ADD VALUE IF NOT EXISTS 'beverage_agency';
ALTER TYPE "CompanyType" ADD VALUE IF NOT EXISTS 'innovation_agency';
ALTER TYPE "CompanyType" ADD VALUE IF NOT EXISTS 'food_manufacturer';
ALTER TYPE "CompanyType" ADD VALUE IF NOT EXISTS 'beverage_manufacturer';
ALTER TYPE "CompanyType" ADD VALUE IF NOT EXISTS 'sports_nutrition';
