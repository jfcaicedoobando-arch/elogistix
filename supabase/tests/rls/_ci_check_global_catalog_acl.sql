-- Fail-closed assertion of effective catalog ACLs, before/after CI fixture grants.
-- Read-only: no repair here, so an omitted/reverted migration stays red.
DO $catalog_acl$
DECLARE
  t text;
  p text;
  c record;
  allowed boolean;
  v_previous_search_path text := current_setting('search_path');
BEGIN
  FOREACH t IN ARRAY ARRAY['planes','navieras','puertos','tipos_contenedor','tipos_cambio_dof'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'GLOBAL_CATALOG_MISSING: %', t;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'GLOBAL_CATALOG_RLS_DISABLED: %', t;
    END IF;
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      IF has_table_privilege('anon', 'public.' || t, p) THEN
        RAISE EXCEPTION 'GLOBAL_CATALOG_ANON_GRANT: %.%', t, p;
      END IF;
      allowed := p = 'SELECT' OR (t <> 'tipos_cambio_dof' AND p IN ('INSERT','UPDATE','DELETE'));
      -- Legacy CI replay lacks some positive grants until its fixture phase.
      -- Never repair or tolerate a prohibited privilege here.
      IF NOT allowed AND has_table_privilege('authenticated', 'public.' || t, p) THEN
        RAISE EXCEPTION 'GLOBAL_CATALOG_AUTH_GRANT: %.% forbidden', t, p;
      END IF;
      IF p = 'SELECT' AND NOT has_table_privilege('authenticated', 'public.' || t, p) THEN
        RAISE EXCEPTION 'GLOBAL_CATALOG_AUTH_SELECT_MISSING: %', t;
      END IF;
    END LOOP;
    FOR c IN SELECT attname FROM pg_attribute WHERE attrelid = ('public.' || t)::regclass AND attnum > 0 AND NOT attisdropped LOOP
      FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','REFERENCES'] LOOP
        IF has_column_privilege('anon', 'public.' || t, c.attname, p) THEN
          RAISE EXCEPTION 'GLOBAL_CATALOG_ANON_COLUMN_GRANT: %.%.%', t, c.attname, p;
        END IF;
        IF (p = 'REFERENCES' OR (t = 'tipos_cambio_dof' AND p IN ('INSERT','UPDATE')))
          AND has_column_privilege('authenticated', 'public.' || t, c.attname, p) THEN
          RAISE EXCEPTION 'GLOBAL_CATALOG_AUTH_COLUMN_GRANT: %.%.%', t, c.attname, p;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  -- Exact reviewed policy set, not a substring or existence-only test.
  -- Fix deparse name visibility; normalize whitespace only, never SQL tokens.
  -- EXCEPT in both directions rejects missing, altered AND additional policies.
  PERFORM pg_catalog.set_config('search_path', 'pg_catalog, public', true);
  IF EXISTS (
   WITH expected(tablename,policyname,cmd,roles,permissive,qual,with_check) AS (VALUES
    ('planes', 'Authenticated read planes', 'SELECT', ARRAY['authenticated']::name[], 'PERMISSIVE', '(activo IS TRUE)', NULL::text),
    ('planes', 'Super admin CRUD planes', 'ALL', ARRAY['authenticated']::name[], 'PERMISSIVE', '( SELECT has_role(( SELECT auth.uid() AS uid), ''super_admin''::app_role) AS has_role)', '( SELECT has_role(( SELECT auth.uid() AS uid), ''super_admin''::app_role) AS has_role)'),
    ('navieras', 'Autenticados pueden leer navieras', 'SELECT', ARRAY['authenticated']::name[], 'PERMISSIVE', 'true', NULL::text),
    ('navieras', 'Gerente operaciones y admins dan de alta navieras', 'INSERT', ARRAY['authenticated']::name[], 'PERMISSIVE', NULL::text, '(( SELECT has_role(( SELECT auth.uid() AS uid), ''admin''::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), ''gerente_operaciones''::app_role) AS has_role))'),
    ('navieras', 'Super admin CRUD navieras', 'ALL', ARRAY['authenticated']::name[], 'PERMISSIVE', '( SELECT has_role(( SELECT auth.uid() AS uid), ''super_admin''::app_role) AS has_role)', '( SELECT has_role(( SELECT auth.uid() AS uid), ''super_admin''::app_role) AS has_role)'),
    ('puertos', 'Autenticados pueden leer puertos', 'SELECT', ARRAY['authenticated']::name[], 'PERMISSIVE', 'true', NULL::text),
    ('puertos', 'Gerente operaciones y admins dan de alta puertos', 'INSERT', ARRAY['authenticated']::name[], 'PERMISSIVE', NULL::text, '(( SELECT has_role(( SELECT auth.uid() AS uid), ''admin''::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), ''gerente_operaciones''::app_role) AS has_role))'),
    ('puertos', 'Super admin CRUD puertos', 'ALL', ARRAY['authenticated']::name[], 'PERMISSIVE', '( SELECT has_role(( SELECT auth.uid() AS uid), ''super_admin''::app_role) AS has_role)', '( SELECT has_role(( SELECT auth.uid() AS uid), ''super_admin''::app_role) AS has_role)'),
    ('tipos_contenedor', 'Autenticados pueden leer tipos_contenedor', 'SELECT', ARRAY['authenticated']::name[], 'PERMISSIVE', 'true', NULL::text),
    ('tipos_contenedor', 'Gerente operaciones y admins dan de alta tipos_contenedor', 'INSERT', ARRAY['authenticated']::name[], 'PERMISSIVE', NULL::text, '(( SELECT has_role(( SELECT auth.uid() AS uid), ''admin''::app_role) AS has_role) OR ( SELECT has_role(( SELECT auth.uid() AS uid), ''gerente_operaciones''::app_role) AS has_role))'),
    ('tipos_contenedor', 'Super admin CRUD tipos_contenedor', 'ALL', ARRAY['authenticated']::name[], 'PERMISSIVE', '( SELECT has_role(( SELECT auth.uid() AS uid), ''super_admin''::app_role) AS has_role)', '( SELECT has_role(( SELECT auth.uid() AS uid), ''super_admin''::app_role) AS has_role)'),
    ('tipos_cambio_dof', 'tc_dof_all_service_role', 'ALL', ARRAY['service_role']::name[], 'PERMISSIVE', 'true', 'true'),
    ('tipos_cambio_dof', 'tc_dof_select_authenticated', 'SELECT', ARRAY['authenticated']::name[], 'PERMISSIVE', 'true', NULL::text)
   ), actual AS (
    SELECT tablename::text,policyname::text,cmd::text,roles,permissive::text,
      regexp_replace(qual,'[[:space:]]+',' ','g'),
      regexp_replace(with_check,'[[:space:]]+',' ','g')
    FROM pg_catalog.pg_policies
    WHERE schemaname='public'
      AND tablename IN ('planes','navieras','puertos','tipos_contenedor','tipos_cambio_dof')
   )
   SELECT 1 FROM (
    (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    UNION ALL
    (SELECT * FROM expected EXCEPT SELECT * FROM actual)
   ) drift
  ) THEN RAISE EXCEPTION 'GLOBAL_CATALOG_EXACT_POLICY_SET_DRIFT'; END IF;
  PERFORM pg_catalog.set_config('search_path', v_previous_search_path, true);
  IF NOT has_function_privilege('authenticated', 'public.tc_dof_upsert_manual(date,numeric,numeric)', 'EXECUTE')
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.tc_dof_upsert_manual(date,numeric,numeric)'::regprocedure) THEN
    RAISE EXCEPTION 'GLOBAL_CATALOG_DOF_RPC_DRIFT';
  END IF;
END
$catalog_acl$;
