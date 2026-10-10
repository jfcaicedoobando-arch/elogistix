-- PREPARED ONLY. No PostgreSQL execution result is claimed.
-- Insert AFTER AP17 and BEFORE original L03 in the reviewed candidate overlay.
-- All fixture writes and the two temporary single-RPC grants are bounded by
-- rollback-only savepoints inside the disposable synthetic transaction.
-- Run through the existing isolated runner with ON_ERROR_STOP; never standalone.

-- CP01: isolated test preparation only; execute inside the candidate transaction.
SAVEPOINT pricing_compatibility_01;
SET LOCAL ROLE postgres;
DO $cp_entry$
BEGIN
 IF session_user<>'replay_bootstrap' OR current_user<>'postgres'
    OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=session_user)
    OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN
      ('postgres','anon','authenticated','service_role','authenticator',
       'supabase_admin','supabase_auth_admin','dashboard_user','sandbox_exec',
       'supabase_privileged_role') AND rolcanlogin)
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated'
                   AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin)
    OR auth.uid() IS DISTINCT FROM '10000000-0000-4000-8000-000000000010'::uuid
 THEN RAISE EXCEPTION 'CP01: isolated pre-L03 owner and seller context required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.cotizaciones WHERE id='10000000-0000-4000-8000-000000000080'
    AND organization_id='10000000-0000-4000-8000-000000000001' AND oportunidad_id IS NULL
    AND pricing_solicitud_id IS NULL AND subtotal=251 AND estado='Borrador' AND deleted_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.crm_solicitudes_pricing WHERE id='10000000-0000-4000-8000-000000000050'
      AND estado='respondida' AND tarifa_tarifario_id='10000000-0000-4000-8000-000000000060' AND deleted_at IS NULL)
    OR has_function_privilege('authenticated','public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'CP01: frozen fixture or revoked candidate entry changed'; END IF;
END $cp_entry$;
DO $cp_case$
DECLARE original_state jsonb; restored_state jsonb; before_call jsonb; after_call jsonb;
 first_result jsonb; retry_result jsonb; quote_state jsonb; op_state jsonb;
 completed boolean:=false; denied boolean:=false; 
BEGIN
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO original_state;
 BEGIN
 INSERT INTO public.crm_leads(id,organization_id,empresa,estado,vendedor_id,vendedor_email)
 VALUES('10000000-0000-4000-8000-000000000111','10000000-0000-4000-8000-000000000001','Synthetic compatibility prospect','Prospecto','10000000-0000-4000-8000-000000000010','seller@replay.invalid');
 INSERT INTO public.crm_oportunidades(id,organization_id,nombre,etapa_id,lead_id,vendedor_id,vendedor_email,moneda)
 VALUES('10000000-0000-4000-8000-000000000112','10000000-0000-4000-8000-000000000001','Synthetic prospect opportunity','10000000-0000-4000-8000-000000000030','10000000-0000-4000-8000-000000000111','10000000-0000-4000-8000-000000000010','seller@replay.invalid','USD');
 INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,es_prospecto,prospecto_empresa,moneda,tarifa_id,conceptos_venta)
 VALUES('10000000-0000-4000-8000-000000000113','10000000-0000-4000-8000-000000000001','SYNTHETIC-CP-PROSPECT','Marítimo','Importación',true,'Synthetic compatibility prospect','USD','10000000-0000-4000-8000-000000000060',
 '[{"descripcion":"Synthetic prospect freight","cantidad":2,"precio_unitario":125.50,"moneda":"USD","aplica_iva":true}]');
 PERFORM set_config('role','authenticated',true);
 IF current_user<>'authenticated' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 first_result:=public.crm_vincular_cotizacion('10000000-0000-4000-8000-000000000113','{}'::jsonb,'10000000-0000-4000-8000-000000000111','10000000-0000-4000-8000-000000000112');
 IF current_user<>'authenticated' OR first_result->'ya_ligada' IS DISTINCT FROM 'false'::jsonb
    OR first_result->'creado_lead' IS DISTINCT FROM 'false'::jsonb
    OR first_result->'creado_oportunidad' IS DISTINCT FROM 'false'::jsonb
    OR first_result->>'oportunidad_id' IS DISTINCT FROM '10000000-0000-4000-8000-000000000112'
    OR first_result->>'lead_id' IS DISTINCT FROM '10000000-0000-4000-8000-000000000111'
    OR first_result->>'updated_at' IS NULL
 THEN RAISE EXCEPTION 'CP01: existing prospect RPC first-link contract changed'; END IF;
 PERFORM set_config('role','postgres',true);
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.cotizaciones WHERE id='10000000-0000-4000-8000-000000000113'
     AND oportunidad_id='10000000-0000-4000-8000-000000000112' AND pricing_solicitud_id IS NULL AND cliente_id IS NULL
     AND es_prospecto AND subtotal=251)
    OR NOT EXISTS (SELECT 1 FROM public.crm_oportunidades WHERE id='10000000-0000-4000-8000-000000000112'
     AND lead_id='10000000-0000-4000-8000-000000000111' AND cliente_id IS NULL AND monto_estimado=251 AND moneda='USD')
 THEN RAISE EXCEPTION 'CP01: prospect link or full-trigger synchronization failed'; END IF;
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO before_call;
 PERFORM set_config('role','authenticated',true);
 IF current_user<>'authenticated' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 retry_result:=public.crm_vincular_cotizacion('10000000-0000-4000-8000-000000000113','{}'::jsonb,'10000000-0000-4000-8000-000000000111','10000000-0000-4000-8000-000000000112');
 IF current_user<>'authenticated' OR retry_result IS DISTINCT FROM jsonb_set(first_result,'{ya_ligada}','true'::jsonb)
 THEN RAISE EXCEPTION 'CP01: existing prospect retry response changed'; END IF;
 PERFORM set_config('role','postgres',true);
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO after_call;
 IF before_call IS DISTINCT FROM after_call THEN RAISE EXCEPTION 'CP01: prospect retry wrote rows or side effects'; END IF;

  completed:=true;
  RAISE EXCEPTION USING ERRCODE='ZPC01',MESSAGE='rollback completed synthetic compatibility smoke';
 EXCEPTION WHEN SQLSTATE 'ZPC01' THEN
  IF NOT completed THEN RAISE; END IF;
 END;
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'CP01: inner rollback did not restore owner'; END IF;
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO restored_state;
 IF original_state IS DISTINCT FROM restored_state THEN
  RAISE EXCEPTION 'CP01: inner rollback changed fixture rows or physical identities';
 END IF;
