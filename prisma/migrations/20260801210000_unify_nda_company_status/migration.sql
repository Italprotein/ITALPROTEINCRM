-- Company.ndaStatus is a materialised cache of the current NDA register row.
-- Older builds allowed both sides to be edited independently, so preserve the
-- furthest known non-terminal lifecycle state while reconciling existing data.
WITH latest_nda AS (
  SELECT DISTINCT ON ("companyId")
    id,
    "companyId",
    status
  FROM ndas
  ORDER BY "companyId", "updatedAt" DESC, "createdAt" DESC, id DESC
), reconciled AS (
  SELECT
    latest_nda.id AS "ndaId",
    CASE
      WHEN latest_nda.status IN ('expired', 'terminated')
        OR companies."ndaStatus" IN ('expired', 'terminated')
        THEN latest_nda.status
      WHEN COALESCE(
        CASE companies."ndaStatus"
          WHEN 'not_required' THEN 0
          WHEN 'to_prepare' THEN 1
          WHEN 'draft' THEN 2
          WHEN 'sent' THEN 3
          WHEN 'under_review' THEN 4
          WHEN 'changes_requested' THEN 5
          WHEN 'approved' THEN 6
          WHEN 'awaiting_italprotein_signature' THEN 7
          WHEN 'awaiting_counterparty_signature' THEN 8
          WHEN 'partially_signed' THEN 9
          WHEN 'fully_signed' THEN 10
        END,
        -1
      ) > CASE latest_nda.status
          WHEN 'not_required' THEN 0
          WHEN 'to_prepare' THEN 1
          WHEN 'draft' THEN 2
          WHEN 'sent' THEN 3
          WHEN 'under_review' THEN 4
          WHEN 'changes_requested' THEN 5
          WHEN 'approved' THEN 6
          WHEN 'awaiting_italprotein_signature' THEN 7
          WHEN 'awaiting_counterparty_signature' THEN 8
          WHEN 'partially_signed' THEN 9
          WHEN 'fully_signed' THEN 10
          ELSE -1
        END
        THEN companies."ndaStatus"
      ELSE latest_nda.status
    END AS status
  FROM latest_nda
  JOIN companies ON companies.id = latest_nda."companyId"
)
UPDATE ndas
SET status = reconciled.status,
    "updatedAt" = CURRENT_TIMESTAMP
FROM reconciled
WHERE ndas.id = reconciled."ndaId"
  AND ndas.status IS DISTINCT FROM reconciled.status;

-- The reconciled current register row now owns the status shown on companies,
-- portals, dashboards and permission gates.
WITH latest_nda AS (
  SELECT DISTINCT ON ("companyId")
    "companyId",
    status
  FROM ndas
  ORDER BY "companyId", "updatedAt" DESC, "createdAt" DESC, id DESC
)
UPDATE companies
SET "ndaStatus" = latest_nda.status,
    "updatedAt" = CURRENT_TIMESTAMP
FROM latest_nda
WHERE companies.id = latest_nda."companyId"
  AND companies."ndaStatus" IS DISTINCT FROM latest_nda.status;

-- Some imported companies had a real lifecycle status but no register row.
-- Create one current register entry so every non-empty company status has the
-- same source record in NDA & Documents. No document or signature is invented.
INSERT INTO ndas (
  id,
  reference,
  "companyId",
  status,
  "reminderDates",
  "createdAt",
  "updatedAt"
)
SELECT
  'nda_sync_' || MD5(companies.id),
  'NDA-CRM-' || UPPER(SUBSTRING(MD5(companies.id) FROM 1 FOR 16)),
  companies.id,
  companies."ndaStatus",
  ARRAY[]::TIMESTAMP(3)[],
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM companies
WHERE companies."ndaStatus" IS NOT NULL
  AND companies."ndaStatus" <> 'not_required'
  AND NOT EXISTS (
    SELECT 1 FROM ndas WHERE ndas."companyId" = companies.id
  );

