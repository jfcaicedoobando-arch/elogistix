-- Diagnostic neutral cases, not evidence for the pending prospect exception.
-- Fixtures are synthetic; all public functions, constraints and triggers come
-- from the exact full repository replay. No direct accepted-state success path.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
\i supabase/tests/rls/_helpers.sql
CREATE FUNCTION pg_temp.require(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ACCEPTANCE_CI_ASSERT: %',message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_rejection(sql text, code text, message text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN EXECUTE sql;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE IS DISTINCT FROM code OR position(message in SQLERRM)=0 THEN
   RAISE EXCEPTION 'ACCEPTANCE_CI_WRONG_ERROR: expected %/%, got %/%',code,message,SQLSTATE,SQLERRM;
  END IF;
  rejected:=true;
 END;
 PERFORM pg_temp.require(rejected,'Expected rejection: '||message);
END $$;
CREATE FUNCTION pg_temp.as_actor(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_temp.as_user(uid);
 PERFORM pg_temp.require(current_user='authenticated' AND auth.uid()=uid AND auth.role()='authenticated','Real authenticated SQL role and subject required');
 PERFORM pg_temp.require(NOT public.has_role(uid,'super_admin'::public.app_role),'Test actor must not be a global administrator');
END $$;
CREATE FUNCTION pg_temp.org_state(org uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object(
  'quotes',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.cotizaciones t WHERE organization_id=org),'[]'::jsonb),
  'stage_history',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.crm_historial_etapas t WHERE organization_id=org),'[]'::jsonb),
  'opportunities',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.crm_oportunidades t WHERE organization_id=org),'[]'::jsonb),
  'leads',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.crm_leads t WHERE organization_id=org),'[]'::jsonb),
  'companies',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.crm_empresas t WHERE organization_id=org),'[]'::jsonb),
  'clients',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.clientes t WHERE organization_id=org),'[]'::jsonb),
  'audit',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.bitacora_actividad t WHERE organization_id=org),'[]'::jsonb),
  'notices',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.crm_notificaciones t WHERE organization_id=org),'[]'::jsonb),
  'shipments',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.embarques t WHERE organization_id=org),'[]'::jsonb),
  'invoices',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.facturas t WHERE organization_id=org),'[]'::jsonb)
 )
$$;
DO $cases$
DECLARE
 oa uuid:=gen_random_uuid(); ob uuid:=gen_random_uuid();
 manager_a uuid:=gen_random_uuid(); seller_a uuid:=gen_random_uuid(); manager_b uuid:=gen_random_uuid();
 client_a uuid:=gen_random_uuid(); quote_house uuid:=gen_random_uuid(); quote_expired uuid:=gen_random_uuid(); quote_orphan uuid:=gen_random_uuid();
 quote_crm uuid:=gen_random_uuid(); quote_second uuid:=gen_random_uuid(); quote_currency uuid:=gen_random_uuid();
 op uuid:=gen_random_uuid(); op_currency uuid:=gen_random_uuid(); stage_open uuid;
 response jsonb; retry jsonb; state_before jsonb; seal jsonb; quote_before jsonb;