END $cp_case$;
ROLLBACK TO SAVEPOINT pricing_compatibility_01;
RELEASE SAVEPOINT pricing_compatibility_01;
DO $cp_restored$
DECLARE r text; f text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'replay_bootstrap'
    OR auth.uid() IS DISTINCT FROM '10000000-0000-4000-8000-000000000010'::uuid
    OR NOT EXISTS (SELECT 1 FROM public.cotizaciones WHERE id='10000000-0000-4000-8000-000000000080'
       AND oportunidad_id IS NULL AND pricing_solicitud_id IS NULL AND estado='Borrador'
       AND subtotal=251 AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'CP01: pre-L03 fixture or identity not restored'; END IF;
 FOREACH f IN ARRAY ARRAY['public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)','public.guard_cotizacion_origen_pricing()'] LOOP
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_function_privilege(r,f,'EXECUTE') THEN
    RAISE EXCEPTION 'CP01: rollback left % EXECUTE on %',r,f;
   END IF;
  END LOOP;
 END LOOP;
 RAISE NOTICE 'PASS CP01: authenticated existing prospect link and no-write retry preserve NULL Pricing origin; full fixture restored';
END $cp_restored$;

-- CP02: isolated test preparation only; execute inside the candidate transaction.
SAVEPOINT pricing_compatibility_02;
SET LOCAL ROLE postgres;
DO $cp_entry$
BEGIN
 IF session_user<>'replay_bootstrap' OR current_user<>'postgres'
    OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=session_user)
    OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN
      ('postgres','anon','authenticated','service_role','authenticator',
       'supabase_admin','supabase_auth_admin','dashboard_user','sandbox_exec',
       'supabase_privileged_role') AND rolcanlogin)
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated'
                   AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin)
    OR auth.uid() IS DISTINCT FROM '10000000-0000-4000-8000-000000000010'::uuid
 THEN RAISE EXCEPTION 'CP02: isolated pre-L03 owner and seller context required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.cotizaciones WHERE id='10000000-0000-4000-8000-000000000080'
    AND organization_id='10000000-0000-4000-8000-000000000001' AND oportunidad_id IS NULL
    AND pricing_solicitud_id IS NULL AND subtotal=251 AND estado='Borrador' AND deleted_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.crm_solicitudes_pricing WHERE id='10000000-0000-4000-8000-000000000050'
      AND estado='respondida' AND tarifa_tarifario_id='10000000-0000-4000-8000-000000000060' AND deleted_at IS NULL)
    OR has_function_privilege('authenticated','public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'CP02: frozen fixture or revoked candidate entry changed'; END IF;
END $cp_entry$;
GRANT EXECUTE ON FUNCTION public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid) TO authenticated;
DO $cp_case$
DECLARE original_state jsonb; restored_state jsonb; before_call jsonb; after_call jsonb;
 first_result jsonb; retry_result jsonb; quote_state jsonb; op_state jsonb;
 completed boolean:=false; denied boolean:=false; 
