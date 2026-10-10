-- PREPARED ONLY: not a runtime pass or a production activation migration.
-- Insert immediately before the existing L03 owner-path assertion, inside the
-- bounded candidate's disposable fixture transaction. Never run standalone.
-- This grants exactly one RPC to the synthetic authenticated role, then rolls
-- the grant, all fixture changes, and all claims back to this savepoint. There
-- is no COMMIT, HTTP service, token, real identity, or persistent role change.
SAVEPOINT pricing_authenticated_entry;
SET LOCAL ROLE postgres;
DO $entry_guard$
BEGIN
 IF session_user <> 'replay_bootstrap' OR current_user <> 'postgres'
    OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=session_user)
    OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN
      ('postgres','anon','authenticated','service_role','authenticator',
       'supabase_admin','supabase_auth_admin','dashboard_user','sandbox_exec',
       'supabase_privileged_role') AND rolcanlogin)
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated'
                   AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin)
 THEN RAISE EXCEPTION 'AP00: isolated synthetic role environment required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.cotizaciones
   WHERE id='10000000-0000-4000-8000-000000000080'
   AND organization_id='10000000-0000-4000-8000-000000000001'
   AND oportunidad_id IS NULL AND pricing_solicitud_id IS NULL)
 OR NOT EXISTS (SELECT 1 FROM public.crm_solicitudes_pricing
   WHERE id='10000000-0000-4000-8000-000000000050' AND estado='respondida'
   AND tarifa_tarifario_id='10000000-0000-4000-8000-000000000060')
 THEN RAISE EXCEPTION 'AP00: exact pre-L03 synthetic fixture required'; END IF;
 IF has_function_privilege('authenticated',
    'public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'AP00: RPC must start disabled'; END IF;
END $entry_guard$;

GRANT EXECUTE ON FUNCTION public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid) TO authenticated;

DO $authenticated_cases$
DECLARE
 c record;
 completed boolean;
 denied boolean;
 first_result jsonb;
 second_result jsonb;
 quote_before jsonb;
 opportunity_before jsonb;
 quote_after jsonb;
 opportunity_after jsonb;
 quote_tid_before tid;
 opportunity_tid_before tid;
 quote_tid_after tid;
 opportunity_tid_after tid;
 costs_before bigint;
 activities_before bigint;
 uid constant uuid := '10000000-0000-4000-8000-000000000010';
 org_a constant uuid := '10000000-0000-4000-8000-000000000001';
 org_b constant uuid := '10000000-0000-4000-8000-000000000002';
 quote_id constant uuid := '10000000-0000-4000-8000-000000000080';
 op_id constant uuid := '10000000-0000-4000-8000-000000000040';
 request_id constant uuid := '10000000-0000-4000-8000-000000000050';
 tariff_id constant uuid := '10000000-0000-4000-8000-000000000060';