BEGIN
 -- Strict auth seeds. A failed FK/seed aborts; no best-effort exception handler.
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
  (manager_a,'manager-a@test.invalid','{"skip_auto_org":"true"}'::jsonb),
  (seller_a,'seller-a@test.invalid','{"skip_auto_org":"true"}'::jsonb),
  (manager_b,'manager-b@test.invalid','{"skip_auto_org":"true"}'::jsonb);
 INSERT INTO public.organizations(id,nombre) VALUES(oa,'ACCEPTANCE CI A'),(ob,'ACCEPTANCE CI B');
 INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
  (oa,manager_a,'gerente_operaciones'),(oa,seller_a,'vendedor'),(ob,manager_b,'gerente_operaciones');
 -- The real membership mirror creates user_roles. Never insert duplicate roles
 -- or use legacy operador, which the real insert guard forbids.
 PERFORM pg_temp.require((SELECT count(*)=3 FROM public.user_roles WHERE
   (user_id IN (manager_a,manager_b) AND role::text='gerente_operaciones')
   OR (user_id=seller_a AND role::text='vendedor')),'Membership role mirror must be exact');
 SELECT id INTO stage_open FROM public.crm_etapas_pipeline
 WHERE organization_id=oa AND tipo='abierta' AND activa AND deleted_at IS NULL ORDER BY orden,id LIMIT 1;
 PERFORM pg_temp.require(stage_open IS NOT NULL,'Organization trigger must seed open pipeline');
 INSERT INTO public.clientes(id,organization_id,nombre,rfc,email,requiere_autorizacion_cotizacion)
 VALUES(client_a,oa,'Internal client','XAXX010101000','client@test.invalid',false);
 INSERT INTO public.crm_oportunidades(id,organization_id,nombre,cliente_id,etapa_id,vendedor_id,moneda) VALUES
  (op,oa,'Acceptance CRM',client_a,stage_open,seller_a,'MXN'),
  (op_currency,oa,'Currency guard',client_a,stage_open,seller_a,'MXN');
 INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,tipo_embarque,estado,version,cliente_id,
 es_prospecto,oportunidad_id,created_by,fecha_vigencia,conceptos_venta) VALUES
  (quote_house,oa,'CI-HOUSE','Marítimo','Importación','LCL','Borrador',3,client_a,false,NULL,seller_a,CURRENT_DATE+15,
   '[{"concepto":"Flete","cantidad":1,"precio_unitario":1500,"moneda":"MXN"}]'),
  (quote_expired,oa,'CI-EXPIRED','Marítimo','Importación','LCL','Borrador',3,client_a,false,NULL,seller_a,CURRENT_DATE-1,
   '[{"concepto":"Flete","cantidad":1,"precio_unitario":1500,"moneda":"MXN"}]'),
  (quote_orphan,oa,'CI-NO-CLIENT','Marítimo','Importación','LCL','Borrador',3,NULL,false,NULL,seller_a,CURRENT_DATE+15,
   '[{"concepto":"Flete","cantidad":1,"precio_unitario":1500,"moneda":"MXN"}]'),
  (quote_crm,oa,'CI-CRM','Marítimo','Importación','LCL','Enviada',4,client_a,false,op,seller_a,CURRENT_DATE+15,
   '[{"concepto":"Flete","cantidad":1,"precio_unitario":2300,"moneda":"MXN"}]'),
  (quote_second,oa,'CI-SECOND','Marítimo','Importación','LCL','Enviada',8,client_a,false,op,seller_a,CURRENT_DATE+15,
   '[{"concepto":"Flete","cantidad":1,"precio_unitario":2400,"moneda":"MXN"}]'),
  (quote_currency,oa,'CI-CURRENCY','Marítimo','Importación','LCL','Enviada',6,client_a,false,op_currency,seller_a,CURRENT_DATE+15,
   '[{"concepto":"Flete","cantidad":1,"precio_unitario":2500,"moneda":"MXN"}]');
 -- The real cotizacion→CRM trigger aligns the opportunity on INSERT; establish
 -- this negative AFTER seeding instead of assuming divergent currencies survived.
 UPDATE public.crm_oportunidades SET moneda='USD' WHERE id=op_currency;
 PERFORM pg_temp.require((SELECT fecha_vigencia<CURRENT_DATE FROM public.cotizaciones WHERE id=quote_expired),'Expired fixture must really be expired');
 state_before:=pg_temp.org_state(oa);
 PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
 PERFORM set_config('role','authenticated',true);
 PERFORM pg_temp.require(current_user='authenticated' AND auth.uid() IS NULL,'Broken subject fixture');
 PERFORM pg_temp.expect_rejection(format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',quote_house,'{}'),'42501','LC_SESION_REQUERIDA');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.require(pg_temp.org_state(oa)=state_before,'Missing-subject mutation leaked');
 RAISE NOTICE 'ACCEPTANCE_CASE:auth_no_subject_conversion';
 PERFORM pg_temp.as_actor(manager_b);
 PERFORM pg_temp.expect_rejection(format('SELECT public.aceptar_cotizacion_version(%L)',quote_house),'42501','LC_NO_AUTORIZADO');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.require(pg_temp.org_state(oa)=state_before,'Cross-tenant mutation leaked');
 RAISE NOTICE 'ACCEPTANCE_CASE:cross_tenant_acceptance';
 PERFORM pg_temp.as_actor(seller_a);
 PERFORM pg_temp.expect_rejection(format('SELECT public.aceptar_cotizacion_version(%L)',quote_house),'42501','LC_SOD_VIOLATION');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.require(pg_temp.org_state(oa)=state_before,'Creator SoD mutation leaked');
 RAISE NOTICE 'ACCEPTANCE_CASE:creator_sod';
 PERFORM pg_temp.as_actor(seller_a);
 PERFORM pg_temp.expect_rejection(format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',quote_house,'{}'),'42501','LC_CLIENTE_SIN_PERMISO');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.require(pg_temp.org_state(oa)=state_before,'Denied conversion mutation leaked');
 RAISE NOTICE 'ACCEPTANCE_CASE:conversion_seller_denied';
 PERFORM pg_temp.as_actor(manager_a);
 response:=public.aceptar_cotizacion_version(quote_house);
 PERFORM pg_temp.require(response->>'origen_aceptacion'='interna_cliente_de_casa' AND (response->>'version_aceptada')::int=3
   AND (response->>'sin_cambios')::boolean=false,'House acceptance response');
 PERFORM pg_temp.as_postgres();
 SELECT jsonb_build_object('version',version_aceptada,'at',aceptada_en,'by',aceptada_por) INTO seal FROM public.cotizaciones WHERE id=quote_house;
 PERFORM pg_temp.require((seal->>'version')::int=3 AND seal->>'at' IS NOT NULL AND (seal->>'by')::uuid=manager_a,'House sealed acceptance');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public.bitacora_actividad WHERE entidad_id=quote_house AND accion='cotizacion.aceptada_version_fijada'),'One house audit');
 RAISE NOTICE 'ACCEPTANCE_CASE:internal_house_acceptance';
 state_before:=pg_temp.org_state(oa);
 PERFORM pg_temp.as_actor(manager_a);
 retry:=public.aceptar_cotizacion_version(quote_house);
 PERFORM pg_temp.require((retry->>'sin_cambios')::boolean AND retry->>'version_aceptada'=response->>'version_aceptada','House retry response');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.require(pg_temp.org_state(oa)=state_before,'House retry must be byte-equivalent row state');
 RAISE NOTICE 'ACCEPTANCE_CASE:internal_house_retry';
 PERFORM pg_temp.as_actor(manager_a);
 PERFORM pg_temp.expect_rejection(format('SELECT public.aceptar_cotizacion_version(%L)',quote_expired),'P0001','LC_COT_VENCIDA');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.require(pg_temp.org_state(oa)=state_before,'Expired acceptance mutation leaked');
 RAISE NOTICE 'ACCEPTANCE_CASE:expired_rejected';
 PERFORM pg_temp.as_actor(manager_a);
 PERFORM pg_temp.expect_rejection(format('SELECT public.aceptar_cotizacion_version(%L)',quote_orphan),'P0001','LC_COT_SIN_CLIENTE');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.require(pg_temp.org_state(oa)=state_before,'Orphan acceptance mutation leaked');
 RAISE NOTICE 'ACCEPTANCE_CASE:missing_client_rejected';
 PERFORM pg_temp.as_actor(manager_a);
 response:=public.aceptar_cotizacion_version(quote_crm);
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.require((SELECT c.estado='Aceptada' AND c.version=4 AND c.version_aceptada=4
   AND c.aceptada_en IS NOT NULL AND c.aceptada_por=manager_a AND o.cotizacion_ganadora_id=c.id
   AND o.valor_real=c.subtotal AND c.subtotal=2300 AND e.tipo='ganada'
   FROM public.cotizaciones c JOIN public.crm_oportunidades o ON o.id=c.oportunidad_id
   JOIN public.crm_etapas_pipeline e ON e.id=o.etapa_id WHERE c.id=quote_crm),'Canonical CRM closure/seal/subtotal');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public.bitacora_actividad WHERE entidad_id=op AND accion='oportunidad_ganada_auto'),'One closure audit');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public.bitacora_actividad WHERE entidad_id=quote_crm AND accion='cotizacion.aceptada_version_fijada'),'One acceptance audit');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public.crm_notificaciones WHERE organization_id=oa AND user_id=seller_a
   AND tipo='oportunidad_ganada' AND link='/crm/oportunidades/'||op::text),'One seller notification, not zero-or-one');
 RAISE NOTICE 'ACCEPTANCE_CASE:crm_acceptance_and_seal';
 state_before:=pg_temp.org_state(oa);
 PERFORM pg_temp.as_actor(manager_a);
 retry:=public.aceptar_cotizacion_version(quote_crm);
 PERFORM pg_temp.require((retry->>'sin_cambios')::boolean,'CRM retry response');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.require(pg_temp.org_state(oa)=state_before,'CRM retry must preserve all captured rows');
 RAISE NOTICE 'ACCEPTANCE_CASE:crm_retry_no_duplicates';
 PERFORM pg_temp.as_actor(manager_a);
 PERFORM pg_temp.expect_rejection(format('SELECT public.aceptar_cotizacion_version(%L)',quote_second),'P0001','LC_COTIZACION_GANADORA_EXISTE');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.require(pg_temp.org_state(oa)=state_before,'Second winner failure must fully rollback');
 RAISE NOTICE 'ACCEPTANCE_CASE:second_winner_rollback';
 PERFORM pg_temp.as_actor(manager_a);
 PERFORM pg_temp.expect_rejection(format('SELECT public.aceptar_cotizacion_version(%L)',quote_currency),'P0001','LC_MONEDA_INCOMPATIBLE');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.require(pg_temp.org_state(oa)=state_before,'Currency error must rollback seal, winner, audit and notices');
 RAISE NOTICE 'ACCEPTANCE_CASE:currency_mismatch_rollback';
END $cases$;
ROLLBACK;
