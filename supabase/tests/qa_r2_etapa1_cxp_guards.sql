-- QA R2 · Etapa 1 — candados de CxP y cantidades fraccionadas.
-- B-15 sobrecosto, B-14 vencimiento derivado, B-13 folio duplicado,
-- B-19 conceptos_venta.cantidad numeric.
\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
  -- B-15: la validación de aprobación compara contra lo comprometido.
  IF pg_get_functiondef('public._cxp_validar_aprobacion(uuid,text)'::regprocedure)
       NOT LIKE '%LC_CXP_SOBRECOSTO%' THEN
    RAISE EXCEPTION 'B-15 FAIL: falta el candado de sobrecosto en la aprobación de CxP';
  END IF;
  IF pg_get_functiondef('public._cxp_validar_aprobacion(uuid,text)'::regprocedure)
       NOT LIKE '%conceptos_costo%' THEN
    RAISE EXCEPTION 'B-15 FAIL: la aprobación no cruza contra conceptos_costo';
  END IF;

  -- B-14: trigger espejo de vencimiento en proveedor_facturas.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'trg_proveedor_facturas_set_fecha_vencimiento' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'B-14 FAIL: falta el trigger de vencimiento en proveedor_facturas';
  END IF;
  -- B-14: facturas ya no siembra fecha_vencimiento con CURRENT_DATE.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'facturas'
       AND column_name = 'fecha_vencimiento' AND column_default IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'B-14 FAIL: facturas.fecha_vencimiento conserva DEFAULT';
  END IF;

  -- B-13: dedupe de folio de proveedor.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'trg_proveedor_facturas_dedupe_folio' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'B-13 FAIL: falta el trigger de folio duplicado de proveedor';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'proveedor_facturas_org_prov_folio_vivo_idx'
  ) THEN
    RAISE EXCEPTION 'B-13 FAIL: falta el índice de apoyo del dedupe de folio';
  END IF;
  -- El trigger no debe estorbar a los duplicados históricos: sólo valida en
  -- INSERT o cuando cambia la llave natural.
  IF pg_get_functiondef('public.proveedor_facturas_dedupe_folio()'::regprocedure)
       NOT LIKE '%TG_OP = ''UPDATE''%' THEN
    RAISE EXCEPTION 'B-13 FAIL: el dedupe no exenta los UPDATE que no cambian el folio';
  END IF;

  -- B-19: cantidades fraccionadas en conceptos de venta.
  IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'conceptos_venta'
          AND column_name = 'cantidad') <> 'numeric' THEN
    RAISE EXCEPTION 'B-19 FAIL: conceptos_venta.cantidad no es numeric';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('crear_embarque_completo','actualizar_embarque_completo','_crear_embarque_replicar_conceptos')
       AND pg_get_functiondef(p.oid) LIKE '%''cantidad'')::int%'
  ) THEN
    RAISE EXCEPTION 'B-19 FAIL: alguna RPC sigue casteando cantidad a int';
  END IF;
END $$;

-- Comportamiento del vencimiento derivado (sin tocar datos: ROLLBACK al final).
DO $$
DECLARE
  v_org uuid;
  v_prov uuid;
  v_cat uuid;
  v_id uuid;
  v_venc date;
BEGIN
  SELECT organization_id, proveedor_id, categoria_presupuesto_id
    INTO v_org, v_prov, v_cat
    FROM public.proveedor_facturas
   WHERE deleted_at IS NULL AND proveedor_id IS NOT NULL
     AND categoria_presupuesto_id IS NOT NULL
   LIMIT 1;
  IF v_org IS NULL THEN
    RAISE NOTICE 'B-14/B-13: sin datos base, se omite la prueba funcional';
    RETURN;
  END IF;

  INSERT INTO public.proveedor_facturas
    (organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor, fecha_emision, dias_credito, subtotal, total, moneda, estado)
  VALUES (v_org, v_prov, v_cat, 'QA-R2-DEDUPE-001', DATE '2026-01-10', 30, 100, 100, 'MXN', 'Borrador')
  RETURNING id, fecha_vencimiento INTO v_id, v_venc;

  IF v_venc IS DISTINCT FROM DATE '2026-02-09' THEN
    RAISE EXCEPTION 'B-14 FAIL: vencimiento derivado incorrecto (%)', v_venc;
  END IF;

  BEGIN
    INSERT INTO public.proveedor_facturas
      (organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor, fecha_emision, dias_credito, subtotal, total, moneda, estado)
    VALUES (v_org, v_prov, v_cat, 'QA-R2-DEDUPE-001', DATE '2026-01-11', 0, 100, 100, 'MXN', 'Borrador');
    RAISE EXCEPTION 'B-13 FAIL: se permitió capturar un folio duplicado';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- esperado: LC_CXP_FOLIO_DUPLICADO
  END;
END $$;

ROLLBACK;
\echo 'QA R2 Etapa 1 (CxP guards + cantidad numeric): OK'
