-- Drizzle 0022 closes this trigger to clients. Check before harness grants and
-- after their removal; never let CI hide a replay permission regression.
DO $cotizacion_vendedor_acl$
DECLARE
  v_oid oid := pg_catalog.to_regprocedure('public._cotizacion_vendedor_misma_org()');
  v_proc pg_catalog.pg_proc%ROWTYPE;
  v_owner oid := pg_catalog.to_regrole('postgres');
  v_role text;
BEGIN
  IF current_user <> 'postgres' OR session_user <> current_user OR v_owner IS NULL
     OR pg_catalog.to_regrole('anon') IS NULL
     OR pg_catalog.to_regrole('authenticated') IS NULL
     OR pg_catalog.to_regrole('service_role') IS NULL OR v_oid IS NULL THEN
    RAISE EXCEPTION 'CI_COTIZACION_VENDEDOR_ACL: owner, roles and trigger required';
  END IF;
  SELECT * INTO STRICT v_proc FROM pg_catalog.pg_proc WHERE oid = v_oid;
  IF v_proc.proowner IS DISTINCT FROM v_owner OR v_proc.prokind <> 'f'
     OR v_proc.prorettype <> 'pg_catalog.trigger'::regtype OR NOT v_proc.prosecdef
     OR v_proc.proacl IS NULL
     OR (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl)) <> 1
     OR EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a
       WHERE a.grantor <> v_owner OR a.grantee <> v_owner
         OR a.is_grantable OR a.privilege_type <> 'EXECUTE') THEN
    RAISE EXCEPTION 'CI_COTIZACION_VENDEDOR_ACL: exact owner-only definer trigger required';
  END IF;
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF pg_catalog.has_function_privilege(v_role, v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'CI_COTIZACION_VENDEDOR_ACL: unexpected EXECUTE for %', v_role;
    END IF;
  END LOOP;
END
$cotizacion_vendedor_acl$;
