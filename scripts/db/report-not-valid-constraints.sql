-- =============================================================
-- report-not-valid-constraints.sql · O1.16 (sólo lectura)
--
-- Lista las restricciones CHECK/FK creadas con NOT VALID y, para cada una,
-- cuántas filas históricas la violan. NO modifica nada: no hay UPDATE,
-- DELETE ni VALIDATE CONSTRAINT. Sirve como semáforo antes de una ventana
-- de mantenimiento: si el conteo sale en cero se puede validar de verdad.
--
-- Ejecución:
--   psql "$SUPABASE_DB_URL" -f scripts/db/report-not-valid-constraints.sql
-- =============================================================

DO $reporte$
DECLARE
  r record;
  v_infractoras bigint;
  v_total int := 0;
  v_sucias int := 0;
  v_sql text;
BEGIN
  RAISE NOTICE '--- Restricciones NOT VALID en el esquema public ---';

  FOR r IN
    SELECT c.conname,
           c.contype,
           n.nspname || '.' || t.relname AS tabla,
           pg_get_constraintdef(c.oid)   AS definicion
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE NOT c.convalidated
      AND n.nspname = 'public'
    ORDER BY t.relname, c.conname
  LOOP
    v_total := v_total + 1;

    IF r.contype = 'c' THEN
      -- CHECK: contamos filas donde la condición NO se cumple.
      v_sql := format(
        'SELECT count(*) FROM %s WHERE NOT (%s)',
        r.tabla,
        regexp_replace(r.definicion, '^CHECK \s*\((.*)\)\s*(NOT VALID)?$', '\1')
      );
      BEGIN
        EXECUTE v_sql INTO v_infractoras;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ? %.% · no se pudo evaluar automáticamente (%). Definición: %',
          r.tabla, r.conname, SQLERRM, r.definicion;
        CONTINUE;
      END;
    ELSE
      -- FK y demás tipos: se reportan para revisión manual.
      RAISE NOTICE '  ? % · % (%): revisar manualmente · %',
        r.tabla, r.conname, r.contype, r.definicion;
      CONTINUE;
    END IF;

    IF v_infractoras = 0 THEN
      RAISE NOTICE '  OK  %.% · 0 filas infractoras → lista para VALIDATE CONSTRAINT',
        r.tabla, r.conname;
    ELSE
      v_sucias := v_sucias + 1;
      RAISE NOTICE '  !!  %.% · % filas infractoras · %',
        r.tabla, r.conname, v_infractoras, r.definicion;
    END IF;
  END LOOP;

  RAISE NOTICE '--- Resumen: % restricciones NOT VALID, % con datos históricos sucios ---',
    v_total, v_sucias;
END
$reporte$ LANGUAGE plpgsql;
