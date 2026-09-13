-- =============================================================
-- dashboards_cancelado_y_teu.sql
--
-- Regresión (R221 · ronda de auditoría):
--   1) Un embarque Cancelado debe seguir mostrándose como Cancelado en los
--      tableros. Antes se derivaba el estado por ETD/ETA y aparecía como
--      "Arribo", generando alertas de demora sobre cargas muertas.
--   2) get_embarque_full debe devolver NULL para un expediente en la papelera
--      (antes el deep link abría la ficha completa de un borrado).
--   5) operaciones_stats debe contar TEU reales de embarque_contenedores
--      (40'/45' = 2 TEU) en lugar de contar embarques, y exponer también el
--      conteo físico.
--
-- Guard estructural (solo lectura sobre pg_get_functiondef); no inserta datos.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/dashboards_cancelado_y_teu.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_fn text;
  v_def text;
BEGIN
  -- (1) Cancelado se preserva antes de derivar por fechas.
  FOREACH v_fn IN ARRAY ARRAY['dashboard_details_datos', 'dashboard_summary_datos', 'operaciones_stats']
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_fn;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'FAIL: no existe public.%', v_fn;
    END IF;

    IF position('WHEN e.estado = ''Cancelado'' THEN ''Cancelado''' IN v_def) = 0 THEN
      RAISE EXCEPTION 'REGRESIÓN: % ya no preserva el estado Cancelado antes de derivar por ETD/ETA', v_fn;
    END IF;
  END LOOP;

  -- (2) get_embarque_full corta los embarques en la papelera.
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_embarque_full';

  IF position('NOT EXISTS' IN v_def) = 0 THEN
    RAISE EXCEPTION 'REGRESIÓN: get_embarque_full ya no verifica que el embarque exista fuera de la papelera';
  END IF;

  -- (5) TEU reales desde embarque_contenedores.
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'operaciones_stats';

  IF position('teu_por_embarque' IN v_def) = 0 THEN
    RAISE EXCEPTION 'REGRESIÓN: operaciones_stats ya no calcula TEU desde embarque_contenedores';
  END IF;

  IF position('embarque_contenedores' IN v_def) = 0 THEN
    RAISE EXCEPTION 'REGRESIÓN: operaciones_stats dejó de leer embarque_contenedores';
  END IF;

  IF position('totalContenedoresFisicos' IN v_def) = 0 THEN
    RAISE EXCEPTION 'REGRESIÓN: operaciones_stats ya no expone totalContenedoresFisicos';
  END IF;

  RAISE NOTICE 'OK · Cancelado preservado en 3 tableros, get_embarque_full excluye papelera y operaciones_stats cuenta TEU reales.';
END $$;

ROLLBACK;
