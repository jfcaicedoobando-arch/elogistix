-- Consolidar preserves no_objeto as an explicit type with no transfer rate.
-- Keep the former rate requirement for every other treatment, including legacy
-- rows whose type is NULL. No fiscal reclassification or historical backfill.
ALTER TABLE public.proforma_conceptos_consolidados
  ALTER COLUMN tasa_iva_aplicada DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS pcc_tasa_iva_presente_chk,
  ADD CONSTRAINT pcc_tasa_iva_presente_chk CHECK (
    tasa_iva_aplicada IS NOT NULL OR tipo_iva IS NOT DISTINCT FROM 'no_objeto'
  );
