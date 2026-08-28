-- ==========================================================================
-- Ola E2 · Sub-ola A — guards de regresión (N5, N11, C3-res, N7, N15)
-- Se ejecuta con psql contra la base de CI.
-- ==========================================================================

-- N5 · el trigger de consistencia debe escuchar TODAS las columnas de vínculo.
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_triggerdef(t.oid) INTO v_def
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname = 'bbva_movimientos' AND t.tgname = 'trg_movimiento_pago_consistente';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'N5 REGRESIÓN: falta trg_movimiento_pago_consistente';
  END IF;

  IF v_def NOT LIKE '%anticipo_proveedor_id%'
     OR v_def NOT LIKE '%pago_proveedor_lote_id%'
     OR v_def NOT LIKE '%pago_factura_lote_id%'
     OR v_def NOT LIKE '%traspaso_id%'
     OR v_def NOT LIKE '%cargo%'
     OR v_def NOT LIKE '%abono%' THEN
    RAISE EXCEPTION 'N5 REGRESIÓN: column-list incompleta en trg_movimiento_pago_consistente: %', v_def;
  END IF;
END $$;

-- N11 · la validación de monto debe seguir en la función.
DO $$
DECLARE v_src text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'assert_movimiento_pago_consistente';
  IF v_src IS NULL OR v_src NOT LIKE '%LC_MOVIMIENTO_MONTO_MISMATCH%' THEN
    RAISE EXCEPTION 'N11 REGRESIÓN: assert_movimiento_pago_consistente sin validación de monto';
  END IF;
END $$;

-- C3-res · candados de tenant en las 3 tablas hijas de CxP.
DO $$
DECLARE v_faltan text;
BEGIN
  SELECT string_agg(x.tabla, ', ') INTO v_faltan
  FROM (VALUES
    ('proveedor_facturas_conceptos'),
    ('proveedor_notas_credito'),
    ('anticipos_proveedor')
  ) AS x(tabla)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE c.relname = x.tabla
      AND p.proname = '_assert_padre_misma_org'
      AND NOT t.tgisinternal
  );
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'C3-res REGRESIÓN: sin candado de tenant en: %', v_faltan;
  END IF;
END $$;

-- N7 · guard de borrado lógico de facturas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'facturas' AND t.tgname = 'trg_factura_soft_delete_guard'
  ) THEN
    RAISE EXCEPTION 'N7 REGRESIÓN: falta trg_factura_soft_delete_guard en facturas';
  END IF;
END $$;

-- N15 · assert de cancelación y FK de proformas sin CASCADE.
DO $$
DECLARE v_src text; v_del "char";
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'embarques_assert_cancelacion_sin_cxc_cxp';
  IF v_src NOT LIKE '%LC_CANCEL_CON_PROFORMA%' OR v_src NOT LIKE '%LC_CANCEL_CON_FACTURA_BORRADOR%' THEN
    RAISE EXCEPTION 'N15 REGRESIÓN: el assert de cancelación no cubre proformas/facturas borrador';
  END IF;

  SELECT c.confdeltype INTO v_del
  FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'proformas' AND c.conname = 'proformas_embarque_id_fkey';
  IF v_del IS DISTINCT FROM 'r' THEN
    RAISE EXCEPTION 'N15 REGRESIÓN: proformas.embarque_id debe ser ON DELETE RESTRICT (actual: %)', v_del;
  END IF;
END $$;

SELECT 'ola_e2_a_guards OK' AS resultado;

-- ==========================================================================
-- Ola E2 · Sub-ola B — C9: costos de cotización por rol y propiedad.
-- ==========================================================================
DO $$
DECLARE v_src text; v_pol text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'puede_ver_costos_cotizacion';
  IF v_src IS NULL OR v_src LIKE '%''vendedor''%' THEN
    RAISE EXCEPTION 'C9 REGRESIÓN: puede_ver_costos_cotizacion no debe incluir el rol vendedor sin condición de propiedad';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'puede_ver_costos_cotizacion_propia'
  ) THEN
    RAISE EXCEPTION 'C9 REGRESIÓN: falta public.puede_ver_costos_cotizacion_propia';
  END IF;

  SELECT pg_get_expr(pol.polqual, pol.polrelid) INTO v_pol
  FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
  WHERE c.relname = 'cotizacion_costos' AND pol.polname = 'Tenant read cotizacion_costos';
  IF v_pol IS NULL OR v_pol NOT LIKE '%puede_ver_costos_cotizacion_propia%' THEN
    RAISE EXCEPTION 'C9 REGRESIÓN: la policy de lectura de cotizacion_costos no contempla al vendedor dueño';
  END IF;
END $$;

SELECT 'ola_e2_b_guards OK' AS resultado;