BEGIN
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO original_state;
 BEGIN
 INSERT INTO public.crm_etapas_pipeline(id,organization_id,nombre,tipo,activa)
 VALUES('10000000-0000-4000-8000-000000000114','10000000-0000-4000-8000-000000000001','Synthetic compatibility won','ganada',true);
 -- Reuse the synthetic second in-tenant identity as an independent approver.
 UPDATE public.user_roles SET role='operador' WHERE user_id='10000000-0000-4000-8000-000000000012';
 UPDATE public.organization_members SET role='operador' WHERE user_id='10000000-0000-4000-8000-000000000012';
 PERFORM set_config('role','authenticated',true);
 IF current_user<>'authenticated' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 first_result:=public.crm_vincular_cotizacion_cliente_pricing('10000000-0000-4000-8000-000000000080','10000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000060');
 IF current_user<>'authenticated' OR first_result->'ya_ligada' IS DISTINCT FROM 'false'::jsonb THEN
  RAISE EXCEPTION 'CP02: initial authenticated customer link failed'; END IF;
 PERFORM set_config('role','postgres',true);
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000012","role":"authenticated","email":"approver@replay.invalid"}',true);
 PERFORM set_config('role','authenticated',true);
 IF current_user<>'authenticated' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 UPDATE public.cotizaciones SET estado='Aceptada' WHERE id='10000000-0000-4000-8000-000000000080';
 IF NOT FOUND THEN RAISE EXCEPTION 'CP02: approver could not update quote'; END IF;
 PERFORM set_config('role','postgres',true);
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 SELECT to_jsonb(q) INTO STRICT quote_state FROM public.cotizaciones q WHERE id='10000000-0000-4000-8000-000000000080';
 SELECT to_jsonb(o) INTO STRICT op_state FROM public.crm_oportunidades o WHERE id='10000000-0000-4000-8000-000000000040';
 IF quote_state->>'estado' IS DISTINCT FROM 'Aceptada'
    OR quote_state->>'pricing_solicitud_id' IS DISTINCT FROM '10000000-0000-4000-8000-000000000050'
    OR quote_state->>'oportunidad_id' IS DISTINCT FROM '10000000-0000-4000-8000-000000000040'
    OR quote_state->>'aceptada_por' IS DISTINCT FROM '10000000-0000-4000-8000-000000000012'
    OR quote_state->>'aceptada_en' IS NULL
    OR quote_state->'version_aceptada' IS DISTINCT FROM quote_state->'version'
    OR op_state->>'etapa_id' IS DISTINCT FROM '10000000-0000-4000-8000-000000000114'
    OR (op_state->>'probabilidad')::integer IS DISTINCT FROM 100
    OR (op_state->>'valor_real')::numeric IS DISTINCT FROM 251::numeric
    OR op_state->>'cotizacion_ganadora_id' IS DISTINCT FROM '10000000-0000-4000-8000-000000000080'
    OR op_state->>'fecha_cierre_real' IS DISTINCT FROM (now() AT TIME ZONE 'America/Mexico_City')::date::text
 THEN RAISE EXCEPTION 'CP02: terminal quote/CRM contract changed'; END IF;
 IF (SELECT count(*) FROM public.cotizacion_versiones WHERE cotizacion_id='10000000-0000-4000-8000-000000000080'
      AND version_num=1 AND estado_al_snapshot='Aceptada'
      AND snapshot->>'pricing_solicitud_id'='10000000-0000-4000-8000-000000000050' AND (snapshot->>'subtotal')::numeric=251
      AND jsonb_array_length(costos_snapshot)=1)<>1
    OR (SELECT count(*) FROM public.cotizacion_versiones)<>1
    OR (SELECT count(*) FROM public.crm_historial_etapas WHERE oportunidad_id='10000000-0000-4000-8000-000000000040'
       AND etapa_origen_id='10000000-0000-4000-8000-000000000030' AND etapa_destino_id='10000000-0000-4000-8000-000000000114')<>1
    OR (SELECT count(*) FROM public.crm_historial_etapas)<>1
    OR (SELECT count(*) FROM public.crm_notificaciones WHERE tipo='oportunidad_ganada' AND user_id='10000000-0000-4000-8000-000000000010')<>1
    OR (SELECT count(*) FROM public.crm_notificaciones)<>1
    OR (SELECT count(*) FROM public.bitacora_actividad WHERE accion='oportunidad_ganada_auto' AND entidad_id='10000000-0000-4000-8000-000000000040')<>1
    OR (SELECT count(*) FROM public.bitacora_actividad)<>1
    OR EXISTS (SELECT 1 FROM public.notificaciones_cliente) OR EXISTS (SELECT 1 FROM public.crm_leads)
 THEN RAISE EXCEPTION 'CP02: terminal snapshot/history/notification effects mismatch'; END IF;
 PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000010","role":"authenticated","email":"seller@replay.invalid"}',true);
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO before_call;
 PERFORM set_config('role','authenticated',true);
 IF current_user<>'authenticated' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 retry_result:=public.crm_vincular_cotizacion_cliente_pricing('10000000-0000-4000-8000-000000000080','10000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000060');
 IF current_user<>'authenticated' OR retry_result IS DISTINCT FROM jsonb_build_object(
   'oportunidad_id','10000000-0000-4000-8000-000000000040'::uuid,'cliente_id','10000000-0000-4000-8000-000000000020'::uuid,'solicitud_id','10000000-0000-4000-8000-000000000050'::uuid,
   'tarifa_id','10000000-0000-4000-8000-000000000060'::uuid,'updated_at',quote_state->'updated_at','ya_ligada',true)
 THEN RAISE EXCEPTION 'CP02: won opportunity historical acknowledgement changed'; END IF;
 PERFORM set_config('role','postgres',true);
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO after_call;
 IF before_call IS DISTINCT FROM after_call THEN RAISE EXCEPTION 'CP02: terminal retry wrote rows or side effects'; END IF;
 PERFORM set_config('role','authenticated',true);
 IF current_user<>'authenticated' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 UPDATE public.cotizaciones SET deleted_at=now() WHERE id='10000000-0000-4000-8000-000000000080';
 IF NOT FOUND THEN RAISE EXCEPTION 'CP02: seller could not soft-delete own won quote'; END IF;
 PERFORM set_config('role','postgres',true);
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 SELECT to_jsonb(q) INTO STRICT retry_result FROM public.cotizaciones q WHERE id='10000000-0000-4000-8000-000000000080';
 IF retry_result->>'deleted_at' IS NULL OR retry_result->>'deleted_by' IS DISTINCT FROM '10000000-0000-4000-8000-000000000010'
    OR (retry_result-ARRAY['deleted_at','deleted_by','updated_at']) IS DISTINCT FROM
       (quote_state-ARRAY['deleted_at','deleted_by','updated_at'])
    OR (SELECT to_jsonb(o) FROM public.crm_oportunidades o WHERE id='10000000-0000-4000-8000-000000000040') IS DISTINCT FROM op_state
 THEN RAISE EXCEPTION 'CP02: winner soft-delete failed to preserve confirmed quote and opportunity history'; END IF;
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO after_call;
 IF (before_call-'cotizaciones') IS DISTINCT FROM (after_call-'cotizaciones') THEN
  RAISE EXCEPTION 'CP02: winner soft-delete changed historical snapshot, costs or lifecycle side effects'; END IF;
 before_call:=after_call;
 PERFORM set_config('role','authenticated',true);
 IF current_user<>'authenticated' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 BEGIN
  PERFORM public.crm_vincular_cotizacion_cliente_pricing('10000000-0000-4000-8000-000000000080','10000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000060');
 EXCEPTION WHEN insufficient_privilege THEN
  denied:=SQLERRM='LC_PRICING_ORIGEN_NO_AUTORIZADO';
  IF NOT denied THEN RAISE; END IF;
 END;
 IF current_user<>'authenticated' OR NOT denied THEN RAISE EXCEPTION 'CP02: deleted winner was acknowledged'; END IF;
 PERFORM set_config('role','postgres',true);
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO after_call;
 IF before_call IS DISTINCT FROM after_call THEN RAISE EXCEPTION 'CP02: deleted-winner denial wrote rows or side effects'; END IF;

  completed:=true;
  RAISE EXCEPTION USING ERRCODE='ZPC02',MESSAGE='rollback completed synthetic compatibility smoke';
 EXCEPTION WHEN SQLSTATE 'ZPC02' THEN
  IF NOT completed THEN RAISE; END IF;
 END;
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'CP02: inner rollback did not restore owner'; END IF;
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO restored_state;
 IF original_state IS DISTINCT FROM restored_state THEN
  RAISE EXCEPTION 'CP02: inner rollback changed fixture rows or physical identities';
 END IF;
