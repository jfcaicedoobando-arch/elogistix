-- Run AFTER replay and BEFORE _ci_post_migrate.sql blanket grants.
-- This assertion reads the actual migrated catalog, with no grants or fixtures.
DO $pricing_container_catalog$
DECLARE
  v_oid oid := pg_catalog.to_regprocedure('public.crm_aplicar_tarifa_tarifario(uuid,uuid)');
  v_proc pg_catalog.pg_proc%ROWTYPE;
  v_owner oid := pg_catalog.to_regrole('postgres');
  v_auth oid := pg_catalog.to_regrole('authenticated');
  v_service oid := pg_catalog.to_regrole('service_role');
  v_anon oid := pg_catalog.to_regrole('anon');
  v_hash text;
BEGIN
  IF current_user <> 'postgres' OR session_user <> current_user
     OR v_owner IS NULL OR v_auth IS NULL OR v_service IS NULL OR v_anon IS NULL THEN
    RAISE EXCEPTION 'PRICING_CONTAINER_PRECONDITION: existing postgres owner and exact client roles required';
  END IF;
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'PRICING_CONTAINER_PRECONDITION: target must already exist';
  END IF;
  SELECT * INTO STRICT v_proc FROM pg_catalog.pg_proc WHERE oid=v_oid;
  IF v_proc.proowner IS DISTINCT FROM v_owner OR v_proc.prokind <> 'f'
     OR v_proc.pronamespace <> 'public'::regnamespace OR NOT v_proc.prosecdef
     OR v_proc.prolang <> (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
     OR v_proc.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
     OR v_proc.prorettype <> 'jsonb'::regtype OR v_proc.proretset
     OR v_proc.proisstrict OR v_proc.proleakproof
     OR v_proc.provolatile <> 'v' OR v_proc.proparallel <> 'u'
     OR v_proc.procost <> 100 OR v_proc.prorows <> 0 OR v_proc.prosupport <> 0
     OR v_proc.pronargs <> 2 OR v_proc.pronargdefaults <> 0
     OR v_proc.proargtypes <> '2950 2950'::oidvector
     OR v_proc.proargnames IS DISTINCT FROM ARRAY['p_solicitud_id','p_tarifa_id']::text[]
     OR v_proc.proallargtypes IS NOT NULL OR v_proc.proargmodes IS NOT NULL
     OR v_proc.proargdefaults IS NOT NULL OR v_proc.provariadic <> 0
     OR v_proc.probin IS NOT NULL OR v_proc.prosqlbody IS NOT NULL THEN
    RAISE EXCEPTION 'PRICING_CONTAINER_PRECONDITION: unexpected owner, signature or attributes';
  END IF;
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_proc.prosrc,'UTF8')),'hex');
  IF v_hash NOT IN ('30f6bf09d3098b3494ca1655b3dac6cfa1f71e185d5fbff1fa4117735a77b97e') THEN
    RAISE EXCEPTION 'PRICING_CONTAINER_PRECONDITION: unreviewed target body';
  END IF;
  IF v_proc.proacl IS NULL
     OR (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl)) <> 3
     OR EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a
       WHERE a.grantor <> v_owner OR a.is_grantable OR a.privilege_type <> 'EXECUTE'
          OR a.grantee NOT IN (v_owner,v_auth,v_service))
     OR (SELECT count(DISTINCT a.grantee) FROM pg_catalog.aclexplode(v_proc.proacl) a
       WHERE a.grantor=v_owner AND a.grantee IN (v_owner,v_auth,v_service)
         AND a.privilege_type='EXECUTE' AND NOT a.is_grantable) <> 3
     OR pg_catalog.has_function_privilege(v_anon,v_oid,'EXECUTE')
     OR pg_catalog.has_function_privilege(v_auth,v_oid,'EXECUTE WITH GRANT OPTION')
     OR pg_catalog.has_function_privilege(v_service,v_oid,'EXECUTE WITH GRANT OPTION')
     OR NOT pg_catalog.has_function_privilege(v_auth,v_oid,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(v_service,v_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'PRICING_CONTAINER_PRECONDITION: exact existing owner/authenticated/service_role ACL required';
  END IF;
END
$pricing_container_catalog$;
