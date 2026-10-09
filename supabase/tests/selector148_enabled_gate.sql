BEGIN;
DO $selector148_enabled_guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid=pg_catalog.to_regprocedure('public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)')
      AND (p.pronamespace = 'public'::regnamespace
    AND p.proname = 'seguro_facturas_elegibles'
    AND p.proowner = 'postgres'::regrole
    AND p.prolang = (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
    AND p.prokind = 'f' AND p.provolatile = 's' AND p.prosecdef
    AND NOT p.proretset AND NOT p.proisstrict AND NOT p.proleakproof
    AND p.proparallel = 'u' AND p.procost = 100 AND p.prorows = 0
    AND p.prosupport = 0
    AND p.prorettype = 'jsonb'::regtype
    AND p.pronargs = 7 AND p.pronargdefaults = 4
    AND p.proargtypes = '2950 1700 25 2950 23 1082 2950'::oidvector
    AND p.proallargtypes IS NULL AND p.proargmodes IS NULL
    AND p.provariadic = 0 AND p.protrftypes IS NULL AND p.prosqlbody IS NULL
    AND p.proargnames = ARRAY['p_embarque_id','p_prima','p_moneda','p_seguro_id','p_limit','p_cursor_fecha','p_cursor_id']::text[]
    AND pg_catalog.pg_get_expr(p.proargdefaults,0) = 'NULL::uuid, 25, NULL::date, NULL::uuid'
    AND p.proconfig = ARRAY['search_path=pg_catalog, public']::text[]) IS TRUE
      AND ((pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')='b3f26ef5a798ee04f243c3039ebd5ff0b548b07c75c39ebcba305fd6c4c14dc9' AND ((SELECT count(*) = 2 AND bool_and((
      a.grantor = p.proowner AND a.privilege_type = 'EXECUTE' AND NOT a.is_grantable
      AND a.grantee IN (p.proowner, 'authenticated'::regrole)
    ) IS TRUE) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a)
    AND pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') IS TRUE
    AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
    AND NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')))) IS TRUE
  ) THEN
    RAISE EXCEPTION 'LC_SELECTOR148_FUNCTION_CONTRACT_DRIFT';
  END IF;
END $selector148_enabled_guard$;
DO $guard_notice$ BEGIN RAISE NOTICE 'PASS: enabled selector exact source metadata and narrow effective ACL'; END $guard_notice$;
ROLLBACK;
