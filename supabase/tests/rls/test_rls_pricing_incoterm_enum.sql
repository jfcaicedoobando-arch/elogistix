-- Post-replay enum contract in the standard disposable RLS database only.
-- FAS/DPU must already be committed by the forward migration; never replay it here.
-- Catalog reads and typed variables only: no business fixtures or privilege changes.
BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL ROLE authenticated;
SET LOCAL search_path = pg_catalog, public;

DO $contract$
DECLARE
  v_expected constant text[] := ARRAY[
    'EXW','FOB','CIF','DAP','DDP','FCA','CFR','CPT','CIP','DAT','N/A','FAS','DPU'
  ];
  v_actual text[];
  v_columns integer;
  v_label text;
  v_quote public.cotizaciones.incoterm%TYPE;
  v_shipment public.embarques.incoterm%TYPE;
BEGIN
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
    INTO v_actual
    FROM pg_catalog.pg_enum e
    WHERE e.enumtypid = 'public.incoterm'::regtype;
  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'Incoterm enum must preserve all 11 legacy labels/order and append FAS/DPU: %', v_actual;
  END IF;

  SELECT count(*) INTO v_columns
    FROM pg_catalog.pg_attribute a
    WHERE a.attrelid IN ('public.cotizaciones'::regclass, 'public.embarques'::regclass)
      AND a.attname = 'incoterm'
      AND a.attnum > 0 AND NOT a.attisdropped
      AND a.atttypid = 'public.incoterm'::regtype;
  IF v_columns <> 2 THEN
    RAISE EXCEPTION 'Quote and shipment incoterm columns must use exactly public.incoterm';
  END IF;

  -- Exercise the real enum input and both actual column types without inserting rows.
  FOREACH v_label IN ARRAY v_expected LOOP
    v_quote := v_label::public.incoterm;
    v_shipment := v_label::public.incoterm;
    IF v_quote::text IS DISTINCT FROM v_label OR v_shipment::text IS DISTINCT FROM v_label THEN
      RAISE EXCEPTION 'Incoterm failed exact quote/shipment round trip: %', v_label;
    END IF;
  END LOOP;

  BEGIN
    PERFORM 'UNKNOWN_INCOTERM'::public.incoterm;
    RAISE EXCEPTION 'Incoterm enum accepted an unknown label';
  EXCEPTION WHEN invalid_text_representation THEN
    NULL; -- Only SQLSTATE 22P02 satisfies this negative case.
  END;
END;
$contract$;

ROLLBACK;