END $cp_case$;
ROLLBACK TO SAVEPOINT pricing_compatibility_02;
RELEASE SAVEPOINT pricing_compatibility_02;
DO $cp_restored$
DECLARE r text; f text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'replay_bootstrap'
    OR auth.uid() IS DISTINCT FROM '10000000-0000-4000-8000-000000000010'::uuid
    OR NOT EXISTS (SELECT 1 FROM public.cotizaciones WHERE id='10000000-0000-4000-8000-000000000080'
       AND oportunidad_id IS NULL AND pricing_solicitud_id IS NULL AND estado='Borrador'
       AND subtotal=251 AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'CP02: pre-L03 fixture or identity not restored'; END IF;
 FOREACH f IN ARRAY ARRAY['public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)','public.guard_cotizacion_origen_pricing()'] LOOP
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_function_privilege(r,f,'EXECUTE') THEN
    RAISE EXCEPTION 'CP02: rollback left % EXECUTE on %',r,f;
   END IF;
  END LOOP;
 END LOOP;
 RAISE NOTICE 'PASS CP02: authenticated customer acceptance closes CRM, historical retry is no-write, and winner soft-delete preserves lineage/history; full fixture restored';
END $cp_restored$;

-- CP03: isolated test preparation only; execute inside the candidate transaction.
SAVEPOINT pricing_compatibility_03;
SET LOCAL ROLE postgres;
DO $cp_entry$
BEGIN
 IF session_user<>'replay_bootstrap' OR current_user<>'postgres'
    OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=session_user)
    OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN
      ('postgres','anon','authenticated','service_role','authenticator',
       'supabase_admin','supabase_auth_admin','dashboard_user','sandbox_exec',
       'supabase_privileged_role') AND rolcanlogin)
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated'
                   AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin)
    OR auth.uid() IS DISTINCT FROM '10000000-0000-4000-8000-000000000010'::uuid
 THEN RAISE EXCEPTION 'CP03: isolated pre-L03 owner and seller context required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.cotizaciones WHERE id='10000000-0000-4000-8000-000000000080'
    AND organization_id='10000000-0000-4000-8000-000000000001' AND oportunidad_id IS NULL
    AND pricing_solicitud_id IS NULL AND subtotal=251 AND estado='Borrador' AND deleted_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.crm_solicitudes_pricing WHERE id='10000000-0000-4000-8000-000000000050'
      AND estado='respondida' AND tarifa_tarifario_id='10000000-0000-4000-8000-000000000060' AND deleted_at IS NULL)
    OR has_function_privilege('authenticated','public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'CP03: frozen fixture or revoked candidate entry changed'; END IF;
END $cp_entry$;
GRANT EXECUTE ON FUNCTION public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid) TO authenticated;
DO $cp_case$
DECLARE original_state jsonb; restored_state jsonb; before_call jsonb; after_call jsonb;
 first_result jsonb; retry_result jsonb; quote_state jsonb; op_state jsonb;
 completed boolean:=false; denied boolean:=false; target record; target_completed boolean:=false;
