-- =============================================================
-- ola2_comisiones_regresion.sql · Ola 2 (comisiones cierran bien)
--
-- Casos:
--   · CASO 1 — `venta_embarque_mxn_neta` existe y es de sólo lectura, y
--              `calcular_comision_pago` la usa como denominador (O2.1).
--   · CASO 2 — `validar_cierre_embarque` consulta la cola de recálculo por
--              `pago_factura_id` / `resuelto_at` y ya no por la bandera
--              inalcanzable `definitiva` (O2.2).
--   · CASO 3 — `registrar_anticipo_proveedor` acepta `p_request_id` y la
--              firma vieja (sin idempotencia) ya no existe (O2.5).
--   · CASO 4 — ciclo de vida de liquidaciones: columna `estado` con su
--              constraint, y las RPC de pago/cancelación existen (O2.6).
--   · CASO 5 — los códigos LC_* nuevos están documentados si el catálogo
--              vive en la base.
--
-- Todo dentro de BEGIN…ROLLBACK.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola2_comisiones_regresion.sql
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- CASO 1: prorrateo contra la venta neta del EMBARQUE, no de la factura.
-- -------------------------------------------------------------
DO $caso1$
DECLARE
  v_def text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'venta_embarque_mxn_neta'
  ) THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: falta el helper venta_embarque_mxn_neta';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'calcular_comision_pago'
    AND pg_get_function_identity_arguments(p.oid) = 'p_pago_factura_id uuid';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: no existe calcular_comision_pago(uuid)';
  END IF;
  IF position('venta_embarque_mxn_neta' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: calcular_comision_pago no usa la venta neta del embarque como denominador';
  END IF;
  IF position('LEAST(' IN upper(v_def)) = 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: falta el tope de proporción (LEAST) en calcular_comision_pago';
  END IF;
  RAISE NOTICE 'CASO 1 OK · prorrateo neto por embarque con tope.';
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2: la regla de cierre es satisfacible (cola real, no bandera).
-- -------------------------------------------------------------
DO $caso2$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'validar_cierre_embarque';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: no existe validar_cierre_embarque';
  END IF;
  IF position('comisiones_recalculo_pendiente' IN v_def) = 0
     OR position('resuelto_at IS NULL' IN v_def) = 0 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: el cierre no revisa la cola de recálculo abierta';
  END IF;
  -- Sólo importa el USO de la bandera como filtro; el nombre puede seguir
  -- apareciendo en comentarios o en la etiqueta `no_definitivas` del check.
  IF v_def ~* 'definitiva\s*=\s*false' OR v_def ~* 'definitiva\s+IS\s+FALSE'
     OR v_def ~* 'NOT\s+definitiva' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: sigue usando la bandera `definitiva` (dependencia circular)';
  END IF;

  RAISE NOTICE 'CASO 2 OK · cierre bloquea por pendientes reales.';
END
$caso2$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 3: idempotencia del alta de anticipo.
-- -------------------------------------------------------------
DO $caso3$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'registrar_anticipo_proveedor'
      AND pg_get_function_arguments(p.oid) LIKE '%p_request_id uuid%'
  ) THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: registrar_anticipo_proveedor no acepta p_request_id';
  END IF;

  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'registrar_anticipo_proveedor') <> 1 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: hay más de una firma de registrar_anticipo_proveedor (ambigüedad en PostgREST)';
  END IF;
  RAISE NOTICE 'CASO 3 OK · alta de anticipo idempotente y sin firmas duplicadas.';
END
$caso3$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 4: ciclo de vida de liquidaciones de comisión.
-- -------------------------------------------------------------
DO $caso4$
DECLARE
  v_sqlstate text;
  v_msg text;
  v_org uuid := '2b2b2b2b-1111-1111-1111-111111111111';
  v_liq uuid := '2b2b2b2b-2222-2222-2222-222222222222';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'liquidaciones_comision'
      AND column_name = 'estado'
  ) THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: liquidaciones_comision no tiene columna estado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'liquidaciones_comision_estado_chk'
  ) THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: falta el constraint de estados válidos';
  END IF;

  FOR v_msg IN
    SELECT c FROM unnest(ARRAY['registrar_pago_liquidacion','cancelar_liquidacion_comision']) AS c
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_msg
    ) THEN
      RAISE EXCEPTION 'CASO 4 FALLÓ: falta la RPC %', v_msg;
    END IF;
  END LOOP;

  -- El constraint rechaza estados inventados.
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Ola2 Comisiones')
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    INSERT INTO public.liquidaciones_comision
      (id, organization_id, vendedora_id, periodo, total_mxn, estado)
    VALUES (v_liq, v_org, v_org, '2026-08', 1000, 'Inventado');
    v_sqlstate := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;

  IF v_sqlstate = '00000' THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: se aceptó un estado de liquidación inválido';
  END IF;
  RAISE NOTICE 'CASO 4 OK · estados de liquidación acotados (%).', v_sqlstate;
END
$caso4$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 5: códigos LC_* documentados (si el catálogo vive en la base).
-- -------------------------------------------------------------
DO $caso5$
DECLARE
  v_faltantes text[];
BEGIN
  IF to_regclass('public.codigos_error') IS NULL THEN
    RAISE NOTICE 'CASO 5 SKIP · el catálogo de códigos vive en el frontend.';
    RETURN;
  END IF;
  SELECT array_agg(c) INTO v_faltantes
  FROM unnest(ARRAY['LC_LIQUIDACION_YA_PAGADA','LC_LIQUIDACION_CANCELADA',
                    'LC_LIQUIDACION_SIN_ROL','LC_ANTICIPO_EN_PROCESO']) AS c
  WHERE NOT EXISTS (SELECT 1 FROM public.codigos_error e WHERE e.codigo = c);
  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: códigos sin descripción: %', v_faltantes;
  END IF;
  RAISE NOTICE 'CASO 5 OK · códigos LC_* documentados.';
END
$caso5$ LANGUAGE plpgsql;

ROLLBACK;
