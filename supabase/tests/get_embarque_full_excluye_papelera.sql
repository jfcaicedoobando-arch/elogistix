-- =============================================================
-- get_embarque_full_excluye_papelera.sql
--
-- Regresión (auditoría ELEXP00250): la consulta única del detalle de embarque
-- debe excluir las filas enviadas a la papelera en TODAS sus colecciones.
-- Antes agregaba conceptos de venta borrados y el tab Costos mostraba un
-- margen inexistente (22.2 % con 13,930 USD de venta en lugar de 8,805).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/get_embarque_full_excluye_papelera.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_def text;
  v_filtros int;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_embarque_full';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'FAIL: no existe public.get_embarque_full';
  END IF;

  v_filtros := (length(v_def) - length(replace(v_def, 'deleted_at IS NULL', ''))) / length('deleted_at IS NULL');
  IF v_filtros < 5 THEN
    RAISE EXCEPTION 'REGRESIÓN: get_embarque_full tiene % filtros deleted_at IS NULL; se esperan 5 (conceptos venta/costo, documentos, notas, facturas)', v_filtros;
  END IF;

  IF v_def ILIKE '%SECURITY DEFINER%' THEN
    RAISE EXCEPTION 'REGRESIÓN: get_embarque_full no debe ser SECURITY DEFINER (la RLS del caller debe aplicar)';
  END IF;

  IF has_function_privilege('anon', 'public.get_embarque_full(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'REGRESIÓN: anon no debe poder ejecutar get_embarque_full';
  END IF;

  RAISE NOTICE 'OK · get_embarque_full excluye papelera en 5 colecciones y no es ejecutable por anon.';
END $$;

ROLLBACK;
