-- =============================================================
-- cotizacion_convertir_sin_costos.sql
--
-- Guard v13.823.370 (P1-1) · el candado de costos vive en el SERVIDOR.
--
-- Regla: una cotización transaccional por lo demás convertible (Aceptada, con
-- conceptos de venta positivos) NO puede crear el embarque borrador si no tiene
-- ningún renglón vigente en `cotizacion_costos`. El error canónico es
-- LC_COT_SIN_COSTOS.
--
-- El candado vive en el helper canónico `_assert_cotizacion_venta_valida`, que
-- invocan tanto `_assert_cotizacion_convertible` como
-- `crear_embarque_borrador_core`; así queda cubierta TODA decisión de tarifa
-- (sin_cambios, mantenida_por_operaciones, refrescada, sustituida,
-- reaprobada_ventas) y también las llamadas directas a la RPC.
--
--   Caso A — sin costos              → LC_COT_SIN_COSTOS.
--   Caso B — con un costo vigente    → NO se dispara LC_COT_SIN_COSTOS.
--   Caso C — costo con soft-delete   → vuelve a LC_COT_SIN_COSTOS.
--   Caso D — cotización informativa  → exenta (no se le exigen costos).
--
-- Además se verifica estáticamente que las dos rutas de servidor sigan
-- delegando en el helper (no se puede "saltar" el candado por la wrapper).
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cotizacion_convertir_sin_costos.sql
-- =============================================================

BEGIN;

DO $sc$
DECLARE
  v_core  text := pg_get_functiondef('public.crear_embarque_borrador_core(uuid)'::regprocedure);
  v_conv  text := pg_get_functiondef('public._assert_cotizacion_convertible(uuid, uuid)'::regprocedure);
  v_helper text := pg_get_functiondef('public._assert_cotizacion_venta_valida(uuid)'::regprocedure);
  v_org   uuid;
  v_cli   uuid;
  v_cot   uuid;
  v_info  uuid;
  v_costo uuid;
  v_ventas jsonb := jsonb_build_array(
    jsonb_build_object('descripcion', 'Flete marítimo', 'moneda', 'MXN',
                       'cantidad', '1', 'precio_unitario', '5000')
  );
  v_err   text;
BEGIN
  -- 0) Contrato estático: el candado y sus dos rutas de entrada.
  IF v_helper !~ 'LC_COT_SIN_COSTOS' THEN
    RAISE EXCEPTION 'REGRESION: el helper canónico dejó de exigir costos (LC_COT_SIN_COSTOS)';
  END IF;
  IF v_helper !~ 'cotizacion_costos' OR v_helper !~ 'deleted_at IS NULL' THEN
    RAISE EXCEPTION 'REGRESION: el candado de costos dejó de contar renglones vigentes de cotizacion_costos';
  END IF;
  IF v_core !~ '_assert_cotizacion_venta_valida' THEN
    RAISE EXCEPTION 'REGRESION: crear_embarque_borrador_core ya no delega en el helper canónico de venta/costos';
  END IF;
  IF v_conv !~ '_assert_cotizacion_venta_valida' THEN
    RAISE EXCEPTION 'REGRESION: _assert_cotizacion_convertible ya no delega en el helper canónico de venta/costos';
  END IF;

  -- 1) Datos temporales aislados (todo se revierte con el ROLLBACK final).
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST COT SIN COSTOS', 'TCSC00000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE COT SIN COSTOS', 'XAXX010101000', 'cot-sin-costos@test.local')
  RETURNING id INTO v_cli;

  INSERT INTO public.cotizaciones (organization_id, cliente_id, estado, folio, modo, tipo,
                                   tipo_documento, conceptos_venta)
  VALUES (v_org, v_cli, 'Aceptada'::public.estado_cotizacion, 'COT-SINCOSTO-0001',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          'transaccional', v_ventas)
  RETURNING id INTO v_cot;

  -- 2) Caso A: sin costos debe reventar con LC_COT_SIN_COSTOS.
  v_err := NULL;
  BEGIN
    PERFORM public._assert_cotizacion_venta_valida(v_cot);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_err IS NULL OR v_err NOT LIKE '%LC_COT_SIN_COSTOS%' THEN
    RAISE EXCEPTION 'REGRESION: una cotización sin costos ya no se bloquea con LC_COT_SIN_COSTOS (error obtenido: %)',
      COALESCE(v_err, '<ninguno>');
  END IF;

  -- 3) Caso B: con un costo vigente el candado no aplica.
  INSERT INTO public.cotizacion_costos (cotizacion_id, organization_id, concepto, moneda,
                                        cantidad, costo_unitario, precio_venta)
  VALUES (v_cot, v_org, 'Flete marítimo', 'MXN', 1, 3000, 5000)
  RETURNING id INTO v_costo;

  v_err := NULL;
  BEGIN
    PERFORM public._assert_cotizacion_venta_valida(v_cot);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'REGRESION: una cotización con costos vigentes ya no pasa el candado (error: %)', v_err;
  END IF;

  -- 4) Caso C: un costo en papelera no cuenta (fail-closed sobre soft-delete).
  UPDATE public.cotizacion_costos SET deleted_at = now() WHERE id = v_costo;

  v_err := NULL;
  BEGIN
    PERFORM public._assert_cotizacion_venta_valida(v_cot);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_err IS NULL OR v_err NOT LIKE '%LC_COT_SIN_COSTOS%' THEN
    RAISE EXCEPTION 'REGRESION: un costo con soft-delete vuelve a satisfacer el candado de costos (error: %)',
      COALESCE(v_err, '<ninguno>');
  END IF;

  -- 5) Caso D: las informativas siguen exentas.
  INSERT INTO public.cotizaciones (organization_id, cliente_id, estado, folio, modo, tipo,
                                   tipo_documento, conceptos_venta)
  VALUES (v_org, v_cli, 'Aceptada'::public.estado_cotizacion, 'COT-SINCOSTO-0002',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          'informativa', '[]'::jsonb)
  RETURNING id INTO v_info;

  v_err := NULL;
  BEGIN
    PERFORM public._assert_cotizacion_venta_valida(v_info);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION 'REGRESION: una cotización informativa dejó de estar exenta del candado (error: %)', v_err;
  END IF;

  RAISE NOTICE 'cotizacion_convertir_sin_costos: PASS';
END $sc$;

ROLLBACK;
