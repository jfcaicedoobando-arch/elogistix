-- =============================================================
-- convertir_monto_pago.sql · Ola 1 (auditoría de tests 2026-07-24)
--
-- Tests conductuales de `public.convertir_monto_pago_a_factura` —
-- la función de conversión MXN↔USD en el corazón del money-path
-- multi-moneda (pagos en moneda distinta a la factura).
--
-- Fija el comportamiento vigente (FIX-R4-06): el TC del pago es
-- OBLIGATORIO en cruces MXN↔USD (sin fallback al TC de la factura)
-- y los cruces con otras monedas se rechazan.
--
-- Sin fixture de tablas: la función es IMMUTABLE, se ejercita por
-- SELECT directo. Corre en CI como paso del workflow rls-tests.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/convertir_monto_pago.sql
-- =============================================================

BEGIN;

-- CASO 1: misma moneda → identidad (cualquier TC)
DO $$
BEGIN
  IF public.convertir_monto_pago_a_factura(1234.56, 'MXN', NULL, 'MXN', NULL) <> 1234.56 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: misma moneda no es identidad';
  END IF;
  RAISE NOTICE 'CASO 1 OK: misma moneda → identidad';
END $$;

-- CASO 2: MXN → USD divide por TC del pago (redondeo 4 decimales)
DO $$
DECLARE v numeric;
BEGIN
  v := public.convertir_monto_pago_a_factura(19500, 'MXN', 19.5, 'USD', 18.0);
  IF v <> 1000.0000 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: 19500 MXN @19.5 → % USD (esperado 1000)', v;
  END IF;
  RAISE NOTICE 'CASO 2 OK: MXN→USD divide por TC del pago (%)', v;
END $$;

-- CASO 3: USD → MXN multiplica por TC del pago
DO $$
DECLARE v numeric;
BEGIN
  v := public.convertir_monto_pago_a_factura(1000, 'USD', 19.5, 'MXN', 20.0);
  IF v <> 19500.0000 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: 1000 USD @19.5 → % MXN (esperado 19500)', v;
  END IF;
  RAISE NOTICE 'CASO 3 OK: USD→MXN multiplica por TC del pago (%)', v;
END $$;

-- CASO 4: TC del pago NULL en cruce → 22023 LC_PAGO_TC_REQUERIDO
DO $$
DECLARE v_state text; v_msg text;
BEGIN
  BEGIN
    PERFORM public.convertir_monto_pago_a_factura(1000, 'MXN', NULL, 'USD', 19.5);
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_state <> '22023' OR v_msg NOT LIKE 'LC_PAGO_TC_REQUERIDO%' THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: esperado 22023/LC_PAGO_TC_REQUERIDO, vino % / %', v_state, v_msg;
  END IF;
  RAISE NOTICE 'CASO 4 OK: TC NULL → LC_PAGO_TC_REQUERIDO (22023)';
END $$;

-- CASO 5: TC del pago = 0 en cruce → 22023 (NULLIF(0)→NULL)
DO $$
DECLARE v_state text; v_msg text;
BEGIN
  BEGIN
    PERFORM public.convertir_monto_pago_a_factura(1000, 'USD', 0, 'MXN', 19.5);
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_state <> '22023' OR v_msg NOT LIKE 'LC_PAGO_TC_REQUERIDO%' THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: esperado 22023/LC_PAGO_TC_REQUERIDO, vino % / %', v_state, v_msg;
  END IF;
  RAISE NOTICE 'CASO 5 OK: TC=0 → LC_PAGO_TC_REQUERIDO (22023)';
END $$;

-- CASO 6: cruce con EUR (M-2, auditoría v14) → pivote en MXN, ya no se rechaza.
DO $$
DECLARE v_res numeric; v_state text; v_msg text;
BEGIN
  -- EUR→MXN: usa el TC del pago (MXN por EUR).
  v_res := public.convertir_monto_pago_a_factura(1000, 'EUR', 21, 'MXN', 1);
  IF v_res IS DISTINCT FROM 21000.0000 THEN
    RAISE EXCEPTION 'CASO 6 FALLÓ: EUR→MXN esperado 21000, vino %', v_res;
  END IF;
  -- EUR→USD: pivote MXN (1000*21) y luego / TC de la factura (19.5).
  v_res := public.convertir_monto_pago_a_factura(1000, 'EUR', 21, 'USD', 19.5);
  IF round(v_res, 2) IS DISTINCT FROM round(21000::numeric / 19.5, 2) THEN
    RAISE EXCEPTION 'CASO 6 FALLÓ: EUR→USD esperado %, vino %', round(21000::numeric / 19.5, 2), v_res;
  END IF;
  -- Sin TC de la factura destino: error mapeado, no cruce silencioso.
  BEGIN
    PERFORM public.convertir_monto_pago_a_factura(1000, 'EUR', 21, 'USD', NULL);
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_state <> '22023' OR v_msg NOT LIKE 'LC_PAGO_TC_FACTURA_REQUERIDO%' THEN
    RAISE EXCEPTION 'CASO 6 FALLÓ: esperado 22023/LC_PAGO_TC_FACTURA_REQUERIDO, vino % / %', v_state, v_msg;
  END IF;
  RAISE NOTICE 'CASO 6 OK: cruces con EUR pivotean en MXN y exigen TC de la factura';
END $$;

-- CASO 7: monto NULL → NULL (no excepción)
DO $$
BEGIN
  IF public.convertir_monto_pago_a_factura(NULL, 'MXN', NULL, 'USD', NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'CASO 7 FALLÓ: monto NULL debe devolver NULL';
  END IF;
  RAISE NOTICE 'CASO 7 OK: monto NULL → NULL';
END $$;

ROLLBACK;

-- =============================================================
-- Resultado esperado: 7 NOTICE "CASO n OK" y ROLLBACK.
-- =============================================================