BEGIN
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO original_state;
 BEGIN
 FOR target IN SELECT * FROM (VALUES
  ('quote','42501','LC_PRICING_ORIGEN_NO_AUTORIZADO'),
  ('customer','42501','LC_PRICING_ORIGEN_NO_AUTORIZADO'),
  ('opportunity','42501','LC_PRICING_ORIGEN_NO_AUTORIZADO'),
  ('request','42501','LC_PRICING_ORIGEN_NO_AUTORIZADO'),
  ('stage','22023','LC_PRICING_OPORTUNIDAD_NO_ELEGIBLE')
 ) AS cases(label,error_state,error_message) LOOP
  target_completed:=false;
  BEGIN
   -- One reviewed synthetic dependency is invalidated at a time as fixture owner.
   -- No permission, guard, state GUC, function or policy is changed.
   CASE target.label
    WHEN 'quote' THEN UPDATE public.cotizaciones SET deleted_at=now() WHERE id='10000000-0000-4000-8000-000000000080';
    WHEN 'customer' THEN UPDATE public.clientes SET deleted_at=now() WHERE id='10000000-0000-4000-8000-000000000020';
    WHEN 'opportunity' THEN UPDATE public.crm_oportunidades SET deleted_at=now() WHERE id='10000000-0000-4000-8000-000000000040';
    WHEN 'request' THEN UPDATE public.crm_solicitudes_pricing SET deleted_at=now() WHERE id='10000000-0000-4000-8000-000000000050';
    WHEN 'stage' THEN UPDATE public.crm_etapas_pipeline SET deleted_at=now() WHERE id='10000000-0000-4000-8000-000000000030';
   END CASE;
   IF NOT FOUND THEN RAISE EXCEPTION 'CP03: missing synthetic deletion target %',target.label; END IF;
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO before_call;
 PERFORM set_config('role','authenticated',true);
 IF current_user<>'authenticated' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.crm_vincular_cotizacion_cliente_pricing('10000000-0000-4000-8000-000000000080','10000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000060');
 EXCEPTION WHEN insufficient_privilege OR invalid_parameter_value THEN
  denied:=SQLSTATE=target.error_state AND SQLERRM=target.error_message;
  IF NOT denied THEN RAISE; END IF;
 END;
 IF current_user<>'authenticated' OR NOT denied THEN RAISE EXCEPTION 'CP03: deleted target accepted: %',target.label; END IF;
 PERFORM set_config('role','postgres',true);
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'CP: unexpected SQL caller role'; END IF;
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO after_call;
 IF before_call IS DISTINCT FROM after_call THEN RAISE EXCEPTION 'CP03: deletion denial wrote rows: %',target.label; END IF;
 target_completed:=true;
 RAISE EXCEPTION USING ERRCODE='ZPCT3',MESSAGE='rollback completed synthetic deleted target';
 EXCEPTION WHEN SQLSTATE 'ZPCT3' THEN
  IF NOT target_completed THEN RAISE; END IF;
 END;
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'CP03: target rollback did not restore owner'; END IF;
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO restored_state;
 IF original_state IS DISTINCT FROM restored_state THEN RAISE EXCEPTION 'CP03: target fixture not restored: %',target.label; END IF;
 END LOOP;

  completed:=true;
  RAISE EXCEPTION USING ERRCODE='ZPC03',MESSAGE='rollback completed synthetic compatibility smoke';
 EXCEPTION WHEN SQLSTATE 'ZPC03' THEN
  IF NOT completed THEN RAISE; END IF;
 END;
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'CP03: inner rollback did not restore owner'; END IF;
 SELECT jsonb_build_object(
  'cotizaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizaciones t) x),
  'crm_oportunidades',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_oportunidades t) x),
  'crm_leads',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_leads t) x),
  'crm_etapas_pipeline',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_etapas_pipeline t) x),
  'crm_solicitudes_pricing',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_solicitudes_pricing t) x),
  'clientes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.clientes t) x),
  'costeo_tarifas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.costeo_tarifas t) x),
  'cotizacion_costos',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_costos t) x),
  'cotizacion_versiones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.cotizacion_versiones t) x),
  'crm_historial_etapas',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_historial_etapas t) x),
  'crm_notificaciones',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.crm_notificaciones t) x),
  'notificaciones_cliente',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.notificaciones_cliente t) x),
  'bitacora_actividad',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.bitacora_actividad t) x),
  'user_roles',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.user_roles t) x),
  'organization_members',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM (SELECT t.*,t.ctid::text AS _physical_tid FROM public.organization_members t) x)
 ) INTO restored_state;
 IF original_state IS DISTINCT FROM restored_state THEN
  RAISE EXCEPTION 'CP03: inner rollback changed fixture rows or physical identities';
 END IF;
