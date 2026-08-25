-- ============================================================================
-- Candado bidireccional service_role-only (FIX4 tanda 4 · P3).
--
-- Corre en CI DESPUÉS de aplicar migraciones y ANTES de
-- _ci_post_migrate.sql (que hace un GRANT EXECUTE ON ALL FUNCTIONS masivo
-- para emular la Data API y luego re-cierra la lista canónica). En este punto
-- los GRANT/REVOKE de la BD son EXACTAMENTE los que dejaron las migraciones,
-- así que se puede auditar el estado real de prod.
--
--   Dirección A — toda función de la lista canónica
--   (_ci_service_role_only.sql) debe venir YA cerrada de su migración: si
--   sigue ejecutable por PUBLIC/anon/authenticated es que su migración se
--   olvidó el REVOKE y en prod quedaría expuesta (CI la enmascaraba con el
--   re-cierre de post_migrate).
--
--   Dirección B — toda función de la BD con patrón service_role-only
--   (service_role puede ejecutarla; PUBLIC/anon/authenticated no) debe estar
--   en la lista: si falta, el GRANT masivo de post_migrate la reabre y CI
--   deja de ser fiel a prod sin que nadie lo note.
--
--   Además: entradas obsoletas (función renombrada o eliminada) abortan para
--   que la lista no acumule polvo.
--
-- Sale con código 1 (ON_ERROR_STOP) si hay drift en cualquiera de las dos
-- direcciones. No deja estado: sólo una tabla TEMP de sesión.
-- ============================================================================

\ir _ci_service_role_only.sql

DO $$
DECLARE
  v record;
  v_oid regprocedure;
  v_abiertas  text[] := '{}';
  v_faltan    text[] := '{}';
  v_obsoletas text[] := '{}';
BEGIN
  -- Dirección A (+ entradas obsoletas).
  FOR v IN SELECT fn FROM _ci_service_role_only LOOP
    v_oid := to_regprocedure(v.fn);
    IF v_oid IS NULL THEN
      v_obsoletas := v_obsoletas || v.fn;
      CONTINUE;
    END IF;
    IF has_function_privilege('public', v_oid, 'EXECUTE')
       OR has_function_privilege('anon', v_oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
      v_abiertas := v_abiertas || v.fn;
    END IF;
  END LOOP;

  -- Dirección B.
  FOR v IN
    SELECT p.oid AS oid,
           n.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')' AS fn
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND has_function_privilege('service_role', p.oid, 'EXECUTE')
       AND NOT has_function_privilege('public', p.oid, 'EXECUTE')
       AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM _ci_service_role_only l
       WHERE to_regprocedure(l.fn) = v.oid
    ) THEN
      v_faltan := v_faltan || v.fn;
    END IF;
  END LOOP;

  IF array_length(v_abiertas, 1) IS NOT NULL
     OR array_length(v_faltan, 1) IS NOT NULL
     OR array_length(v_obsoletas, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'CI service_role-only desincronizado:\n  sin REVOKE en su migración: %\n  faltan en _ci_service_role_only.sql: %\n  entradas obsoletas en la lista: %',
      COALESCE(array_to_string(v_abiertas, ', '), '(ninguna)'),
      COALESCE(array_to_string(v_faltan, ', '), '(ninguna)'),
      COALESCE(array_to_string(v_obsoletas, ', '), '(ninguna)');
  END IF;

  RAISE NOTICE 'CI service_role-only OK · % funciones canónicas cerradas en migraciones y sin drift.',
    (SELECT count(*) FROM _ci_service_role_only);
END $$;
