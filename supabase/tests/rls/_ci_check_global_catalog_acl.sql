-- Fail-closed assertion of effective catalog ACLs, before/after CI fixture grants.
-- Read-only: no repair here, so an omitted/reverted migration stays red.
DO $catalog_acl$
DECLARE
  t text;
  p text;
  c record;
  allowed boolean;
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'planes'
      AND policyname = 'Authenticated read planes' AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[] AND permissive = 'PERMISSIVE'
      AND qual = '(activo IS TRUE)' AND with_check IS NULL
  ) THEN RAISE EXCEPTION 'GLOBAL_CATALOG_PLAN_POLICY_DRIFT'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'planes'
      AND policyname = 'Super admin CRUD planes' AND cmd = 'ALL'
      AND roles = ARRAY['authenticated']::name[] AND permissive = 'PERMISSIVE'
      AND qual LIKE '%has_role%super_admin%' AND with_check LIKE '%has_role%super_admin%'
  ) THEN RAISE EXCEPTION 'GLOBAL_CATALOG_SUPER_ADMIN_POLICY_DRIFT'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.tc_dof_upsert_manual(date,numeric,numeric)', 'EXECUTE')
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.tc_dof_upsert_manual(date,numeric,numeric)'::regprocedure) THEN
    RAISE EXCEPTION 'GLOBAL_CATALOG_DOF_RPC_DRIFT';
  END IF;
END
$catalog_acl$;
