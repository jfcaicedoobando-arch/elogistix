-- Real auth/RLS regression. Synthetic actors and rows, always rolled back.
BEGIN;
DO $test$
DECLARE
  v_org uuid; v_other uuid; v_operator uuid:=gen_random_uuid(); v_admin uuid:=gen_random_uuid();
  v_coord uuid:=gen_random_uuid(); v_foreign uuid:=gen_random_uuid(); v_client uuid; v_otherclient uuid;
  v_count int;
BEGIN
  INSERT INTO public.organizations(nombre) VALUES('QA0040 coordinator boundary') RETURNING id INTO v_org;
  INSERT INTO public.organizations(nombre) VALUES('QA0040 other tenant') RETURNING id INTO v_other;
  INSERT INTO auth.users(id,email) SELECT u,u::text||'@test.invalid' FROM unnest(ARRAY[v_operator,v_admin,v_coord,v_foreign]) u;
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
    (v_org,v_operator,'contador'),(v_org,v_admin,'admin_org'),(v_org,v_coord,'coordinador_logistico'),(v_other,v_foreign,'coordinador_logistico');
  INSERT INTO public.user_roles(user_id,role) VALUES
    (v_operator,'contador'),(v_admin,'admin_org'),(v_coord,'coordinador_logistico'),(v_foreign,'coordinador_logistico')
    ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  INSERT INTO public.clientes(organization_id,nombre,email,tipo_cliente) VALUES(v_org,'QA0040 own',gen_random_uuid()::text||'@test.invalid','general') RETURNING id INTO v_client;
  INSERT INTO public.clientes(organization_id,nombre,email,tipo_cliente) VALUES(v_other,'QA0040 foreign',gen_random_uuid()::text||'@test.invalid','general') RETURNING id INTO v_otherclient;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_operator,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',v_operator::text,true);
  PERFORM set_config('role','authenticated',true);
  IF public.org_scope() IS DISTINCT FROM v_org THEN RAISE EXCEPTION 'QA0040 actor/scope fixture invalid'; END IF;
  -- Prove the row is writable under real RLS without changing protected assignment.
  UPDATE public.clientes SET nombre='QA0040 ordinary edit',coordinador_logistico_id=coordinador_logistico_id WHERE id=v_client;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'QA0040 ordinary writer no longer works'; END IF;
  BEGIN
    UPDATE public.clientes SET coordinador_logistico_id=v_coord WHERE id=v_client;
    RAISE EXCEPTION 'QA0040 operator assigned coordinator directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.asignar_coordinador_cliente(v_client,v_coord);
    RAISE EXCEPTION 'QA0040 operator assigned coordinator by RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM public.asignar_coordinador_cliente(v_client,v_coord);
  IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=v_client AND coordinador_logistico_id=v_coord) THEN RAISE EXCEPTION 'QA0040 admin RPC failed'; END IF;
  BEGIN
    PERFORM public.asignar_coordinador_cliente(v_otherclient,v_foreign);
    RAISE EXCEPTION 'QA0040 cross-tenant assignment allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'LC_CLIENTE_NO_EXISTE:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.asignar_coordinador_cliente(v_client,v_foreign);
    RAISE EXCEPTION 'QA0040 foreign coordinator accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'LC_COORDINADOR_INVALIDO:%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_operator,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',v_operator::text,true);
  BEGIN
    UPDATE public.clientes SET coordinador_logistico_id=NULL WHERE id=v_client;
    RAISE EXCEPTION 'QA0040 operator cleared fixed coordinator';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('role','postgres',true);
  IF EXISTS(SELECT 1 FROM public.clientes WHERE id=v_otherclient AND coordinador_logistico_id IS NOT NULL) THEN RAISE EXCEPTION 'QA0040 foreign client modified'; END IF;
  RAISE NOTICE 'QA0040 PASS: real writer remains functional, protected assignment and tenant RPC enforced';
END $test$;
ROLLBACK;
