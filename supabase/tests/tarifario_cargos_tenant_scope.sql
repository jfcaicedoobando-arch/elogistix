-- Ordinary rollback-only fixtures: normal/pricing roles and super admin with
-- active, different and absent tenant. No historical data is rewritten.
BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $test$
DECLARE
  orgs record;
  super_id uuid := gen_random_uuid();
  reader_id uuid := gen_random_uuid();
  prov_a uuid := gen_random_uuid(); prov_b uuid := gen_random_uuid();
  agent_a uuid := gen_random_uuid(); agent_b uuid := gen_random_uuid();
  nav uuid := gen_random_uuid(); row_a uuid; row_b uuid;
  table_name text; parent_column text; parent_a uuid; parent_b uuid;
  n integer; changed integer; expected_using text; expected_check text;
BEGIN
  SELECT pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)
  INTO STRICT expected_using,expected_check FROM pg_policy
  WHERE polrelid='public.comisiones_recuperaciones'::regclass
    AND polname='Scope tenant activo super admin';
  -- Fail before fixtures if the migration is missing; no conditional skips.
  FOREACH table_name IN ARRAY ARRAY['costeo_cargos_fob_agente','costeo_cargos_locales_naviera'] LOOP
    SELECT count(*) INTO n FROM pg_policy
    WHERE polrelid=('public.'||table_name)::regclass
      AND polname=table_name||'_tenant_restrictive' AND NOT polpermissive
      AND polcmd='*' AND polroles=ARRAY['authenticated'::regrole::oid]
      AND pg_get_expr(polqual,polrelid)=expected_using
      AND pg_get_expr(polwithcheck,polrelid)=expected_check;
    IF n<>1 THEN RAISE EXCEPTION 'Missing exact restrictive tenant contract: %',table_name; END IF;
    SELECT count(*) INTO n FROM pg_policy
    WHERE polrelid=('public.'||table_name)::regclass AND polpermissive;
    IF n<>3 THEN RAISE EXCEPTION 'Original permissive policies changed: %',table_name; END IF;
  END LOOP;

  SELECT * INTO STRICT orgs FROM pg_temp.seed_org_pair('TARIFARIO-SCOPE');
  INSERT INTO auth.users(id,email) VALUES (super_id,'tarifario-sa@test.local'),(reader_id,'tarifario-reader@test.local');
  INSERT INTO public.user_roles(user_id,role) VALUES (super_id,'super_admin'),(reader_id,'contador');
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES (orgs.org_a,reader_id,'contador');
  INSERT INTO public.proveedores(id,organization_id,nombre,tipo,categoria) VALUES
    (prov_a,orgs.org_a,'Agente scope A','Agente de Carga','Logistico'),
    (prov_b,orgs.org_b,'Agente scope B','Agente de Carga','Logistico');
  INSERT INTO public.costeo_agentes(id,organization_id,proveedor_id,nombre) VALUES
    (agent_a,orgs.org_a,prov_a,'Scope A'),(agent_b,orgs.org_b,prov_b,'Scope B');
  INSERT INTO public.navieras(id,code,name) VALUES (nav,'TS-'||left(nav::text,8),'Scope carrier');

  FOREACH table_name IN ARRAY ARRAY['costeo_cargos_fob_agente','costeo_cargos_locales_naviera'] LOOP
    PERFORM pg_temp.as_postgres();
    -- Test-only fault injection: a permissive super-admin policy must not
    -- bypass the independent restrictive gate. ROLLBACK removes it.
    EXECUTE format('CREATE POLICY fixture_super_admin_permissive ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), %L::public.app_role)) WITH CHECK (public.has_role(auth.uid(), %L::public.app_role))',table_name,'super_admin','super_admin');
    parent_column:=CASE WHEN table_name='costeo_cargos_fob_agente' THEN 'agente_id' ELSE 'naviera_id' END;
    parent_a:=CASE WHEN parent_column='agente_id' THEN agent_a ELSE nav END;
    parent_b:=CASE WHEN parent_column='agente_id' THEN agent_b ELSE nav END;
    row_a:=gen_random_uuid(); row_b:=gen_random_uuid();
    EXECUTE format('INSERT INTO public.%I(id,organization_id,%I,monto) VALUES ($1,$2,$3,1),($4,$5,$6,1)',table_name,parent_column)
      USING row_a,orgs.org_a,parent_a,row_b,orgs.org_b,parent_b;

    -- Normal admin/pricing permissions remain scoped to their own company.
    PERFORM pg_temp.as_user(orgs.admin_a);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN ($1,$2)',table_name) INTO n USING row_a,row_b;
    PERFORM pg_temp.assert(n=1,table_name||': normal admin lost own row or saw foreign row');
    EXECUTE format('UPDATE public.%I SET monto=2 WHERE id=$1',table_name) USING row_a;
    GET DIAGNOSTICS changed=ROW_COUNT;
    PERFORM pg_temp.assert(changed=1,table_name||': normal authorized update was denied');
    PERFORM pg_temp.assert_insert_blocked(format('INSERT INTO public.%I(organization_id,%I,monto) VALUES (%L,%L,1)',table_name,parent_column,orgs.org_b,parent_b),table_name||': normal cross-company insert');

    -- An authenticated non-pricing role retains read access, not write access.
    PERFORM pg_temp.as_user(reader_id);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN ($1,$2)',table_name) INTO n USING row_a,row_b;
    PERFORM pg_temp.assert(n=1,table_name||': reader scope changed');
    EXECUTE format('UPDATE public.%I SET monto=3 WHERE id=$1',table_name) USING row_a;
    GET DIAGNOSTICS changed=ROW_COUNT;
    PERFORM pg_temp.assert(changed=0,table_name||': non-pricing role gained write access');
    PERFORM pg_temp.assert_insert_blocked(format('INSERT INTO public.%I(organization_id,%I,monto) VALUES (%L,%L,1)',table_name,parent_column,orgs.org_a,parent_a),table_name||': non-pricing insert');

    PERFORM pg_temp.as_user(super_id);
    PERFORM public.set_super_admin_org(NULL);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN ($1,$2)',table_name) INTO n USING row_a,row_b;
    PERFORM pg_temp.assert(n=0,table_name||': super admin without active tenant saw business rows');
    PERFORM pg_temp.assert_insert_blocked(format('INSERT INTO public.%I(organization_id,%I,monto) VALUES (%L,%L,1)',table_name,parent_column,orgs.org_a,parent_a),table_name||': super admin without active tenant inserted');

    PERFORM public.set_super_admin_org(orgs.org_a);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',table_name) INTO n USING row_a;
    PERFORM pg_temp.assert(n=1,table_name||': super admin active A lost A');
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',table_name) INTO n USING row_b;
    PERFORM pg_temp.assert(n=0,table_name||': super admin active A saw B');
    EXECUTE format('UPDATE public.%I SET monto=5 WHERE id=$1',table_name) USING row_a;
    GET DIAGNOSTICS changed=ROW_COUNT;
    PERFORM pg_temp.assert(changed=1,table_name||': super admin cannot update active A');
    BEGIN
      EXECUTE format('UPDATE public.%I SET organization_id=$1 WHERE id=$2',table_name) USING orgs.org_b,row_a;
      RAISE EXCEPTION 'TEST FAIL: super admin moved an active-A row into inactive B: %',table_name;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- Expected WITH CHECK rejection, not an unrelated fixture error.
    END;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1 AND organization_id=$2',table_name) INTO n USING row_a,orgs.org_a;
    PERFORM pg_temp.assert(n=1,table_name||': rejected cross-tenant UPDATE changed the original row');
    EXECUTE format('UPDATE public.%I SET monto=4 WHERE id=$1',table_name) USING row_b;
    GET DIAGNOSTICS changed=ROW_COUNT;
    PERFORM pg_temp.assert(changed=0,table_name||': super admin updated inactive B');
    PERFORM pg_temp.assert_insert_blocked(format('INSERT INTO public.%I(organization_id,%I,monto) VALUES (%L,%L,1)',table_name,parent_column,orgs.org_b,parent_b),table_name||': super admin active A inserted B');
    EXECUTE format('INSERT INTO public.%I(organization_id,%I,monto) VALUES ($1,$2,1)',table_name,parent_column) USING orgs.org_a,parent_a;

    PERFORM public.set_super_admin_org(orgs.org_b);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN ($1,$2)',table_name) INTO n USING row_a,row_b;
    PERFORM pg_temp.assert(n=1,table_name||': tenant switch lost B or retained A');
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id=$1',table_name) INTO n USING row_a;
    PERFORM pg_temp.assert(n=0,table_name||': inactive A remains visible');
    PERFORM public.set_super_admin_org(NULL);
    EXECUTE format('SELECT count(*) FROM public.%I WHERE id IN ($1,$2)',table_name) INTO n USING row_a,row_b;
    PERFORM pg_temp.assert(n=0,table_name||': clearing active tenant did not fail closed');
  END LOOP;
  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'PASS tarifario tenant scope: exact policies, normal roles, active/switch/absent super-admin tenant';
END $test$;
ROLLBACK;
