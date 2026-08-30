-- Ola 2 · A — Guard estructural/conductual: los conceptos de VENTA sólo
-- admiten MXN/USD y las RPCs de proforma rechazan cualquier otra moneda.
DO $$
DECLARE
  v_def text;
BEGIN
  -- 1) CHECK constraint vigente en conceptos_venta.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'conceptos_venta'
      AND c.conname = 'conceptos_venta_moneda_soportada'
      AND c.contype = 'c'
  ) THEN
    RAISE EXCEPTION 'FAIL: falta el CHECK conceptos_venta_moneda_soportada (MXN/USD)';
  END IF;
  RAISE NOTICE '✓ CHECK conceptos_venta_moneda_soportada presente';

  -- 2) El CHECK debe mencionar exactamente MXN y USD (y NO EUR).
  SELECT pg_get_constraintdef(c.oid) INTO v_def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND t.relname = 'conceptos_venta'
    AND c.conname = 'conceptos_venta_moneda_soportada';
  IF v_def NOT LIKE '%MXN%' OR v_def NOT LIKE '%USD%' OR v_def LIKE '%EUR%' THEN
    RAISE EXCEPTION 'FAIL: el CHECK no restringe a MXN/USD: %', v_def;
  END IF;
  RAISE NOTICE '✓ CHECK restringe a MXN/USD';

  -- 3) Ninguna fila viva en una moneda no soportada (la constraint entró validada).
  IF EXISTS (SELECT 1 FROM public.conceptos_venta WHERE moneda NOT IN ('MXN','USD')) THEN
    RAISE EXCEPTION 'FAIL: existen conceptos de venta con moneda no soportada';
  END IF;
  RAISE NOTICE '✓ sin datos en moneda no soportada';

  -- 4) Ambas RPCs deben tener el guard LC_MONEDA_VENTA_NO_SOPORTADA.
  FOR v_def IN
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('crear_proforma_atomica','consolidar_proformas')
  LOOP
    IF v_def NOT LIKE '%LC_MONEDA_VENTA_NO_SOPORTADA%' THEN
      RAISE EXCEPTION 'FAIL: una RPC de proforma no valida la moneda de venta';
    END IF;
  END LOOP;
  RAISE NOTICE '✓ crear_proforma_atomica y consolidar_proformas validan la moneda';

  RAISE NOTICE 'ola2_moneda_venta: PASS';
END $$;
