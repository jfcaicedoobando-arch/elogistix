-- =====================================================================
-- D-01 · Guard de `deleted_at` (papelera a prueba de manos)
-- Verifica: trigger presente en toda la allowlist, transiciones prohibidas
-- y puerta oficial de restauración marcada en las funciones de papelera.
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_faltan text[];
BEGIN
  -- 1) Trigger en todas las tablas de papelera con columna deleted_at.
  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_faltan
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'deleted_at'
     AND a.attnum > 0 AND NOT a.attisdropped
   WHERE c.relkind = 'r'
     AND public.is_soft_delete_table(c.relname)
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger t
        WHERE t.tgrelid = c.oid AND NOT t.tgisinternal
          AND t.tgname = 'trg_guard_soft_delete'
     );
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'D-01 FAIL: tablas de papelera sin trigger guard: %', v_faltan;
  END IF;

  -- 2) El guard cubre las tres transiciones prohibidas / normalizadas.
  IF pg_get_functiondef('public._guard_soft_delete()'::regprocedure)
       NOT LIKE '%LC_RESTORE_DIRECTO%' THEN
    RAISE EXCEPTION 'D-01 FAIL: el guard no bloquea la restauración directa';
  END IF;
  IF pg_get_functiondef('public._guard_soft_delete()'::regprocedure)
       NOT LIKE '%LC_DELETED_AT_INMUTABLE%' THEN
    RAISE EXCEPTION 'D-01 FAIL: el guard no congela deleted_at de filas en papelera';
  END IF;
  IF pg_get_functiondef('public._guard_soft_delete()'::regprocedure)
       NOT LIKE '%jsonb_build_object(''deleted_at'', now())%' THEN
    RAISE EXCEPTION 'D-01 FAIL: el guard no normaliza deleted_at a now()';
  END IF;

  -- 3) Puerta oficial: las funciones de papelera marcan la sesión.
  IF pg_get_functiondef('public.restore_record(text,uuid)'::regprocedure)
       NOT LIKE '%app.papelera_restore%' THEN
    RAISE EXCEPTION 'D-01 FAIL: restore_record no marca app.papelera_restore';
  END IF;
  IF pg_get_functiondef('public.restaurar_embarque_cascade(uuid)'::regprocedure)
       NOT LIKE '%app.papelera_restore%' THEN
    RAISE EXCEPTION 'D-01 FAIL: restaurar_embarque_cascade no marca app.papelera_restore';
  END IF;

  -- 4) Higiene H6: el guard no es ejecutable por anon.
  IF has_function_privilege('anon', 'public._guard_soft_delete()', 'EXECUTE') THEN
    RAISE EXCEPTION 'D-01 FAIL: anon puede ejecutar _guard_soft_delete';
  END IF;
END $$;

ROLLBACK;
\echo 'D-01 guard soft delete: OK'
