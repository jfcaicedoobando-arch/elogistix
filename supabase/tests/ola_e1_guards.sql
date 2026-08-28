-- =============================================================
-- ola_e1_guards.sql · Ola E1 (C4, C5, N6, N16, N22, N24, N12, N21)
--
--   · CASO 1 (C4): `embarques` tiene candados de tenant en cliente_id,
--     cotizacion_id, agente_id y tarifa_id.
--   · CASO 2 (N6): las funciones de mantenimiento/auditoría global NO son
--     ejecutables por `authenticated` ni `anon`.
--   · CASO 3 (N16): las políticas de UPDATE de cobranza_seguimiento y
--     cotizacion_plantillas tienen WITH CHECK.
--   · CASO 4 (N22/N24): existen los CHECK de cargo/abono y de saldo de
--     anticipos, y están validados.
--   · CASO 5 (C5): crear_proforma_atomica exige conceptos del mismo embarque.
--   · CASO 6 (N12/N21): la vista de REP usa hora de México y el borrado de
--     pago de proveedor ya no trae la condición muerta.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola_e1_guards.sql
-- =============================================================

BEGIN;

-- CASO 1 · C4
DO $$
DECLARE
  v_faltantes text[];
BEGIN
  SELECT array_agg(t.nombre ORDER BY t.nombre) INTO v_faltantes
  FROM (VALUES
      ('trg_embarques_org_cliente'),
      ('trg_embarques_org_cotizacion'),
      ('trg_embarques_org_agente'),
      ('trg_embarques_org_tarifa')
  ) AS t(nombre)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_trigger g
     JOIN pg_class c ON c.oid = g.tgrelid
    WHERE c.relname = 'embarques' AND g.tgname = t.nombre AND NOT g.tgisinternal
  );

  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'OLA-E1 C4: faltan candados de organización en embarques: %', v_faltantes;
  END IF;
END $$;

-- CASO 2 · N6
DO $$
DECLARE
  v_abiertas text[];
BEGIN
  SELECT array_agg(f.nombre ORDER BY f.nombre) INTO v_abiertas
  FROM (VALUES
      ('backfill_conceptos_venta_facturados'),
      ('backfill_proformas_aceptadas'),
      ('promover_embarque_por_liquidar'),
      ('auditoria_pfc_huerfanos')
  ) AS f(nombre)
  JOIN pg_proc p ON p.proname = f.nombre
  JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
  WHERE has_function_privilege('authenticated', p.oid, 'EXECUTE')
     OR has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_abiertas IS NOT NULL THEN
    RAISE EXCEPTION 'OLA-E1 N6: funciones de mantenimiento ejecutables por la app: %', v_abiertas;
  END IF;
END $$;

-- CASO 3 · N16
DO $$
DECLARE
  v_sin_check text[];
BEGIN
  SELECT array_agg(c.relname || '.' || pol.polname ORDER BY pol.polname) INTO v_sin_check
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  WHERE c.relname IN ('cobranza_seguimiento', 'cotizacion_plantillas')
    AND pol.polcmd = 'w'
    AND pol.polwithcheck IS NULL;

  IF v_sin_check IS NOT NULL THEN
    RAISE EXCEPTION 'OLA-E1 N16: políticas UPDATE sin WITH CHECK: %', v_sin_check;
  END IF;
END $$;

-- CASO 4 · N22 / N24
DO $$
DECLARE
  v_faltantes text[];
BEGIN
  SELECT array_agg(x.nombre ORDER BY x.nombre) INTO v_faltantes
  FROM (VALUES
      ('bbva_movimientos_cargo_abono_check'),
      ('anticipos_proveedor_saldo_rango_check')
  ) AS x(nombre)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint k
     WHERE k.conname = x.nombre AND k.contype = 'c' AND k.convalidated
  );

  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'OLA-E1 N22/N24: faltan CHECK validados: %', v_faltantes;
  END IF;
END $$;

-- CASO 5 · C5
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'crear_proforma_atomica';

  IF v_def IS NULL OR v_def NOT LIKE '%LC_CONCEPTOS_AJENOS%' THEN
    RAISE EXCEPTION 'OLA-E1 C5: crear_proforma_atomica no valida conceptos de otro embarque';
  END IF;
END $$;

-- CASO 6 · N12 / N21
DO $$
DECLARE
  v_view text;
  v_fn text;
BEGIN
  v_view := pg_get_viewdef('public.v_pagos_rep_pendientes'::regclass, true);
  IF v_view NOT LIKE '%America/Mexico_City%' THEN
    RAISE EXCEPTION 'OLA-E1 N12: v_pagos_rep_pendientes no calcula días con hora de México';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_fn
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'eliminar_pago_proveedor';

  IF v_fn LIKE '%pago_proveedor_id = _pago_id OR hash_dedupe%' THEN
    RAISE EXCEPTION 'OLA-E1 N21: eliminar_pago_proveedor conserva la condición muerta del CTE baja';
  END IF;
END $$;

ROLLBACK;
