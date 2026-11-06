-- Rollback-only, synthetic tenants. Exercise Ola16 independently of the
-- existing permissive policy, including a deliberate test-only bypass attempt.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $test$
DECLARE
  orgs record;
  super_id uuid := gen_random_uuid();
  cot_a uuid := gen_random_uuid(); cot_b uuid := gen_random_uuid();
  row_a uuid := gen_random_uuid(); row_b uuid := gen_random_uuid();
  n integer; changed integer; expected_using text; expected_check text;
BEGIN
  SELECT pg_get_expr(polqual,polrelid), pg_get_expr(polwithcheck,polrelid)
    INTO STRICT expected_using, expected_check FROM pg_policy
    WHERE polrelid='public.comisiones_recuperaciones'::regclass
      AND polname='Scope tenant activo super admin';
  SELECT count(*) INTO n FROM pg_policy
    WHERE polrelid='public.cotizacion_handovers'::regclass
      AND polname='cotizacion_handovers_tenant_restrictive' AND NOT polpermissive
      AND polcmd='*' AND polroles=ARRAY['authenticated'::regrole::oid]
      AND pg_get_expr(polqual,polrelid)=expected_using
      AND pg_get_expr(polwithcheck,polrelid)=expected_check;
  PERFORM pg_temp.assert(n=1, 'handover exact Ola16 restrictive policy missing');
  SELECT count(*) INTO n FROM pg_policy
    WHERE polrelid='public.cotizacion_handovers'::regclass AND polpermissive;
  PERFORM pg_temp.assert(n=1, 'handover original permissive policy changed');

  SELECT * INTO STRICT orgs FROM pg_temp.seed_org_pair('HANDOVER-SCOPE');
  INSERT INTO auth.users(id,email) VALUES (super_id,'handover-sa@test.local');
  INSERT INTO public.user_roles(user_id,role) VALUES (super_id,'super_admin');
  INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,estado,subtotal,conceptos_venta)
    VALUES(cot_a,orgs.org_a,'HS-A','Marítimo','Importación','Borrador',100,'[]'),
          (cot_b,orgs.org_b,'HS-B','Marítimo','Importación','Borrador',100,'[]');
  INSERT INTO public.cotizacion_handovers(id,organization_id,cotizacion_id)
    VALUES(row_a,orgs.org_a,cot_a),(row_b,orgs.org_b,cot_b);

  PERFORM pg_temp.as_user(orgs.admin_a);
  SELECT count(*) INTO n FROM public.cotizacion_handovers WHERE id IN (row_a,row_b);
  PERFORM pg_temp.assert(n=1, 'normal A reader lost own handover or saw foreign handover');
  UPDATE public.cotizacion_handovers SET coordinador_id=orgs.admin_a WHERE id=row_a;
  GET DIAGNOSTICS changed=ROW_COUNT;
  PERFORM pg_temp.assert(changed=0, 'normal reader gained handover write permission');

  PERFORM pg_temp.as_postgres();
  PERFORM set_config('role','anon',true);
  BEGIN
    SELECT count(*) INTO n FROM public.cotizacion_handovers WHERE id IN (row_a,row_b);
    IF n<>0 THEN RAISE EXCEPTION 'anon read handover rows'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM pg_temp.as_postgres();
  CREATE POLICY fixture_super_admin_permissive ON public.cotizacion_handovers
    AS PERMISSIVE FOR ALL TO authenticated
    USING (public.has_role(auth.uid(),'super_admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(),'super_admin'::public.app_role));

  PERFORM pg_temp.as_user(super_id);
  PERFORM public.set_super_admin_org(NULL);
  SELECT count(*) INTO n FROM public.cotizacion_handovers WHERE id IN (row_a,row_b);
  PERFORM pg_temp.assert(n=0, 'super admin without active tenant saw handovers');
  UPDATE public.cotizacion_handovers SET coordinador_id=super_id WHERE id=row_a;
  GET DIAGNOSTICS changed=ROW_COUNT;
  PERFORM pg_temp.assert(changed=0, 'super admin without tenant updated handover');

  PERFORM public.set_super_admin_org(orgs.org_a);
  SELECT count(*) INTO n FROM public.cotizacion_handovers WHERE id=row_a;
  PERFORM pg_temp.assert(n=1, 'active A cannot read A handover');
  SELECT count(*) INTO n FROM public.cotizacion_handovers WHERE id=row_b;
  PERFORM pg_temp.assert(n=0, 'active A read inactive B handover');
  UPDATE public.cotizacion_handovers SET coordinador_id=super_id WHERE id=row_a;
  GET DIAGNOSTICS changed=ROW_COUNT;
  PERFORM pg_temp.assert(changed=1, 'active A positive control was not exercised');
  UPDATE public.cotizacion_handovers SET coordinador_id=super_id WHERE id=row_b;
  GET DIAGNOSTICS changed=ROW_COUNT;
  PERFORM pg_temp.assert(changed=0, 'active A updated inactive B handover');
  BEGIN
    UPDATE public.cotizacion_handovers SET organization_id=orgs.org_b WHERE id=row_a;
    RAISE EXCEPTION 'active A moved its handover to inactive B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  SELECT count(*) INTO n FROM public.cotizacion_handovers WHERE id=row_a AND organization_id=orgs.org_a;
  PERFORM pg_temp.assert(n=1, 'rejected move altered handover organization');

  PERFORM public.set_super_admin_org(orgs.org_b);
  SELECT count(*) INTO n FROM public.cotizacion_handovers WHERE id=row_b;
  PERFORM pg_temp.assert(n=1, 'active B cannot read B handover');
  SELECT count(*) INTO n FROM public.cotizacion_handovers WHERE id=row_a;
  PERFORM pg_temp.assert(n=0, 'active B read inactive A handover');
  PERFORM pg_temp.as_postgres();
END $test$;
ROLLBACK;
