\set ON_ERROR_STOP on
DO $pre$
DECLARE sig text; p record;
BEGIN
  IF current_database() <> 'acceptance_review' OR current_user <> 'postgres'
     OR session_user <> 'postgres' OR current_setting('server_version_num') NOT IN ('170006','170009') THEN
    RAISE EXCEPTION 'Owned acceptance_review PostgreSQL 17.6/17.9 required';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated' AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'authenticated must not bypass RLS';
  END IF;
  FOREACH sig IN ARRAY ARRAY[
    'public.aceptar_cotizacion_version(uuid)',
    'public.convertir_prospecto_a_cliente_rpc(uuid,jsonb)',
    'public.crm_cerrar_oportunidad_desde_cotizacion()',
    'public.guard_cotizacion_vinculo_cliente()',
    'public._crm_lead_sync_estado_empresa()',
    'public.cliente_requiere_autorizacion(uuid,text)',
    'public.is_org_member(uuid)',
    'public.rls_tenant_scope_ok(uuid)',
    'public.has_any_role_in_org(uuid,public.app_role[],uuid)'
  ] LOOP
    IF to_regprocedure(sig) IS NULL THEN RAISE EXCEPTION 'Missing real function: %',sig; END IF;
  END LOOP;
  FOREACH sig IN ARRAY ARRAY[
    'public.aceptar_cotizacion_version(uuid)',
    'public.convertir_prospecto_a_cliente_rpc(uuid,jsonb)'
  ] LOOP
    SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(sig);
    IF NOT p.prosecdef OR pg_get_userbyid(p.proowner)<>'postgres'
       OR NOT ('search_path=public'=ANY(coalesce(p.proconfig,ARRAY[]::text[])))
       OR has_function_privilege('anon',p.oid,'EXECUTE')
       OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
       OR NOT has_function_privilege('service_role',p.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'Real RPC ACL/owner/configuration mismatch: %',sig;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.cotizaciones'::regclass
    AND tgname='zz_crm_cerrar_oportunidad_desde_cotizacion' AND NOT tgisinternal AND tgenabled='O') THEN
    RAISE EXCEPTION 'Real canonical CRM trigger missing or disabled';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.cotizaciones'::regclass
    AND tgname='trg_guard_cotizacion_vinculo_cliente' AND NOT tgisinternal AND tgenabled='O') THEN
    RAISE EXCEPTION 'Real client-link guard missing or disabled';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE contype='f' AND confrelid='auth.users'::regclass) THEN
    RAISE EXCEPTION 'auth.users FKs absent; relaxed post-migrate fixture is forbidden';
  END IF;
END $pre$;
-- Exercise the normal first-user trigger once; do not turn a test actor into
-- the initial super_admin. This is a synthetic sentinel in the owned database.
INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES('00000000-0000-4000-8000-00000000ce41','acceptance-sentinel@test.invalid','{}'::jsonb);
DO $sentinel$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id='00000000-0000-4000-8000-00000000ce41' AND role::text='super_admin') THEN
  RAISE EXCEPTION 'Normal signup sentinel did not obtain expected initial role';
 END IF;
END $sentinel$;
