-- =============================================================
-- fix3_helpers_financieros_revoke.sql · FIX3 tanda 3 (Ronda-2 P2)
--
-- Los 3 helpers financieros SECURITY DEFINER sin filtro de org
-- (venta_embarque_mxn_neta, nc_aplicadas_en_moneda_factura,
-- comision_embarques_de_factura) NO deben ser ejecutables por
-- `authenticated` (oráculos de lectura cross-tenant); sólo service_role
-- conserva EXECUTE directo. El frontend no los llama (verificado por grep).
--
-- Casos:
--   1. authenticated NO tiene EXECUTE en ninguno de los 3.
--   2. anon/PUBLIC tampoco.
--   3. service_role SÍ conserva EXECUTE en los 3.
--   4. La vía interna sigue viva: el trigger assert_factura_viva_para_pago
--      (caller de nc_aplicadas_en_moneda_factura) es SECURITY DEFINER.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix3_helpers_financieros_revoke.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_sin_permiso text[];
BEGIN
  -- 1 y 2: authenticated / anon / PUBLIC sin EXECUTE.
  SELECT array_agg(format('%s ↔ %s', r.rolname, p.proname) ORDER BY p.proname)
    INTO v_sin_permiso
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN (VALUES ('authenticated'), ('anon'), ('postgres')) AS r(rolname)
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'venta_embarque_mxn_neta',
      'nc_aplicadas_en_moneda_factura',
      'comision_embarques_de_factura'
    )
    AND r.rolname IN ('authenticated', 'anon')
    AND has_function_privilege(r.rolname, p.oid, 'EXECUTE');

  IF v_sin_permiso IS NOT NULL THEN
    RAISE EXCEPTION 'FIX3 REVOKE FAIL: helpers financieros aún ejecutables por roles de cliente: %', v_sin_permiso;
  END IF;

  -- 3: service_role conserva EXECUTE en los 3.
  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'venta_embarque_mxn_neta',
      'nc_aplicadas_en_moneda_factura',
      'comision_embarques_de_factura'
    )
  GROUP BY p.proname
  HAVING NOT bool_or(has_function_privilege('service_role', p.oid, 'EXECUTE'));

  IF FOUND THEN
    RAISE EXCEPTION 'FIX3 REVOKE FAIL: service_role perdió EXECUTE en alguno de los 3 helpers (las edges lo necesitan)';
  END IF;

  -- 4: el caller INVOKER (trigger de pagos_factura) ahora es DEFINER, si no
  -- el REVOKE rompería todo INSERT de cobro hecho por un usuario.
  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'assert_factura_viva_para_pago'
    AND p.prosecdef = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIX3 REVOKE FAIL: assert_factura_viva_para_pago debe ser SECURITY DEFINER para llamar al canon de NCs sin GRANT a authenticated';
  END IF;

  RAISE NOTICE 'FIX3 helpers financieros OK — authenticated/anon fuera, service_role dentro, caller interno DEFINER.';
END $$;

ROLLBACK;
