-- Drizzle0040: exact trigger ACLs and owner boundary, before/after CI grants.
DO $coordinador_acl$
DECLARE v_name text; v_oid oid; v_proc pg_catalog.pg_proc%ROWTYPE;
  v_owner oid := (SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.clientes'::regclass);
  v_role text;
BEGIN
  IF current_user <> 'postgres' OR session_user <> current_user
     OR v_owner IS DISTINCT FROM 'postgres'::regrole::oid THEN
    RAISE EXCEPTION 'CI_COORDINADOR_ACL: expected owner context';
  END IF;
  FOREACH v_name IN ARRAY ARRAY['public._cliente_coordinador_guard()', 'public._cotizacion_crear_handover()'] LOOP
    v_oid := pg_catalog.to_regprocedure(v_name);
    IF v_oid IS NULL THEN RAISE EXCEPTION 'CI_COORDINADOR_ACL: missing trigger function'; END IF;
    SELECT * INTO STRICT v_proc FROM pg_catalog.pg_proc WHERE oid=v_oid;
    IF v_proc.proowner IS DISTINCT FROM v_owner OR v_proc.prokind <> 'f'
      OR v_proc.prorettype <> 'pg_catalog.trigger'::regtype
      OR v_proc.prosecdef IS DISTINCT FROM (v_name='public._cotizacion_crear_handover()')
      OR v_proc.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
      OR v_proc.proacl IS NULL
      OR (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl))<>1
      OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a
        WHERE a.grantee<>v_owner OR a.grantor<>v_owner OR a.is_grantable OR a.privilege_type<>'EXECUTE') THEN
      RAISE EXCEPTION 'CI_COORDINADOR_ACL: exact private trigger boundary required: %',v_name;
    END IF;
    FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF pg_catalog.has_function_privilege(v_role,v_oid,'EXECUTE')
         OR pg_catalog.pg_has_role(v_role,v_owner,'MEMBER') THEN
        RAISE EXCEPTION 'CI_COORDINADOR_ACL: unexpected API owner membership or EXECUTE';
      END IF;
    END LOOP;
  END LOOP;
END $coordinador_acl$;
