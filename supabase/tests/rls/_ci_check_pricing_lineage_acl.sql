-- Run before blanket grants and after the exact Pricing lineage re-closure.
-- Read-only catalog assertion: never repairs or masks a migration ACL leak.
DO $pricing_lineage_disabled_acl$
DECLARE
  v_signature text;
  v_oid oid;
  v_proc pg_catalog.pg_proc%ROWTYPE;
  v_owner oid := pg_catalog.to_regrole('postgres');
  v_role text;
BEGIN
  IF current_user <> 'postgres' OR session_user <> current_user OR v_owner IS NULL
     OR pg_catalog.to_regrole('anon') IS NULL
     OR pg_catalog.to_regrole('authenticated') IS NULL
     OR pg_catalog.to_regrole('service_role') IS NULL THEN
    RAISE EXCEPTION 'CI_PRICING_LINEAGE_ACL: exact owner and client roles required';
  END IF;
  FOREACH v_signature IN ARRAY ARRAY[
    'public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)',
    'public.guard_cotizacion_origen_pricing()'
  ] LOOP
    v_oid := pg_catalog.to_regprocedure(v_signature);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'CI_PRICING_LINEAGE_ACL: missing function %', v_signature;
    END IF;
    SELECT * INTO STRICT v_proc FROM pg_catalog.pg_proc WHERE oid = v_oid;
    IF v_proc.proowner IS DISTINCT FROM v_owner OR v_proc.prokind <> 'f'
       OR v_proc.proacl IS NULL
       OR (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl)) <> 1
       OR EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a
         WHERE a.grantor <> v_owner OR a.grantee <> v_owner
           OR a.is_grantable OR a.privilege_type <> 'EXECUTE') THEN
      RAISE EXCEPTION 'CI_PRICING_LINEAGE_ACL: exact owner-only ACL required for %', v_signature;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF pg_catalog.has_function_privilege(v_role, v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'CI_PRICING_LINEAGE_ACL: unexpected EXECUTE for % on %', v_role, v_signature;
      END IF;
    END LOOP;
  END LOOP;
END
$pricing_lineage_disabled_acl$;
