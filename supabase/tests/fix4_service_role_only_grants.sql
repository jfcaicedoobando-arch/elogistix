-- =============================================================
-- fix4_service_role_only_grants.sql · FIX4 tanda 4 (P3 harness CI)
--
-- Verifica, sobre la BD YA re-cerrada por _ci_post_migrate.sql, que la
-- lista canónica supabase/tests/rls/_ci_service_role_only.sql quedó
-- exactamente como prod la quiere:
--
--   · GRANT indebido → FAIL: ninguna función de la lista es ejecutable por
--     PUBLIC/anon/authenticated.
--   · REVOKE de más → FAIL: toda función de la lista conserva EXECUTE para
--     service_role (los crons/edges la necesitan).
--   · Entrada obsoleta → FAIL: la función ya no existe con esa firma.
--
-- El candado complementario (¿la migración trajo su propio REVOKE? ¿hay
-- funciones service_role-only fuera de la lista?) corre ANTES del
-- re-cierre en _ci_check_service_role_only.sql desde rls-tests.yml.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix4_service_role_only_grants.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

\ir rls/_ci_service_role_only.sql

DO $$
DECLARE
  v record;
  v_oid regprocedure;
  v_grant_indebido text[] := '{}';
  v_revoke_de_mas  text[] := '{}';
  v_obsoletas      text[] := '{}';
BEGIN
  FOR v IN SELECT fn FROM _ci_service_role_only LOOP
    v_oid := to_regprocedure(v.fn);
    IF v_oid IS NULL THEN
      v_obsoletas := v_obsoletas || v.fn;
      CONTINUE;
    END IF;
    IF has_function_privilege('public', v_oid, 'EXECUTE')
       OR has_function_privilege('anon', v_oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
      v_grant_indebido := v_grant_indebido || v.fn;
    END IF;
    IF NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
      v_revoke_de_mas := v_revoke_de_mas || v.fn;
    END IF;
  END LOOP;

  PERFORM pg_temp.assert(array_length(v_grant_indebido, 1) IS NULL,
    'GRANT indebido (ejecutables por PUBLIC/anon/authenticated): '
      || COALESCE(array_to_string(v_grant_indebido, ', '), ''));
  PERFORM pg_temp.assert(array_length(v_revoke_de_mas, 1) IS NULL,
    'REVOKE de más (service_role sin EXECUTE): '
      || COALESCE(array_to_string(v_revoke_de_mas, ', '), ''));
  PERFORM pg_temp.assert(array_length(v_obsoletas, 1) IS NULL,
    'Entradas obsoletas en _ci_service_role_only.sql (la función ya no existe): '
      || COALESCE(array_to_string(v_obsoletas, ', '), ''));

  RAISE NOTICE 'FIX4 SERVICE_ROLE_ONLY OK · % funciones canónicas: cerradas a clientes, abiertas a service_role.',
    (SELECT count(*) FROM _ci_service_role_only);
END $$;

ROLLBACK;
