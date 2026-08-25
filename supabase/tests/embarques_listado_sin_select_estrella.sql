-- =============================================================
-- embarques_listado_sin_select_estrella.sql · HOTFIX R3-01
--
-- Regresión de /embarques 42501 "permission denied for table embarques".
-- `public.embarques_listado` es SECURITY INVOKER: si su cuerpo pide la tabla
-- completa (`e.*`) exige SELECT a nivel TABLA sobre public.embarques, que
-- FIX2 B-1 revocó a authenticated/anon (grant por columna). Resultado: el
-- listado se caía para todo el staff.
--
-- CASO 1 · la función NO usa `e.*` / `embarques.*`.
-- CASO 2 · authenticated NO tiene SELECT a nivel tabla en embarques
--          (el hotfix no debe reabrir el hueco de seguridad).
-- CASO 3 · las 4 columnas internas siguen cerradas.
-- CASO 4 · la función sigue siendo SECURITY INVOKER y ejecutable por staff.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/embarques_listado_sin_select_estrella.sql
-- =============================================================

BEGIN;

\ir _catalogo_columnas_internas.sql

-- ---------- CASO 1 · sin SELECT estrella sobre embarques ----------------
DO $caso1$
DECLARE
  v_src text;
BEGIN
  SELECT p.prosrc INTO v_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'embarques_listado';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: public.embarques_listado no existe';
  END IF;

  IF v_src ~ 'SELECT\s+e\.\*' OR v_src ~ 'SELECT\s+embarques\.\*' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: embarques_listado volvió a usar SELECT e.* (rompe el grant por columna)';
  END IF;

  -- Contraprueba: sigue leyendo la tabla con columnas explícitas.
  IF v_src !~ 'FROM\s+embarques\s+e' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: embarques_listado ya no lee FROM embarques e';
  END IF;
END;
$caso1$;

-- ---------- CASO 2 · sin SELECT a nivel tabla ---------------------------
DO $caso2$
BEGIN
  IF has_table_privilege('authenticated', 'public.embarques', 'SELECT') THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: authenticated recuperó SELECT a nivel tabla en embarques';
  END IF;
  IF has_table_privilege('anon', 'public.embarques', 'SELECT') THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: anon recuperó SELECT a nivel tabla en embarques';
  END IF;
END;
$caso2$;

-- ---------- CASO 3 · columnas internas cerradas -------------------------
DO $caso3$
DECLARE
  v_col text;
BEGIN
  FOREACH v_col IN ARRAY pg_temp.columnas_internas_embarques()
  LOOP
    IF has_column_privilege('authenticated', 'public.embarques', v_col, 'SELECT') THEN
      RAISE EXCEPTION 'CASO 3 FALLÓ: authenticated puede leer embarques.%', v_col;
    END IF;
  END LOOP;

  -- Contraprueba: las columnas que consume el listado siguen legibles.
  FOREACH v_col IN ARRAY ARRAY['id','expediente','bl_master','cliente_nombre','estado','etd','eta','tipo_carga','tiene_proforma']
  LOOP
    IF NOT has_column_privilege('authenticated', 'public.embarques', v_col, 'SELECT') THEN
      RAISE EXCEPTION 'CASO 3 FALLÓ: el listado no puede leer embarques.%', v_col;
    END IF;
  END LOOP;
END;
$caso3$;

-- ---------- CASO 4 · invoker + ejecutable por staff ---------------------
DO $caso4$
DECLARE
  v_oid oid;
  v_secdef boolean;
BEGIN
  SELECT p.oid, p.prosecdef INTO v_oid, v_secdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'embarques_listado';

  IF v_secdef THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: embarques_listado pasó a SECURITY DEFINER (escala privilegios)';
  END IF;

  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: authenticated no puede ejecutar embarques_listado';
  END IF;
END;
$caso4$;

ROLLBACK;

\echo '✅ embarques_listado_sin_select_estrella.sql: 4/4 casos OK'
