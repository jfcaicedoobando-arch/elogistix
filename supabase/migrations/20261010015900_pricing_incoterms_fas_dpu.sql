-- LOCAL PROPOSAL ONLY: do not include in a release or execute until the complete
-- FAS/DPU domain contract is approved and end-to-end tests pass. The filename
-- must be assigned after the final release67/main migration inventory is known.
-- Adds exact labels; no historical value is mapped, renamed or rewritten.
-- New labels may only be used by later transactions after this COMMIT.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $preflight$
DECLARE v_labels text[];
BEGIN
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO v_labels
  FROM pg_catalog.pg_enum e
  WHERE e.enumtypid = 'public.incoterm'::regtype;
  IF v_labels IS DISTINCT FROM ARRAY['EXW','FOB','CIF','DAP','DDP','FCA','CFR','CPT','CIP','DAT','N/A']::text[] THEN
    RAISE EXCEPTION 'LC_PRICING_INCOTERM_CATALOG_DRIFT';
  END IF;
END;
$preflight$;
ALTER TYPE public.incoterm ADD VALUE 'FAS';
ALTER TYPE public.incoterm ADD VALUE 'DPU';
DO $postcheck$
DECLARE v_labels text[];
BEGIN
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO v_labels
  FROM pg_catalog.pg_enum e
  WHERE e.enumtypid = 'public.incoterm'::regtype;
  IF v_labels IS DISTINCT FROM ARRAY['EXW','FOB','CIF','DAP','DDP','FCA','CFR','CPT','CIP','DAT','N/A','FAS','DPU']::text[] THEN
    RAISE EXCEPTION 'LC_PRICING_INCOTERM_CATALOG_POSTCHECK';
  END IF;
END;
$postcheck$;
COMMIT;
