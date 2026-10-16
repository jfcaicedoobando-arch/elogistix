-- Global catalogs: SQL roles are separate from application roles.
-- Synthetic fixtures only; all work is rolled back, including DOF RPC writes.
BEGIN;
\i supabase/tests/rls/_helpers.sql
\ir _ci_check_global_catalog_acl.sql

CREATE FUNCTION pg_temp.catalog_denied(statement text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN insufficient_privilege THEN RETURN;
  END;
  RAISE EXCEPTION 'GLOBAL_CATALOG_EXPECTED_42501: %', statement;
END $$;

DO $catalog_rls$
DECLARE
  active_plan uuid := gen_random_uuid();
  retired_plan uuid := gen_random_uuid();
  nav uuid := gen_random_uuid();
  port uuid := gen_random_uuid();
  container uuid := gen_random_uuid();
  uid uuid;
  sa uuid;
  role_name public.app_role;
  t text;
  item uuid;
  new_id uuid;
  label text;
  n bigint;
  probe_date date := DATE '1901-01-01';
BEGIN
  INSERT INTO public.planes(id,nombre,activo) VALUES
    (active_plan,'catalog-rls-active',true),(retired_plan,'catalog-rls-retired',false);
  INSERT INTO public.navieras(id,code,name) VALUES(nav,'CRN-' || nav::text,'catalog-rls-naviera');
  INSERT INTO public.puertos(id,code,name,country) VALUES(port,'CRP-' || port::text,'catalog-rls-puerto','MX');
  INSERT INTO public.tipos_contenedor(id,code,name) VALUES(container,'CRT-' || container::text,'catalog-rls-tipo');
  INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn,eur_mxn) VALUES(probe_date,20,21)
    ON CONFLICT(fecha) DO UPDATE SET usd_mxn=20,eur_mxn=21;

  PERFORM set_config('role','anon',true);
  FOREACH t IN ARRAY ARRAY['planes','navieras','puertos','tipos_contenedor','tipos_cambio_dof'] LOOP
    PERFORM pg_temp.catalog_denied(format('SELECT * FROM public.%I',t));
    PERFORM pg_temp.catalog_denied(format('TRUNCATE public.%I',t));
    IF t='planes' THEN
      PERFORM pg_temp.catalog_denied($q$INSERT INTO public.planes(nombre) VALUES('anon-denied')$q$);
    ELSIF t='tipos_cambio_dof' THEN
      PERFORM pg_temp.catalog_denied(format('INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn) VALUES(%L,22)',probe_date+1));
    ELSE
      PERFORM pg_temp.catalog_denied(format('INSERT INTO public.%I(code,name%s) VALUES(%L,%L%s)',t,
        CASE WHEN t='puertos' THEN ',country' ELSE '' END,'anon-denied','anon-denied',
        CASE WHEN t='puertos' THEN ',''MX''' ELSE '' END));
    END IF;
    RAISE NOTICE 'CATALOG_MATRIX role=anon table=% SELECT=deny INSERT=deny TRUNCATE=deny',t;
  END LOOP;
  PERFORM pg_temp.as_postgres();

  FOREACH role_name IN ARRAY enum_range(NULL::public.app_role) LOOP
    uid := gen_random_uuid();
    INSERT INTO auth.users(id,email,raw_user_meta_data)
      VALUES(uid,'catalog-' || uid::text || '@fixture.invalid','{"skip_auto_org":true}'::jsonb);
    -- Existing legacy assignments remain readable, but new legacy INSERTs are
    -- prohibited by the production trigger. Seed a modern role, then model a
    -- historical assignment in this rollback-only fixture without disabling it.
    INSERT INTO public.user_roles(user_id,role) VALUES(uid,'customer_service')
      ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role;
    UPDATE public.user_roles SET role=role_name WHERE user_id=uid;
    IF role_name='super_admin' THEN sa:=uid; END IF;
    PERFORM pg_temp.as_user(uid);
    SELECT count(*) INTO n FROM public.planes WHERE id IN(active_plan,retired_plan);
    IF n IS DISTINCT FROM (CASE WHEN role_name='super_admin' THEN 2 ELSE 1 END) THEN
      RAISE EXCEPTION 'GLOBAL_CATALOG_PLAN_VISIBILITY: % count %',role_name,n;
    END IF;
    IF role_name <> 'super_admin' THEN
      SELECT count(*) INTO n FROM public.planes WHERE id=retired_plan;
      IF n<>0 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_INACTIVE_PLAN_LEAK: %',role_name; END IF;
    END IF;
    SELECT count(*) INTO n FROM public.navieras WHERE id=nav;
    IF n<>1 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_NAV_READ: %',role_name; END IF;
    SELECT count(*) INTO n FROM public.puertos WHERE id=port;
    IF n<>1 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_PORT_READ: %',role_name; END IF;
    SELECT count(*) INTO n FROM public.tipos_contenedor WHERE id=container;
    IF n<>1 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_CONTAINER_READ: %',role_name; END IF;
    SELECT count(*) INTO n FROM public.tipos_cambio_dof WHERE fecha=probe_date;
    IF n<>1 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_DOF_READ: %',role_name; END IF;
    -- security_invoker view still resolves its catalog dependencies for clients.
    PERFORM 1 FROM public.costeo_tarifas_vigentes_v LIMIT 1;

    IF role_name <> 'super_admin' THEN
      FOREACH t IN ARRAY ARRAY['planes','navieras','puertos','tipos_contenedor'] LOOP
        item := CASE t WHEN 'planes' THEN active_plan WHEN 'navieras' THEN nav WHEN 'puertos' THEN port ELSE container END;
        label := CASE t WHEN 'planes' THEN 'nombre' ELSE 'name' END;
        EXECUTE format('UPDATE public.%I SET %I=%I WHERE id=$1',t,label,label) USING item;
        GET DIAGNOSTICS n=ROW_COUNT;
        IF n<>0 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_WRITE_LEAK: % % UPDATE',role_name,t; END IF;
        EXECUTE format('DELETE FROM public.%I WHERE id=$1',t) USING item;
        GET DIAGNOSTICS n=ROW_COUNT;
        IF n<>0 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_WRITE_LEAK: % % DELETE',role_name,t; END IF;
        IF t='planes' THEN
          PERFORM pg_temp.catalog_denied($q$INSERT INTO public.planes(nombre) VALUES('denied')$q$);
        ELSIF role_name IN ('admin','admin_org','gerente_operaciones') THEN
          -- Drizzle 0015 changes only INSERT in these three global catalogs.
          -- has_role('admin') preserves the existing admin_org inheritance.
          new_id:=gen_random_uuid();
          EXECUTE format('INSERT INTO public.%I(id,code,name%s) VALUES($1,$2,$3%s)',t,
            CASE WHEN t='puertos' THEN ',country' ELSE '' END, CASE WHEN t='puertos' THEN ',''MX''' ELSE '' END)
            USING new_id,'allowed-' || uid::text,'catalog-0015';
          GET DIAGNOSTICS n=ROW_COUNT;
          IF n<>1 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_0015_INSERT: % %',role_name,t; END IF;
          -- The creator still cannot UPDATE or DELETE even their new row.
          EXECUTE format('UPDATE public.%I SET name=name WHERE id=$1',t) USING new_id;
          GET DIAGNOSTICS n=ROW_COUNT;
          IF n<>0 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_0015_UPDATE_LEAK: % %',role_name,t; END IF;
          EXECUTE format('DELETE FROM public.%I WHERE id=$1',t) USING new_id;
          GET DIAGNOSTICS n=ROW_COUNT;
          IF n<>0 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_0015_DELETE_LEAK: % %',role_name,t; END IF;
        ELSE
          PERFORM pg_temp.catalog_denied(format('INSERT INTO public.%I(code,name%s) VALUES(%L,%L%s)',t,
            CASE WHEN t='puertos' THEN ',country' ELSE '' END,'denied-' || uid::text,'denied',
            CASE WHEN t='puertos' THEN ',''MX''' ELSE '' END));
        END IF;
        RAISE NOTICE 'CATALOG_MATRIX role=% table=% INSERT=% UPDATE=deny DELETE=deny',role_name,t,
          CASE WHEN t<>'planes' AND role_name IN ('admin','admin_org','gerente_operaciones') THEN 'allow' ELSE 'deny' END;
      END LOOP;
      PERFORM pg_temp.catalog_denied(format('SELECT public.tc_dof_upsert_manual(%L,22,23)',probe_date));
    END IF;
    -- Direct DOF writes are denied even to an application super_admin.
    PERFORM pg_temp.catalog_denied(format('INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn) VALUES(%L,22)',probe_date+1));
    PERFORM pg_temp.catalog_denied(format('UPDATE public.tipos_cambio_dof SET usd_mxn=22 WHERE fecha=%L',probe_date));
    PERFORM pg_temp.catalog_denied(format('DELETE FROM public.tipos_cambio_dof WHERE fecha=%L',probe_date));
    RAISE NOTICE 'CATALOG_MATRIX role=% table=tipos_cambio_dof INSERT=deny UPDATE=deny DELETE=deny',role_name;
    PERFORM pg_temp.as_postgres();
  END LOOP;
  IF sa IS NULL THEN RAISE EXCEPTION 'GLOBAL_CATALOG_NO_SUPER_ADMIN_FIXTURE'; END IF;
  PERFORM pg_temp.as_user(sa);
  FOREACH t IN ARRAY ARRAY['planes','navieras','puertos','tipos_contenedor'] LOOP
    new_id:=gen_random_uuid();
    IF t='planes' THEN
      INSERT INTO public.planes(id,nombre,activo) VALUES(new_id,'sa-retired',false);
    ELSE
      EXECUTE format('INSERT INTO public.%I(id,code,name%s) VALUES($1,$2,$3%s)',t,
        CASE WHEN t='puertos' THEN ',country' ELSE '' END, CASE WHEN t='puertos' THEN ',''MX''' ELSE '' END)
        USING new_id,'SA-' || new_id::text,'sa-catalog';
    END IF;
    label:=CASE t WHEN 'planes' THEN 'nombre' ELSE 'name' END;
    EXECUTE format('UPDATE public.%I SET %I=$1 WHERE id=$2',t,label) USING 'sa-updated',new_id;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>1 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_SA_UPDATE: %',t; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE id=$1',t) USING new_id;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>1 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_SA_DELETE: %',t; END IF;
    PERFORM pg_temp.catalog_denied(format('TRUNCATE public.%I',t));
    RAISE NOTICE 'CATALOG_MATRIX role=super_admin table=% INSERT=allow UPDATE=allow DELETE=allow TRUNCATE=deny',t;
  END LOOP;
  PERFORM public.tc_dof_upsert_manual(probe_date,22,23);
  SELECT count(*) INTO n FROM public.tipos_cambio_dof WHERE fecha=probe_date AND usd_mxn=22 AND eur_mxn=23 AND origen='manual';
  IF n<>1 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_SA_DOF_RPC'; END IF;
  PERFORM pg_temp.as_postgres();
  -- JWT without a matching application role remains limited to active plans.
  PERFORM pg_temp.as_user(gen_random_uuid());
  SELECT count(*) INTO n FROM public.planes WHERE id IN(active_plan,retired_plan);
  IF n<>1 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_UNKNOWN_USER_VISIBILITY'; END IF;
  FOREACH t IN ARRAY ARRAY['planes','navieras','puertos','tipos_contenedor'] LOOP
    item:=CASE t WHEN 'planes' THEN active_plan WHEN 'navieras' THEN nav WHEN 'puertos' THEN port ELSE container END;
    label:=CASE t WHEN 'planes' THEN 'nombre' ELSE 'name' END;
    EXECUTE format('UPDATE public.%I SET %I=%I WHERE id=$1',t,label,label) USING item;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>0 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_UNKNOWN_USER_UPDATE: %',t; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE id=$1',t) USING item;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>0 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_UNKNOWN_USER_DELETE: %',t; END IF;
    IF t='planes' THEN
      PERFORM pg_temp.catalog_denied($q$INSERT INTO public.planes(nombre) VALUES('unknown-denied')$q$);
    ELSE
      PERFORM pg_temp.catalog_denied(format('INSERT INTO public.%I(code,name%s) VALUES(%L,%L%s)',t,
        CASE WHEN t='puertos' THEN ',country' ELSE '' END,'unknown-denied','unknown-denied',
        CASE WHEN t='puertos' THEN ',''MX''' ELSE '' END));
    END IF;
    RAISE NOTICE 'CATALOG_MATRIX role=no_application_role table=% INSERT=deny UPDATE=deny DELETE=deny',t;
  END LOOP;
  PERFORM pg_temp.catalog_denied(format('INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn) VALUES(%L,22)',probe_date+1));
  PERFORM pg_temp.catalog_denied(format('UPDATE public.tipos_cambio_dof SET usd_mxn=22 WHERE fecha=%L',probe_date));
  PERFORM pg_temp.catalog_denied(format('DELETE FROM public.tipos_cambio_dof WHERE fecha=%L',probe_date));
  PERFORM pg_temp.catalog_denied(format('SELECT public.tc_dof_upsert_manual(%L,22,23)',probe_date));
  RAISE NOTICE 'CATALOG_MATRIX role=no_application_role table=tipos_cambio_dof INSERT=deny UPDATE=deny DELETE=deny RPC=deny';
  PERFORM pg_temp.as_postgres();
  PERFORM set_config('role','service_role',true);
  SELECT count(*) INTO n FROM public.planes WHERE id IN(active_plan,retired_plan);
  IF n<>2 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_SERVICE_PLAN_VISIBILITY'; END IF;
  INSERT INTO public.tipos_cambio_dof(fecha,usd_mxn,eur_mxn) VALUES(probe_date,24,25)
    ON CONFLICT(fecha) DO UPDATE SET usd_mxn=EXCLUDED.usd_mxn,eur_mxn=EXCLUDED.eur_mxn;
  SELECT count(*) INTO n FROM public.tipos_cambio_dof WHERE fecha=probe_date AND usd_mxn=24 AND eur_mxn=25;
  IF n<>1 THEN RAISE EXCEPTION 'GLOBAL_CATALOG_SERVICE_DOF_UPSERT'; END IF;
  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'PASS global catalog permissions: anon, all application roles, super_admin CRUD/RPC, invoker view, service_role.';
END
$catalog_rls$;
ROLLBACK;