BEGIN
 IF NOT has_function_privilege('authenticated',
      'public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
      'public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('service_role',
      'public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public.guard_cotizacion_origen_pricing()','EXECUTE')
 THEN RAISE EXCEPTION 'AP00: temporary access exceeded the single candidate RPC'; END IF;
 RAISE NOTICE 'PASS AP00: single-RPC temporary grant inside disposable savepoint';

 -- Each successful case deliberately raises ZPA01 only after every assertion;
 -- its PL/pgSQL exception subtransaction restores rows, claims, and role. The
 -- completed flag survives subtransaction rollback and rejects accidental ZPA01.
 -- No exception other than this private success marker is suppressed.
 FOR c IN SELECT * FROM (VALUES
   ('AP01','vendedor',false,'member','normal',true,'LC_PRICING_ORIGEN_NO_AUTORIZADO','seller own'),
   ('AP02','vendedor',true,'member','normal',false,'LC_PRICING_ORIGEN_NO_AUTORIZADO','seller other'),
   ('AP03','operador',true,'member','normal',true,'LC_PRICING_ORIGEN_NO_AUTORIZADO','operational staff other'),
   ('AP04','gerente_comercial',true,'member','normal',true,'LC_PRICING_ORIGEN_NO_AUTORIZADO','commercial manager other'),
   ('AP05','admin_org',true,'member','normal',true,'LC_PRICING_ORIGEN_NO_AUTORIZADO','tenant admin other'),
   ('AP06','customer_service',false,'member','normal',false,'LC_PRICING_ORIGEN_NO_AUTORIZADO','quote writer without CRM update'),
   ('AP07','ejecutivo_pricing',false,'member','normal',false,'LC_PRICING_ORIGEN_NO_AUTORIZADO','Pricing writer without CRM update'),
   ('AP08','viewer',false,'member','normal',false,'LC_PRICING_ORIGEN_NO_AUTORIZADO','read-only staff'),
   ('AP09','cliente',false,'member','normal',false,'LC_PRICING_ORIGEN_NO_AUTORIZADO','client with own portal quote'),
   ('AP10','agente_carga',false,'member','normal',false,'LC_PRICING_ORIGEN_NO_AUTORIZADO','agent with own tariff'),
   ('AP11','vendedor',false,'member','missing',false,'LC_SIN_SESION','authenticated SQL role without subject'),
   ('AP12','vendedor',false,'foreign','normal',false,'LC_PRICING_ORIGEN_NO_AUTORIZADO','membership belongs to another tenant'),
   ('AP13','vendedor',false,'none','normal',false,'LC_PRICING_ORIGEN_NO_AUTORIZADO','membership revoked'),
   ('AP14','super_admin',true,'member','selected_a',true,'LC_PRICING_ORIGEN_NO_AUTORIZADO','super admin selected tenant'),
   ('AP15','super_admin',false,'member','normal',false,'LC_PRICING_ORIGEN_NO_AUTORIZADO','super admin without selection'),
   ('AP16','super_admin',false,'member','selected_b',false,'LC_PRICING_ORIGEN_NO_AUTORIZADO','super admin other selected tenant')
 ) AS cases(test_id,app_role,other_seller,membership,claim_mode,allowed,error_text,label)
 LOOP
  completed:=false;
  BEGIN
   IF current_user <> 'postgres' THEN RAISE EXCEPTION '%: fixture role not restored',c.test_id; END IF;
   UPDATE public.user_roles SET role=c.app_role::public.app_role WHERE user_id=uid;
   UPDATE public.organization_members SET role=c.app_role::public.app_role WHERE user_id=uid;
   IF c.membership='foreign' THEN
    UPDATE public.organization_members SET organization_id=org_b WHERE user_id=uid;
   ELSIF c.membership='none' THEN
    DELETE FROM public.organization_members WHERE user_id=uid;
   END IF;
   IF c.other_seller THEN
    -- Reuse the second seller's existing unique membership from the frozen
    -- tenant-B seed. Only its fixture tenant changes, then rolls back per case.
    UPDATE public.organization_members SET organization_id=org_a
      WHERE user_id='10000000-0000-4000-8000-000000000011'
        AND organization_id=org_b AND role='vendedor';
    IF NOT FOUND THEN RAISE EXCEPTION '%: exact second-seller membership missing',c.test_id; END IF;
    UPDATE public.crm_oportunidades
      SET vendedor_id='10000000-0000-4000-8000-000000000011',vendedor_email='other@replay.invalid'
      WHERE id=op_id;
   END IF;
   IF c.app_role='cliente' THEN
    INSERT INTO public.client_users(user_id,cliente_id,organization_id)
      VALUES(uid,'10000000-0000-4000-8000-000000000020',org_a);
   ELSIF c.app_role='agente_carga' THEN
    INSERT INTO public.agente_users(user_id,agente_id,organization_id)
      VALUES(uid,'10000000-0000-4000-8000-000000000070',org_a);
   END IF;
   IF c.claim_mode IN ('selected_a','selected_b') THEN
    INSERT INTO public.super_admin_org_activa(user_id,organization_id)
      VALUES(uid,CASE WHEN c.claim_mode='selected_a' THEN org_a ELSE org_b END);
   END IF;
   PERFORM set_config('request.jwt.claim.sub','',true);
   PERFORM set_config('request.jwt.claim.role','',true);
   PERFORM set_config('request.jwt.claim','',true);
   PERFORM set_config('request.jwt.claims',CASE WHEN c.claim_mode='missing' THEN ''
      ELSE jsonb_build_object('sub',uid,'role','authenticated','email','seller@replay.invalid')::text END,true);
   SELECT to_jsonb(q),q.ctid INTO STRICT quote_before,quote_tid_before FROM public.cotizaciones q WHERE id=quote_id;
   SELECT to_jsonb(o),o.ctid INTO STRICT opportunity_before,opportunity_tid_before FROM public.crm_oportunidades o WHERE id=op_id;
   SELECT count(*) INTO costs_before FROM public.cotizacion_costos;
   SELECT (SELECT count(*) FROM public.crm_historial_etapas)
       +(SELECT count(*) FROM public.crm_notificaciones)
       +(SELECT count(*) FROM public.notificaciones_cliente)
       +(SELECT count(*) FROM public.cotizacion_versiones)
       +(SELECT count(*) FROM public.bitacora_actividad) INTO activities_before;

   -- Invoke from the actual restricted SQL role, not the owner with only claims.
   PERFORM set_config('role','authenticated',true);
   IF current_user <> 'authenticated' OR session_user <> 'replay_bootstrap'
      OR (c.claim_mode<>'missing' AND auth.uid() IS DISTINCT FROM uid)
      OR (c.claim_mode='missing' AND auth.uid() IS NOT NULL)
   THEN RAISE EXCEPTION '%: authenticated entry context mismatch',c.test_id; END IF;
   IF c.app_role='cliente' AND NOT EXISTS (SELECT 1 FROM public.cotizaciones WHERE id=quote_id)
   THEN RAISE EXCEPTION '%: own client quote must be visible before write rejection',c.test_id; END IF;
   IF c.app_role='agente_carga' AND NOT EXISTS (SELECT 1 FROM public.costeo_tarifas WHERE id=tariff_id)
   THEN RAISE EXCEPTION '%: own agent tariff must be visible before write rejection',c.test_id; END IF;
   IF c.app_role IN ('customer_service','ejecutivo_pricing')
      AND (NOT public.puede_escribir_cotizaciones() OR NOT EXISTS(SELECT 1 FROM public.crm_oportunidades WHERE id=op_id))
   THEN RAISE EXCEPTION '%: quote-write / CRM-read-only boundary not exercised',c.test_id; END IF;

   IF c.allowed THEN
    first_result:=public.crm_vincular_cotizacion_cliente_pricing(quote_id,op_id,request_id,tariff_id);
    IF current_user<>'authenticated'
       OR first_result->'ya_ligada' IS DISTINCT FROM 'false'::jsonb
       OR first_result->>'oportunidad_id' IS DISTINCT FROM op_id::text
       OR first_result->>'solicitud_id' IS DISTINCT FROM request_id::text
       OR first_result->>'tarifa_id' IS DISTINCT FROM tariff_id::text
       OR first_result->>'cliente_id' IS DISTINCT FROM '10000000-0000-4000-8000-000000000020'
       OR first_result->>'updated_at' IS NULL
    THEN RAISE EXCEPTION '%: authenticated first-link contract mismatch',c.test_id; END IF;
    SELECT to_jsonb(q),q.ctid INTO STRICT quote_before,quote_tid_before FROM public.cotizaciones q WHERE id=quote_id;
    SELECT to_jsonb(o),o.ctid INTO STRICT opportunity_before,opportunity_tid_before FROM public.crm_oportunidades o WHERE id=op_id;
    IF quote_before->>'pricing_solicitud_id' IS DISTINCT FROM request_id::text
       OR quote_before->>'oportunidad_id' IS DISTINCT FROM op_id::text
       OR opportunity_before->>'monto_estimado' IS NULL
       OR (opportunity_before->>'monto_estimado')::numeric IS DISTINCT FROM 251::numeric
    THEN RAISE EXCEPTION '%: authenticated linkage or CRM synchronization not persisted',c.test_id; END IF;
    second_result:=public.crm_vincular_cotizacion_cliente_pricing(quote_id,op_id,request_id,tariff_id);
    IF second_result IS DISTINCT FROM jsonb_set(first_result,'{ya_ligada}','true')
    THEN RAISE EXCEPTION '%: authenticated exact-origin retry changed result',c.test_id; END IF;
   ELSE
    denied:=false;
    BEGIN
     PERFORM public.crm_vincular_cotizacion_cliente_pricing(quote_id,op_id,request_id,tariff_id);
    EXCEPTION WHEN insufficient_privilege THEN
     denied:=SQLERRM=c.error_text;
     IF NOT denied THEN RAISE; END IF;
    END;
    IF NOT denied THEN RAISE EXCEPTION '%: unauthorized authenticated entry accepted',c.test_id; END IF;
   END IF;
   IF current_user<>'authenticated' THEN RAISE EXCEPTION '%: RPC leaked owner context',c.test_id; END IF;
   PERFORM set_config('role','postgres',true);
   SELECT to_jsonb(q),q.ctid INTO STRICT quote_after,quote_tid_after FROM public.cotizaciones q WHERE id=quote_id;
   SELECT to_jsonb(o),o.ctid INTO STRICT opportunity_after,opportunity_tid_after FROM public.crm_oportunidades o WHERE id=op_id;
   IF quote_before IS DISTINCT FROM quote_after OR opportunity_before IS DISTINCT FROM opportunity_after
      OR quote_tid_before IS DISTINCT FROM quote_tid_after OR opportunity_tid_before IS DISTINCT FROM opportunity_tid_after
      OR (SELECT count(*) FROM public.cotizacion_costos)<>costs_before
      OR (SELECT (SELECT count(*) FROM public.crm_historial_etapas)
          +(SELECT count(*) FROM public.crm_notificaciones)
          +(SELECT count(*) FROM public.notificaciones_cliente)
          +(SELECT count(*) FROM public.cotizacion_versiones)
          +(SELECT count(*) FROM public.bitacora_actividad))<>activities_before
   THEN RAISE EXCEPTION '%: denial/retry changed rows or generated unexpected side effects',c.test_id; END IF;
   completed:=true;
   RAISE EXCEPTION USING ERRCODE='ZPA01',MESSAGE='rollback completed synthetic authorization case';
  EXCEPTION WHEN SQLSTATE 'ZPA01' THEN
   IF NOT completed THEN RAISE; END IF;
  END;
  IF current_user<>'postgres'
     OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role='vendedor')
     OR NOT EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=uid AND organization_id=org_a AND role='vendedor')
     OR NOT EXISTS(SELECT 1 FROM public.organization_members
       WHERE user_id='10000000-0000-4000-8000-000000000011' AND organization_id=org_b AND role='vendedor')
     OR EXISTS(SELECT 1 FROM public.cotizaciones WHERE id=quote_id AND (pricing_solicitud_id IS NOT NULL OR oportunidad_id IS NOT NULL))
  THEN RAISE EXCEPTION '%: per-case rollback failed',c.test_id; END IF;
  RAISE NOTICE 'PASS %: authenticated %; expected %; case rolled back',c.test_id,c.label,
    CASE WHEN c.allowed THEN 'link and no-write retry' ELSE c.error_text END;
 END LOOP;
