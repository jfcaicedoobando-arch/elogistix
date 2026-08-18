DO $$
DECLARE
  r         record;
  v_expr    text;
  v_total   int := 0;
BEGIN
  v_expr := '(NOT (SELECT public.has_role((SELECT auth.uid()), ''super_admin''::public.app_role)))'
         || ' OR public.rls_tenant_scope_ok(organization_id)';

  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND permissive = 'RESTRICTIVE'
      AND cmd = 'ALL'
      AND qual = 'rls_tenant_scope_ok(organization_id)'
      AND with_check = 'rls_tenant_scope_ok(organization_id)'
    ORDER BY tablename, policyname
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
      r.policyname, r.tablename, v_expr, v_expr
    );
    v_total := v_total + 1;
  END LOOP;

  RAISE NOTICE 'PERF-01: % politicas RESTRICTIVE de tenant reescritas con corto-circuito InitPlan', v_total;
END $$;

DO $$
DECLARE v_faltan text[];
BEGIN
  SELECT coalesce(array_agg(c.relname::text ORDER BY c.relname), '{}')
    INTO v_faltan
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
                     AND a.attname = 'organization_id'
                     AND a.attnum > 0
                     AND NOT a.attisdropped
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT IN (
      'app_logs', 'nav_events', 'provisioning_log', 'role_change_log',
      'super_admin_org_activa', 'organization_members', 'client_users',
      'agente_users', 'facturapi_webhook_eventos'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = c.oid
        AND p.polpermissive = false
        AND pg_get_expr(p.polqual, p.polrelid) LIKE '%rls_tenant_scope_ok%'
    );

  IF array_length(v_faltan, 1) > 0 THEN
    RAISE EXCEPTION 'PERF-01 REGRESION: tablas sin politica de tenant activo: %', v_faltan;
  END IF;
END $$;