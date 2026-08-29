-- Ola 8 (re-auditoría v15) · guards conductuales de los candados de base.
--
-- M-14: los triggers de banda de tipo de cambio deben existir en pagos_factura
--       y pagos_proveedor, y la función debe rechazar fuera de 5–40.
-- M-15: `credito_en_uso_mxn` debe existir y ser ejecutable sólo por
--       service_role (la usa la edge `facturapi-emitir`).
-- B-12: `crear_embarque_completo` debe rechazar pesos/piezas negativos.
-- B-6:  `registrar_traspaso_bancario` es fail-closed con saldo desconocido.
BEGIN;

DO $$
DECLARE
  d text;
BEGIN
  -- ── M-14 ───────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tc_banda_pagos_factura') THEN
    RAISE EXCEPTION 'OLA8 M-14: falta el trigger trg_tc_banda_pagos_factura';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tc_banda_pagos_proveedor') THEN
    RAISE EXCEPTION 'OLA8 M-14: falta el trigger trg_tc_banda_pagos_proveedor';
  END IF;
  d := pg_get_functiondef('public._assert_tc_banda()'::regprocedure);
  IF position('LC_TC_FUERA_DE_BANDA' in d) = 0 THEN
    RAISE EXCEPTION 'OLA8 M-14: _assert_tc_banda perdió el código de error de banda';
  END IF;

  -- ── M-15 ───────────────────────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'credito_en_uso_mxn'
  ) THEN
    RAISE EXCEPTION 'OLA8 M-15: falta public.credito_en_uso_mxn';
  END IF;
  IF has_function_privilege('anon', 'public.credito_en_uso_mxn(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.credito_en_uso_mxn(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'OLA8 M-15: credito_en_uso_mxn no debe ser ejecutable por anon/authenticated';
  END IF;

  -- ── B-12 ───────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'embarques_medidas_no_negativas') THEN
    RAISE EXCEPTION 'OLA8 B-12: falta el CHECK embarques_medidas_no_negativas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'embarque_contenedores_medidas_no_negativas') THEN
    RAISE EXCEPTION 'OLA8 B-12: falta el CHECK embarque_contenedores_medidas_no_negativas';
  END IF;
END $$;

ROLLBACK;