END $authenticated_cases$;

ROLLBACK TO SAVEPOINT pricing_authenticated_entry;
RELEASE SAVEPOINT pricing_authenticated_entry;
DO $restored$
DECLARE role_name text; function_name text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'replay_bootstrap' THEN
  RAISE EXCEPTION 'AP17: pre-L03 role not restored';
 END IF;
 FOREACH function_name IN ARRAY ARRAY[
    'public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)',
    'public.guard_cotizacion_origen_pricing()'] LOOP
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_function_privilege(role_name,function_name,'EXECUTE') THEN
    RAISE EXCEPTION 'AP17: savepoint rollback left % EXECUTE on %',role_name,function_name;
   END IF;
  END LOOP;
 END LOOP;
 IF auth.uid() IS DISTINCT FROM '10000000-0000-4000-8000-000000000010'::uuid
    OR EXISTS(SELECT 1 FROM public.cotizaciones WHERE id='10000000-0000-4000-8000-000000000080'
               AND (oportunidad_id IS NOT NULL OR pricing_solicitud_id IS NOT NULL))
    OR (SELECT count(*) FROM public.organization_members)<>3
    OR EXISTS(SELECT 1 FROM public.client_users)
    OR EXISTS(SELECT 1 FROM public.agente_users)
    OR EXISTS(SELECT 1 FROM public.super_admin_org_activa)
 THEN RAISE EXCEPTION 'AP17: overlay did not restore the original fixture'; END IF;
 RAISE NOTICE 'PASS AP17: temporary grant and all authorization fixtures rolled back; original assertions resume';
END $restored$;