END $cp_case$;
ROLLBACK TO SAVEPOINT pricing_compatibility_03;
RELEASE SAVEPOINT pricing_compatibility_03;
DO $cp_restored$
DECLARE r text; f text;
BEGIN
 IF current_user<>'postgres' OR session_user<>'replay_bootstrap'
    OR auth.uid() IS DISTINCT FROM '10000000-0000-4000-8000-000000000010'::uuid
    OR NOT EXISTS (SELECT 1 FROM public.cotizaciones WHERE id='10000000-0000-4000-8000-000000000080'
       AND oportunidad_id IS NULL AND pricing_solicitud_id IS NULL AND estado='Borrador'
       AND subtotal=251 AND deleted_at IS NULL)
 THEN RAISE EXCEPTION 'CP03: pre-L03 fixture or identity not restored'; END IF;
 FOREACH f IN ARRAY ARRAY['public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)','public.guard_cotizacion_origen_pricing()'] LOOP
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_function_privilege(r,f,'EXECUTE') THEN
    RAISE EXCEPTION 'CP03: rollback left % EXECUTE on %',r,f;
   END IF;
  END LOOP;
 END LOOP;
 RAISE NOTICE 'PASS CP03: deleted quote/customer/opportunity/request and deleted stage reject fresh linkage with exact errors and no writes; full fixture restored';
END $cp_restored$;
