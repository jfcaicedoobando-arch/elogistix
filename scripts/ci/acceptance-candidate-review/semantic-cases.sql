-- Acceptance v2: real baseline schema + exact proposed migration only.
-- Synthetic fixtures, real production functions/triggers/FKs/ACLs.
-- Local disposable PostgreSQL only. Every row and helper is rolled back.
-- This is executable candidate SQL, not a migration approval or PAC test.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '180s';
SET LOCAL lock_timeout = '5s';
CREATE TEMP TABLE acceptance_v2_seen(case_name text PRIMARY KEY);
CREATE FUNCTION pg_temp.require(ok boolean, message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'ACCEPTANCE_V2_ASSERT: %', message; END IF;
END $$;
CREATE FUNCTION pg_temp.as_postgres() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM set_config('request.jwt.claims', '', true);
 PERFORM set_config('role', 'none', true);
 RESET ROLE;
 PERFORM pg_temp.require(current_user = 'postgres' AND auth.uid() IS NULL, 'Fixture/snapshot role must be postgres with no JWT subject');
END $$;
CREATE FUNCTION pg_temp.as_actor(uid uuid, allow_super boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 PERFORM set_config('role','authenticated',true);
 PERFORM pg_temp.require(current_user='authenticated' AND auth.role()='authenticated'
   AND auth.uid() IS NOT DISTINCT FROM uid,'Actual authenticated SQL role, JWT role, and subject required');
 IF uid IS NOT NULL AND NOT allow_super THEN
  PERFORM pg_temp.require(NOT public.has_role(uid,'super_admin'::public.app_role),'Ordinary test actor must not be a global administrator');
 END IF;
END $$;
CREATE FUNCTION pg_temp.mark(name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_temp.require(current_user='postgres','Emit marker only after returning to snapshot role');
 INSERT INTO pg_temp.acceptance_v2_seen(case_name) VALUES(name);
 RAISE NOTICE 'ACCEPTANCE_V2_CASE:%', name;
END $$;
-- Includes every ordinary/partitioned public table with a UUID organization_id,
-- not just hand-picked business tables; both tenants are captured. Whole row
-- JSON includes deleted rows and every column. Views and global catalog tables
-- are excluded deliberately; this is not a full database hash.
CREATE FUNCTION pg_temp.org_state(orgs uuid[]) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE t record; rows jsonb; result jsonb := '{}'::jsonb;
BEGIN
 PERFORM pg_temp.require(current_user='postgres','Snapshots must not be narrowed by authenticated RLS');
 FOR t IN
  SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='organization_id'
   AND a.atttypid='uuid'::regtype AND NOT a.attisdropped
  WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname
 LOOP
  EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),''[]''::jsonb) FROM %I.%I x WHERE organization_id=ANY($1)',t.nspname,t.relname)
   INTO rows USING orgs;
  result := result || jsonb_build_object(t.relname,rows);
 END LOOP;
 SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.id),'[]'::jsonb) INTO rows
  FROM public.organizations o WHERE o.id=ANY(orgs);
 RETURN result || jsonb_build_object('organizations',rows);
END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, code text, domain text, exact_message text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean:=false; actual_code text; actual_message text;
BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE, actual_message=MESSAGE_TEXT;
  IF actual_code IS DISTINCT FROM code OR split_part(actual_message,':',1) IS DISTINCT FROM domain
    OR (exact_message IS NOT NULL AND actual_message IS DISTINCT FROM exact_message) THEN
   RAISE EXCEPTION 'ACCEPTANCE_V2_WRONG_ERROR: expected %/%/%, got %/%',code,domain,exact_message,actual_code,actual_message;
  END IF;
  rejected:=true;
 END;
 PERFORM pg_temp.require(rejected,'Expected rejection: '||domain);
END $$;
CREATE FUNCTION pg_temp.negative(name text, orgs uuid[], uid uuid, statement text, code text, domain text,
 exact_message text DEFAULT NULL, allow_super boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
DECLARE before_state jsonb;
BEGIN
 before_state:=pg_temp.org_state(orgs);
 PERFORM pg_temp.as_actor(uid,allow_super);
 PERFORM pg_temp.expect_error(statement,code,domain,exact_message);
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.require(pg_temp.org_state(orgs) IS NOT DISTINCT FROM before_state,
   name||': rejection must preserve every captured row in both tenants');
 PERFORM pg_temp.mark(name);
END $$;
CREATE FUNCTION pg_temp.accept_as(uid uuid, quote_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE response jsonb;
BEGIN
 PERFORM pg_temp.as_actor(uid);
 response:=public.aceptar_cotizacion_version(quote_id);
 PERFORM pg_temp.as_postgres();
 RETURN response;
END $$;
CREATE FUNCTION pg_temp.convert_as(uid uuid, quote_id uuid, payload jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE response jsonb;
BEGIN
 PERFORM pg_temp.as_actor(uid);
 response:=public.convertir_prospecto_a_cliente_rpc(quote_id,payload);
 PERFORM pg_temp.as_postgres();
 RETURN response;
END $$;
CREATE FUNCTION pg_temp.seed_prospect(org uuid, seller uuid, stage uuid, label text,
 links text DEFAULT 'none', quote_state text DEFAULT 'Enviada')
RETURNS TABLE(quote_id uuid, op_id uuid, lead_id uuid, company_id uuid) LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_temp.require(current_user='postgres' AND auth.uid() IS NULL,'Strict fixture role');
 quote_id:=gen_random_uuid();op_id:=gen_random_uuid();lead_id:=gen_random_uuid();company_id:=NULL;
 INSERT INTO public.crm_leads(id,organization_id,empresa,estado,vendedor_id)
  VALUES(lead_id,org,'Acceptance v2 '||label,'Prospecto',seller);
 INSERT INTO public.crm_oportunidades(id,organization_id,nombre,lead_id,etapa_id,vendedor_id,moneda)
  VALUES(op_id,org,'Acceptance v2 '||label,lead_id,stage,seller,'MXN');
 IF links<>'none' THEN
  PERFORM pg_temp.require(links IN ('lead','link','both'),'Unknown company fixture type');
  company_id:=gen_random_uuid();
  INSERT INTO public.crm_empresas(id,organization_id,nombre,lead_origen_id,estado_crm)
   VALUES(company_id,org,'Acceptance v2 '||label,CASE WHEN links IN ('lead','both') THEN lead_id ELSE NULL END,'Prospecto');
  IF links IN ('link','both') THEN
   INSERT INTO public.crm_oportunidad_empresa(organization_id,oportunidad_id,empresa_id) VALUES(org,op_id,company_id);
  END IF;
 END IF;
 -- No direct accepted-state fixtures. All successful acceptances call the RPC.
 PERFORM pg_temp.require(quote_state IN ('Borrador','Enviada','Solicitada','Rechazada','Vencida','Archivada'),'No synthetic accepted-state fixture');
 INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,tipo_embarque,estado,cliente_id,es_prospecto,
  prospecto_empresa,oportunidad_id,created_by,version,fecha_vigencia,conceptos_venta)
 VALUES(quote_id,org,'V2-'||quote_id::text,'Marítimo','Importación','LCL',
  CASE WHEN quote_state='Enviada' THEN 'Borrador' ELSE quote_state END::public.estado_cotizacion,
  NULL,true,'Acceptance v2 '||label,op_id,seller,7,CURRENT_DATE+15,
  '[{"concepto":"Flete","cantidad":2,"precio_unitario":1150,"moneda":"MXN"}]'::jsonb);
 IF quote_state='Enviada' THEN UPDATE public.cotizaciones SET estado='Enviada' WHERE id=quote_id; END IF;
 RETURN NEXT;
END $$;
CREATE FUNCTION pg_temp.seal(quote_id uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('version',version_aceptada,'at',aceptada_en,'by',aceptada_por)
 FROM public.cotizaciones WHERE id=quote_id
$$;
CREATE FUNCTION pg_temp.assert_accepted(q uuid, op uuid, lead uuid, actor uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_temp.require((SELECT estado='Aceptada' AND version=7 AND version_aceptada=7
  AND aceptada_en=transaction_timestamp() AND aceptada_por=actor AND cliente_id IS NULL AND es_prospecto
  AND subtotal=2300 FROM public.cotizaciones WHERE id=q),'Exact prospect acceptance, amount and seal');
 PERFORM pg_temp.require((SELECT o.cliente_id IS NULL AND o.cotizacion_ganadora_id=q
  AND o.valor_real=2300 AND o.probabilidad=100 AND e.tipo='ganada'
  FROM public.crm_oportunidades o JOIN public.crm_etapas_pipeline e ON e.id=o.etapa_id WHERE o.id=op),'Canonical CRM winner');
 PERFORM pg_temp.require((SELECT estado::text='Pendiente de alta' AND cliente_convertido_id IS NULL
  FROM public.crm_leads WHERE id=lead),'Acceptance advances actual source lead only to Pendiente de alta');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public.bitacora_actividad WHERE entidad_id=q AND accion='cotizacion.aceptada_version_fijada'),'Exactly one acceptance audit');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public.bitacora_actividad WHERE entidad_id=op AND accion='oportunidad_ganada_auto'),'Exactly one CRM close audit');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public.crm_historial_etapas WHERE oportunidad_id=op),'Exactly one stage history transition');
 PERFORM pg_temp.require((SELECT count(*)=1 FROM public.crm_notificaciones n JOIN public.crm_oportunidades o ON o.id=op
  WHERE n.organization_id=o.organization_id AND n.user_id=o.vendedor_id AND n.tipo='oportunidad_ganada'
  AND n.link='/crm/oportunidades/'||op::text),'Exactly one seller CRM winner notice');
END $$;
DO $cases$
DECLARE
 oa uuid:=gen_random_uuid(); ob uuid:=gen_random_uuid(); orgs uuid[];
 manager_a uuid:=gen_random_uuid(); seller_a uuid:=gen_random_uuid(); manager_b uuid:=gen_random_uuid();
 observer_a uuid:=gen_random_uuid(); super_actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 house_client uuid:=gen_random_uuid(); house_quote uuid:=gen_random_uuid(); orphan_quote uuid:=gen_random_uuid();
 open_a uuid:=gen_random_uuid(); open_b uuid:=gen_random_uuid(); lost_a uuid:=gen_random_uuid();
 f record; g record; main_f record; retry_f record;
 response jsonb; retry jsonb; before_state jsonb; old_seal jsonb; payload jsonb; changed jsonb;
 client_id uuid; reused uuid; company uuid; saved uuid; field text; mode text; state text;
 count_before bigint; accessory_before jsonb; original_origin text; new_origin text; initial_clients jsonb;
BEGIN
 PERFORM pg_temp.as_postgres();
 orgs:=ARRAY[oa,ob];
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
  (manager_a,'v2-manager-a@test.invalid','{"skip_auto_org":"true"}'),
  (seller_a,'v2-seller-a@test.invalid','{"skip_auto_org":"true"}'),
  (manager_b,'v2-manager-b@test.invalid','{"skip_auto_org":"true"}'),
  (observer_a,'v2-observer@test.invalid','{"skip_auto_org":"true"}'),
  (super_actor,'v2-global-admin@test.invalid','{"skip_auto_org":"true"}'),
  (outsider,'v2-nonmember@test.invalid','{"skip_auto_org":"true"}');
 INSERT INTO public.organizations(id,nombre) VALUES(oa,'ACCEPTANCE V2 A'),(ob,'ACCEPTANCE V2 B');
 INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
  (oa,manager_a,'gerente_operaciones'),(oa,seller_a,'vendedor'),
  (ob,manager_b,'gerente_operaciones'),(oa,observer_a,'customer_service');
 -- Real membership trigger must supply the exact modern mirrors, no duplicates.
 PERFORM pg_temp.require((SELECT count(*)=4 FROM public.user_roles WHERE
  (user_id IN (manager_a,manager_b) AND role::text='gerente_operaciones')
  OR (user_id=seller_a AND role::text='vendedor') OR (user_id=observer_a AND role::text='customer_service')),'Exact membership mirrors');
 INSERT INTO public.user_roles(user_id,role) VALUES(super_actor,'super_admin');
 INSERT INTO public.super_admin_org_activa(user_id,organization_id) VALUES(super_actor,ob);
 INSERT INTO public.crm_etapas_pipeline(id,organization_id,nombre,tipo,orden,probabilidad_default,activa) VALUES
  (open_a,oa,'V2 abierta','abierta',901,50,true),(open_b,ob,'V2 abierta','abierta',901,50,true),
  (lost_a,oa,'V2 perdida','perdida',903,0,true);
 PERFORM pg_temp.require(EXISTS(SELECT 1 FROM public.crm_etapas_pipeline WHERE organization_id=oa AND tipo='ganada' AND activa AND deleted_at IS NULL),'Real org provisioning seeds won stage');
 PERFORM pg_temp.as_actor(manager_a);
 PERFORM pg_temp.require(public.org_scope()=oa AND public.is_org_member(oa) AND public.rls_tenant_scope_ok(oa),'Manager has exact active tenant A');
 PERFORM pg_temp.require(public.has_any_role_in_org(manager_a,ARRAY['operador']::public.app_role[],oa),'Modern manager expands through existing hierarchy');
 PERFORM pg_temp.as_postgres();
 INSERT INTO public.clientes(id,organization_id,nombre,rfc,email,requiere_autorizacion_cotizacion)
  VALUES(house_client,oa,'V2 Internal house','HOU010101AB1','v2-house@test.invalid',false);
 INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,tipo_embarque,estado,version,cliente_id,created_by,
  fecha_vigencia,conceptos_venta) VALUES
  (house_quote,oa,'V2-HOUSE','Marítimo','Importación','LCL','Borrador',3,house_client,seller_a,CURRENT_DATE+15,
  '[{"concepto":"Flete","cantidad":1,"precio_unitario":1500,"moneda":"MXN"}]'),
  (orphan_quote,oa,'V2-NO-CLIENT','Marítimo','Importación','LCL','Borrador',3,NULL,seller_a,CURRENT_DATE+15,
  '[{"concepto":"Flete","cantidad":1,"precio_unitario":1500,"moneda":"MXN"}]');
 SELECT * INTO main_f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'canonical-no-company');
 payload:='{"nombre":"  Prospecto   Normalizado  ","contacto":"  Ana  ","email":"  ANA@EXAMPLE.INVALID  ","telefono":"  5555555555  ","rfc":"  abc010101ab1  ","direccion":"  Calle 1  ","ciudad":"  CDMX  ","estado":"  CDMX  ","cp":"  06600  ","regimen_fiscal":"  601  ","uso_cfdi_default":"  G03  ","forma_pago_default":"  99  ","metodo_pago_default":"  PPD  "}'::jsonb;

  PERFORM pg_temp.require((SELECT md5(prosrc)='3e6c98ccda2d8296c8e3c95a6470ac33' FROM pg_proc WHERE oid=to_regprocedure('public._crm_lead_avanzar_por_cotizacion()')),'Unmodified real baseline function: public._crm_lead_avanzar_por_cotizacion()');

  PERFORM pg_temp.require((SELECT md5(prosrc)='e824de8d54e71b840a4aa6a5ed10ac89' FROM pg_proc WHERE oid=to_regprocedure('public.convertir_prospecto_a_cliente_rpc(uuid,jsonb)')),'Unmodified real baseline function: public.convertir_prospecto_a_cliente_rpc(uuid,jsonb)');

  PERFORM pg_temp.require((SELECT md5(prosrc)='092c01500a40498121f58ac4de745099' FROM pg_proc WHERE oid=to_regprocedure('public.crear_embarque_borrador_core(uuid)')),'Unmodified real baseline function: public.crear_embarque_borrador_core(uuid)');

  PERFORM pg_temp.require((SELECT md5(prosrc)='8f83e3c8a1ac14f12f90a78b43c43490' FROM pg_proc WHERE oid=to_regprocedure('public.crear_embarque_borrador_desde_cotizacion(uuid,text,uuid,jsonb)')),'Unmodified real baseline function: public.crear_embarque_borrador_desde_cotizacion(uuid,text,uuid,jsonb)');

  PERFORM pg_temp.require((SELECT md5(prosrc)='43f0813f3b6e8371be7fdbdbc0a857a0' FROM pg_proc WHERE oid=to_regprocedure('public.crm_cerrar_oportunidad_desde_cotizacion()')),'Unmodified real baseline function: public.crm_cerrar_oportunidad_desde_cotizacion()');

  PERFORM pg_temp.require((SELECT md5(prosrc)='b21977a52fdb7980ab479aa9ca89b102' FROM pg_proc WHERE oid=to_regprocedure('public._crm_lead_sync_estado_empresa()')),'Unmodified real baseline function: public._crm_lead_sync_estado_empresa()');

  PERFORM pg_temp.require((SELECT md5(prosrc)='889c54ee82a7859bb811aef709c6dc8a' FROM pg_proc WHERE oid=to_regprocedure('public.crear_factura_manual_idempotente(uuid,jsonb,jsonb)')),'Unmodified real baseline function: public.crear_factura_manual_idempotente(uuid,jsonb,jsonb)');

  PERFORM pg_temp.mark('unmodified_converter_and_downstream_guards');

  PERFORM pg_temp.mark('strict_authenticated_fixtures');

  PERFORM pg_temp.negative('auth_missing_subject_acceptance', orgs, NULL, format('SELECT public.aceptar_cotizacion_version(%L)',main_f.quote_id), '42501', 'LC_NO_AUTORIZADO', NULL, false);

  PERFORM pg_temp.negative('auth_missing_subject_conversion', orgs, NULL, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload), '42501', 'LC_SESION_REQUERIDA', NULL, false);

  PERFORM pg_temp.negative('auth_nonmember_acceptance', orgs, outsider, format('SELECT public.aceptar_cotizacion_version(%L)',main_f.quote_id), '42501', 'LC_NO_AUTORIZADO', NULL, false);

  PERFORM pg_temp.negative('auth_role_denied_acceptance', orgs, observer_a, format('SELECT public.aceptar_cotizacion_version(%L)',main_f.quote_id), '42501', 'LC_NO_AUTORIZADO', NULL, false);

  PERFORM pg_temp.negative('tenant_other_org_acceptance', orgs, manager_b, format('SELECT public.aceptar_cotizacion_version(%L)',main_f.quote_id), '42501', 'LC_NO_AUTORIZADO', NULL, false);

  PERFORM pg_temp.negative('tenant_other_org_conversion', orgs, manager_b, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload), '42501', 'LC_ORG_AJENA', NULL, false);

  PERFORM pg_temp.as_actor(super_actor,true);
  PERFORM pg_temp.require(public.has_role(super_actor,'super_admin'::public.app_role) AND public.org_scope()=ob AND public.is_org_member(oa), 'Global admin may authorize organization A but active scope is B');
  PERFORM pg_temp.as_postgres();

  PERFORM pg_temp.negative('tenant_superadmin_active_other_org', orgs, super_actor, format('SELECT public.aceptar_cotizacion_version(%L)',main_f.quote_id), '42501', 'LC_NO_AUTORIZADO', NULL, true);

  PERFORM pg_temp.negative('creator_sod_acceptance', orgs, seller_a, format('SELECT public.aceptar_cotizacion_version(%L)',main_f.quote_id), '42501', 'LC_SOD_VIOLATION', NULL, false);

  PERFORM pg_temp.negative('conversion_seller_denied_before_acceptance', orgs, seller_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload), '42501', 'LC_CLIENTE_SIN_PERMISO', NULL, false);

  PERFORM pg_temp.negative('conversion_requires_accepted', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload), 'P0001', 'LC_COTIZACION_ESTADO_INVALIDO', NULL, false);

  PERFORM pg_temp.negative('nonprospect_missing_client', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',orphan_quote), 'P0001', 'LC_COT_SIN_CLIENTE', NULL, false);

  response:=pg_temp.accept_as(manager_a,house_quote);
  PERFORM pg_temp.require(response = jsonb_build_object('cotizacion_id',house_quote,'version_aceptada',3,'origen_aceptacion','interna_cliente_de_casa','sin_cambios',false),'House response exact');
  PERFORM pg_temp.require((SELECT estado='Aceptada' AND oportunidad_id IS NULL AND version_aceptada=3 AND aceptada_en=transaction_timestamp() AND aceptada_por=manager_a FROM public.cotizaciones WHERE id=house_quote),'House exact seal without CRM');
  PERFORM pg_temp.require((SELECT count(*)=1 FROM public.bitacora_actividad WHERE entidad_id=house_quote AND accion='cotizacion.aceptada_version_fijada'),'Exactly one house audit');

  PERFORM pg_temp.mark('internal_house_acceptance');

  before_state:=pg_temp.org_state(orgs); retry:=pg_temp.accept_as(manager_a,house_quote);
  PERFORM pg_temp.require(retry=response||'{"sin_cambios":true}'::jsonb AND pg_temp.org_state(orgs)=before_state,'House retry is exact and row-state immutable');

  PERFORM pg_temp.mark('internal_house_retry');

  initial_clients:=(pg_temp.org_state(orgs))->'clientes';
  response:=pg_temp.accept_as(manager_a,main_f.quote_id);
  original_origin:=response->>'origen_aceptacion';
  PERFORM pg_temp.require(response=jsonb_build_object('cotizacion_id',main_f.quote_id,'version_aceptada',7,'origen_aceptacion','aceptacion_prospecto_crm','sin_cambios',false),'Exact canonical prospect response');
  PERFORM pg_temp.assert_accepted(main_f.quote_id,main_f.op_id,main_f.lead_id,manager_a);
  PERFORM pg_temp.require((pg_temp.org_state(orgs))->'clientes'=initial_clients,'Accept creates or changes no client');
  old_seal:=pg_temp.seal(main_f.quote_id);

  PERFORM pg_temp.mark('prospect_acceptance_without_company');

  before_state:=pg_temp.org_state(orgs);retry:=pg_temp.accept_as(manager_a,main_f.quote_id);
  PERFORM pg_temp.require(retry=response||'{"sin_cambios":true}'::jsonb AND pg_temp.org_state(orgs)=before_state,'Retry at Pendiente de alta is exact and read-only');

  PERFORM pg_temp.mark('prospect_retry_pending_registration');

  PERFORM pg_temp.negative('accepted_seller_retry_still_denied', orgs, seller_a, format('SELECT public.aceptar_cotizacion_version(%L)',main_f.quote_id), '42501', 'LC_SOD_VIOLATION', NULL, false);

  PERFORM pg_temp.negative('accepted_cross_tenant_retry_still_denied', orgs, manager_b, format('SELECT public.aceptar_cotizacion_version(%L)',main_f.quote_id), '42501', 'LC_NO_AUTORIZADO', NULL, false);

  PERFORM pg_temp.negative('shipment_before_conversion_rejected', orgs, manager_a, format('SELECT public.crear_embarque_borrador_desde_cotizacion(%L,%L,NULL,NULL)',main_f.quote_id,'sin_cambios'), 'P0001', 'LC_COT_SIN_CLIENTE', NULL, false);

  PERFORM pg_temp.negative('accepted_amount_immutable', orgs, manager_a, format('UPDATE public.cotizaciones SET conceptos_venta=%L::jsonb WHERE id=%L','[{"concepto":"Flete","cantidad":1,"precio_unitario":9999,"moneda":"MXN"}]',main_f.quote_id), 'P0001', 'LC_COTIZACION_INMUTABLE', NULL, false);

  PERFORM pg_temp.negative('fiscal_missing_contacto', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload - 'contacto'), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: contacto', false);

  PERFORM pg_temp.negative('fiscal_missing_email', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload - 'email'), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: email', false);

  PERFORM pg_temp.negative('fiscal_missing_telefono', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload - 'telefono'), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: telefono', false);

  PERFORM pg_temp.negative('fiscal_missing_rfc', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload - 'rfc'), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: rfc', false);

  PERFORM pg_temp.negative('fiscal_missing_cp', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload - 'cp'), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: cp', false);

  PERFORM pg_temp.negative('fiscal_missing_regimen_fiscal', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload - 'regimen_fiscal'), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: regimen_fiscal', false);

  PERFORM pg_temp.negative('fiscal_missing_uso_cfdi_default', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload - 'uso_cfdi_default'), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: uso_cfdi_default', false);

  PERFORM pg_temp.negative('fiscal_missing_forma_pago_default', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload - 'forma_pago_default'), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: forma_pago_default', false);

  PERFORM pg_temp.negative('fiscal_missing_metodo_pago_default', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload - 'metodo_pago_default'), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: metodo_pago_default', false);

  PERFORM pg_temp.negative('fiscal_missing_direccion', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload - 'direccion'), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: direccion', false);

  PERFORM pg_temp.negative('fiscal_missing_nombre', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,payload - 'nombre'), 'P0001', 'LC_CLIENTE_SIN_NOMBRE', 'LC_CLIENTE_SIN_NOMBRE', false);

  PERFORM pg_temp.negative('fiscal_null_contacto', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['contacto'],'null'::jsonb)), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: contacto', false);

  PERFORM pg_temp.negative('fiscal_null_email', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['email'],'null'::jsonb)), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: email', false);

  PERFORM pg_temp.negative('fiscal_null_telefono', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['telefono'],'null'::jsonb)), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: telefono', false);

  PERFORM pg_temp.negative('fiscal_null_rfc', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['rfc'],'null'::jsonb)), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: rfc', false);

  PERFORM pg_temp.negative('fiscal_null_cp', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['cp'],'null'::jsonb)), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: cp', false);

  PERFORM pg_temp.negative('fiscal_null_regimen_fiscal', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['regimen_fiscal'],'null'::jsonb)), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: regimen_fiscal', false);

  PERFORM pg_temp.negative('fiscal_null_uso_cfdi_default', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['uso_cfdi_default'],'null'::jsonb)), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: uso_cfdi_default', false);

  PERFORM pg_temp.negative('fiscal_null_forma_pago_default', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['forma_pago_default'],'null'::jsonb)), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: forma_pago_default', false);

  PERFORM pg_temp.negative('fiscal_null_metodo_pago_default', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['metodo_pago_default'],'null'::jsonb)), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: metodo_pago_default', false);

  PERFORM pg_temp.negative('fiscal_null_direccion', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['direccion'],'null'::jsonb)), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: direccion', false);

  PERFORM pg_temp.negative('fiscal_null_nombre', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['nombre'],'null'::jsonb)), 'P0001', 'LC_CLIENTE_SIN_NOMBRE', 'LC_CLIENTE_SIN_NOMBRE', false);

  PERFORM pg_temp.negative('fiscal_blank_contacto', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['contacto'],to_jsonb('   '::text))), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: contacto', false);

  PERFORM pg_temp.negative('fiscal_blank_email', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['email'],to_jsonb('   '::text))), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: email', false);

  PERFORM pg_temp.negative('fiscal_blank_telefono', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['telefono'],to_jsonb('   '::text))), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: telefono', false);

  PERFORM pg_temp.negative('fiscal_blank_rfc', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['rfc'],to_jsonb('   '::text))), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: rfc', false);

  PERFORM pg_temp.negative('fiscal_blank_cp', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['cp'],to_jsonb('   '::text))), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: cp', false);

  PERFORM pg_temp.negative('fiscal_blank_regimen_fiscal', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['regimen_fiscal'],to_jsonb('   '::text))), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: regimen_fiscal', false);

  PERFORM pg_temp.negative('fiscal_blank_uso_cfdi_default', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['uso_cfdi_default'],to_jsonb('   '::text))), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: uso_cfdi_default', false);

  PERFORM pg_temp.negative('fiscal_blank_forma_pago_default', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['forma_pago_default'],to_jsonb('   '::text))), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: forma_pago_default', false);

  PERFORM pg_temp.negative('fiscal_blank_metodo_pago_default', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['metodo_pago_default'],to_jsonb('   '::text))), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: metodo_pago_default', false);

  PERFORM pg_temp.negative('fiscal_blank_direccion', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['direccion'],to_jsonb('   '::text))), 'P0001', 'LC_CLIENTE_FISCAL_INCOMPLETO', 'LC_CLIENTE_FISCAL_INCOMPLETO: direccion', false);

  PERFORM pg_temp.negative('fiscal_blank_nombre', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,jsonb_set(payload,ARRAY['nombre'],to_jsonb('   '::text))), 'P0001', 'LC_CLIENTE_SIN_NOMBRE', 'LC_CLIENTE_SIN_NOMBRE', false);

  response:=pg_temp.convert_as(manager_a,main_f.quote_id,payload);
  client_id:=(response->>'cliente_id')::uuid;
  PERFORM pg_temp.require(client_id IS NOT NULL AND (response->>'creado')::boolean AND NOT (response->>'sin_cambios')::boolean,'Original converter creates exactly once');
  PERFORM pg_temp.require((SELECT nombre='PROSPECTO NORMALIZADO' AND contacto='Ana' AND email='ana@example.invalid' AND telefono='5555555555' AND rfc='ABC010101AB1' AND direccion='Calle 1' AND ciudad='CDMX' AND estado='CDMX' AND cp='06600' AND regimen_fiscal='601' AND uso_cfdi_default='G03' AND forma_pago_default='99' AND metodo_pago_default='PPD' FROM public.clientes WHERE id=client_id),'Every normalized fiscal field is stored canonically');
  PERFORM pg_temp.require((SELECT c.cliente_id=client_id AND NOT c.es_prospecto AND c.cliente_nombre='PROSPECTO NORMALIZADO' FROM public.cotizaciones c WHERE c.id=main_f.quote_id),'Canonical quote identity');
  PERFORM pg_temp.require((SELECT o.cliente_id=client_id FROM public.crm_oportunidades o WHERE o.id=main_f.op_id),'Canonical opportunity client');
  PERFORM pg_temp.require((SELECT estado::text='Convertido' AND cliente_convertido_id=client_id AND oportunidad_convertida_id=main_f.op_id FROM public.crm_leads WHERE id=main_f.lead_id),'Canonical converted lead');
  PERFORM pg_temp.require(pg_temp.seal(main_f.quote_id)=old_seal,'Original converter preserves exact original acceptance seal');

  PERFORM pg_temp.mark('conversion_real_rfc_normalization');

  before_state:=pg_temp.org_state(orgs);retry:=pg_temp.convert_as(manager_a,main_f.quote_id,'{}'::jsonb);
  PERFORM pg_temp.require((retry->>'cliente_id')::uuid=client_id AND (retry->>'sin_cambios')::boolean AND NOT (retry->>'creado')::boolean AND (retry->>'cotizaciones_revinculadas')::int=0 AND pg_temp.org_state(orgs)=before_state,'Original conversion retry precedes fiscal parsing only after coherent authorization');

  PERFORM pg_temp.mark('conversion_retry_exact_rows');

  before_state:=pg_temp.org_state(orgs);retry:=pg_temp.accept_as(manager_a,main_f.quote_id);new_origin:=retry->>'origen_aceptacion';
  PERFORM pg_temp.require((retry->>'sin_cambios')::boolean AND new_origin='autorizacion_cliente' AND original_origin='aceptacion_prospecto_crm' AND pg_temp.org_state(orgs)=before_state,'Post-conversion response uses original existing-client branch; rows remain unchanged');
  PERFORM pg_temp.require((SELECT count(*)=1 AND bool_and(detalles->>'origen_aceptacion'='aceptacion_prospecto_crm') FROM public.bitacora_actividad WHERE entidad_id=main_f.quote_id AND accion='cotizacion.aceptada_version_fijada'),'Original acceptance audit origin remains prospect despite response origin changing');
  PERFORM pg_temp.require((SELECT count(*)=1 FROM public.bitacora_actividad WHERE entidad_id=main_f.quote_id AND accion='convertir_prospecto_a_cliente'),'One original conversion audit');
  PERFORM pg_temp.require(pg_temp.seal(main_f.quote_id)=old_seal,'Post-conversion accept retry keeps seal exact');

  PERFORM pg_temp.mark('post_conversion_accept_retry_origin_characterized');

  PERFORM pg_temp.negative('conversion_retry_seller_denied', orgs, seller_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,'{}'), '42501', 'LC_CLIENTE_SIN_PERMISO', NULL, false);

  PERFORM pg_temp.negative('conversion_retry_cross_tenant_denied', orgs, manager_b, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',main_f.quote_id,'{}'), '42501', 'LC_ORG_AJENA', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'optional-lead','lead');
  response:=pg_temp.accept_as(manager_a,f.quote_id);
  PERFORM pg_temp.assert_accepted(f.quote_id,f.op_id,f.lead_id,manager_a);
  PERFORM pg_temp.require((SELECT estado_crm='Prospecto' AND cliente_id IS NULL FROM public.crm_empresas WHERE id=f.company_id),'Optional lead company stays Prospecto on acceptance');

  PERFORM pg_temp.mark('optional_lead_company_acceptance');

  old_seal:=pg_temp.seal(f.quote_id);
  changed:=payload || jsonb_build_object('nombre','Generic lead','email','generic-lead@example.invalid','rfc',' xaxx010101000 ');
  changed:=changed-'direccion'-'ciudad'-'estado';
  response:=pg_temp.convert_as(manager_a,f.quote_id,changed);reused:=(response->>'cliente_id')::uuid;
  PERFORM pg_temp.require((response->>'creado')::boolean AND reused<>house_client AND reused<>client_id,'Generic RFC creates a distinct client; does not reuse house/generic RFC');
  PERFORM pg_temp.require((SELECT rfc='XAXX010101000' AND direccion='' AND ciudad='' AND estado='' FROM public.clientes WHERE id=reused),'Generic RFC allows omitted address/city/state');
  PERFORM pg_temp.require((SELECT estado_crm='Cliente' AND cliente_id IS NULL FROM public.crm_empresas WHERE id=f.company_id),'Original company-state behavior follows only lead_origen_id; converter does not assign company cliente_id');
  PERFORM pg_temp.require((SELECT estado::text='Convertido' AND cliente_convertido_id=reused FROM public.crm_leads WHERE id=f.lead_id),'Company fixture lead converts canonically');
  PERFORM pg_temp.require(pg_temp.seal(f.quote_id)=old_seal,'Company conversion preserves seal');

  PERFORM pg_temp.mark('optional_lead_company_conversion');

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'optional-link','link');
  response:=pg_temp.accept_as(manager_a,f.quote_id);
  PERFORM pg_temp.assert_accepted(f.quote_id,f.op_id,f.lead_id,manager_a);
  PERFORM pg_temp.require((SELECT estado_crm='Prospecto' AND cliente_id IS NULL FROM public.crm_empresas WHERE id=f.company_id),'Optional link company stays Prospecto on acceptance');

  PERFORM pg_temp.mark('optional_link_company_acceptance');

  old_seal:=pg_temp.seal(f.quote_id);
  changed:=payload || jsonb_build_object('nombre','Generic link','email','generic-link@example.invalid','rfc',' xaxx010101000 ');
  changed:=changed-'direccion'-'ciudad'-'estado';
  response:=pg_temp.convert_as(manager_a,f.quote_id,changed);reused:=(response->>'cliente_id')::uuid;
  PERFORM pg_temp.require((response->>'creado')::boolean AND reused<>house_client AND reused<>client_id,'Generic RFC creates a distinct client; does not reuse house/generic RFC');
  PERFORM pg_temp.require((SELECT rfc='XAXX010101000' AND direccion='' AND ciudad='' AND estado='' FROM public.clientes WHERE id=reused),'Generic RFC allows omitted address/city/state');
  PERFORM pg_temp.require((SELECT estado_crm='Prospecto' AND cliente_id IS NULL FROM public.crm_empresas WHERE id=f.company_id),'Original company-state behavior follows only lead_origen_id; converter does not assign company cliente_id');
  PERFORM pg_temp.require((SELECT estado::text='Convertido' AND cliente_convertido_id=reused FROM public.crm_leads WHERE id=f.lead_id),'Company fixture lead converts canonically');
  PERFORM pg_temp.require(pg_temp.seal(f.quote_id)=old_seal,'Company conversion preserves seal');

  PERFORM pg_temp.mark('optional_link_company_conversion');

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'optional-both','both');
  response:=pg_temp.accept_as(manager_a,f.quote_id);
  PERFORM pg_temp.assert_accepted(f.quote_id,f.op_id,f.lead_id,manager_a);
  PERFORM pg_temp.require((SELECT estado_crm='Prospecto' AND cliente_id IS NULL FROM public.crm_empresas WHERE id=f.company_id),'Optional both company stays Prospecto on acceptance');

  PERFORM pg_temp.mark('optional_both_company_acceptance');

  old_seal:=pg_temp.seal(f.quote_id);
  changed:=payload || jsonb_build_object('nombre','Generic both','email','generic-both@example.invalid','rfc',' xaxx010101000 ');
  changed:=changed-'direccion'-'ciudad'-'estado';
  response:=pg_temp.convert_as(manager_a,f.quote_id,changed);reused:=(response->>'cliente_id')::uuid;
  PERFORM pg_temp.require((response->>'creado')::boolean AND reused<>house_client AND reused<>client_id,'Generic RFC creates a distinct client; does not reuse house/generic RFC');
  PERFORM pg_temp.require((SELECT rfc='XAXX010101000' AND direccion='' AND ciudad='' AND estado='' FROM public.clientes WHERE id=reused),'Generic RFC allows omitted address/city/state');
  PERFORM pg_temp.require((SELECT estado_crm='Cliente' AND cliente_id IS NULL FROM public.crm_empresas WHERE id=f.company_id),'Original company-state behavior follows only lead_origen_id; converter does not assign company cliente_id');
  PERFORM pg_temp.require((SELECT estado::text='Convertido' AND cliente_convertido_id=reused FROM public.crm_leads WHERE id=f.lead_id),'Company fixture lead converts canonically');
  PERFORM pg_temp.require(pg_temp.seal(f.quote_id)=old_seal,'Company conversion preserves seal');

  PERFORM pg_temp.mark('optional_both_company_conversion');

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'reuse-rfc');
  SELECT * INTO g FROM pg_temp.seed_prospect(oa,seller_a,open_a,'unrelated-same-name');
  UPDATE public.cotizaciones SET prospecto_empresa='Same Company' WHERE id IN (f.quote_id,g.quote_id);
  saved:=gen_random_uuid();
  INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,tipo_embarque,estado,version,es_prospecto,prospecto_empresa,oportunidad_id,created_by,fecha_vigencia,conceptos_venta) VALUES(saved,oa,'V2-SISTER','Marítimo','Importación','LCL','Borrador',2,true,'Same Company',f.op_id,seller_a,CURRENT_DATE+15,'[{"concepto":"Flete","cantidad":1,"precio_unitario":900,"moneda":"MXN"}]');
  response:=pg_temp.accept_as(manager_a,f.quote_id);
  SELECT count(*) INTO count_before FROM public.clientes WHERE organization_id=oa;
  changed:=payload||'{"nombre":"Untrusted alternate name","email":"alternate@example.invalid"}'::jsonb;
  response:=pg_temp.convert_as(manager_a,f.quote_id,changed);
  PERFORM pg_temp.require((response->>'cliente_id')::uuid=client_id AND NOT (response->>'creado')::boolean AND response->>'nombre'='PROSPECTO NORMALIZADO' AND (response->>'cotizaciones_revinculadas')::int=1,'Real RFC reuse keeps canonical client name and links one historical sister');
  PERFORM pg_temp.require((SELECT count(*)=count_before FROM public.clientes WHERE organization_id=oa),'RFC reuse creates no client');
  PERFORM pg_temp.require((SELECT c.cliente_id=client_id AND NOT c.es_prospecto AND c.cliente_nombre='PROSPECTO NORMALIZADO' FROM public.cotizaciones c WHERE id=saved),'Historical sister linked by opportunity identity');
  PERFORM pg_temp.require((SELECT c.cliente_id IS NULL AND c.es_prospecto FROM public.cotizaciones c WHERE id=g.quote_id),'Unrelated same-name prospect remains untouched');
  PERFORM pg_temp.require((SELECT email='ana@example.invalid' AND nombre='PROSPECTO NORMALIZADO' FROM public.clientes WHERE id=client_id),'Reused client fields are not overwritten by supplied payload');

  PERFORM pg_temp.mark('real_rfc_reuse_identity_history');

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'state-Borrador','none','Borrador');

  PERFORM pg_temp.negative('prospect_state_borrador', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ESTADO_INVALIDO', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'state-Solicitada','none','Solicitada');

  PERFORM pg_temp.negative('prospect_state_solicitada', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ESTADO_INVALIDO', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'state-Rechazada','none','Rechazada');

  PERFORM pg_temp.negative('prospect_state_rechazada', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ESTADO_INVALIDO', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'state-Vencida','none','Vencida');

  PERFORM pg_temp.negative('prospect_state_vencida', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ESTADO_INVALIDO', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'state-Archivada','none','Archivada');

  PERFORM pg_temp.negative('prospect_state_archivada', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ESTADO_INVALIDO', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'expired');
  UPDATE public.cotizaciones SET fecha_vigencia=CURRENT_DATE-1 WHERE id=f.quote_id;
  PERFORM pg_temp.require((SELECT fecha_vigencia<CURRENT_DATE FROM public.cotizaciones WHERE id=f.quote_id),'Expired fixture remains expired after real trigger');

  PERFORM pg_temp.negative('prospect_expired_acceptance', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COT_VENCIDA', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'currency');
  UPDATE public.crm_oportunidades SET moneda='USD' WHERE id=f.op_id;

  PERFORM pg_temp.negative('currency_mismatch_rollback', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_MONEDA_INCOMPATIBLE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'lost');
  SELECT id INTO saved FROM public.crm_motivos_perdida WHERE organization_id=oa AND activa AND deleted_at IS NULL ORDER BY id LIMIT 1;
  PERFORM pg_temp.require(saved IS NOT NULL,'Org provisioning seeds a real loss reason');
  UPDATE public.crm_oportunidades SET etapa_id=lost_a,motivo_perdida_id=saved WHERE id=f.op_id;

  PERFORM pg_temp.negative('lost_opportunity_requires_reopen', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_OPORTUNIDAD_PERDIDA_REQUIERE_REAPERTURA', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'opportunity_deleted');
  UPDATE public.crm_oportunidades SET deleted_at=now() WHERE id=f.op_id;

  PERFORM pg_temp.negative('opportunity_deleted_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'lead_deleted');
  UPDATE public.crm_leads SET deleted_at=now() WHERE id=f.lead_id;

  PERFORM pg_temp.negative('lead_deleted_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'lead_conflicting_conversion');
  UPDATE public.crm_leads SET oportunidad_convertida_id=main_f.op_id WHERE id=f.lead_id;

  PERFORM pg_temp.negative('lead_conflicting_conversion_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'lead_already_client');
  UPDATE public.crm_leads SET cliente_convertido_id=house_client WHERE id=f.lead_id;

  PERFORM pg_temp.negative('lead_already_client_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'lead_unqualified');
  UPDATE public.crm_leads SET estado='Contactado' WHERE id=f.lead_id;

  PERFORM pg_temp.negative('lead_unqualified_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'opportunity_already_client');
  UPDATE public.crm_oportunidades SET cliente_id=house_client WHERE id=f.op_id;

  PERFORM pg_temp.negative('opportunity_already_client_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'preexisting_seal');
  UPDATE public.cotizaciones SET version_aceptada=7,aceptada_en=now(),aceptada_por=manager_a WHERE id=f.quote_id;

  PERFORM pg_temp.negative('preexisting_seal_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'company_link_deleted','link');
  UPDATE public.crm_empresas SET deleted_at=now() WHERE id=f.company_id;

  PERFORM pg_temp.negative('company_link_deleted_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'company_lead_deleted','lead');
  UPDATE public.crm_empresas SET deleted_at=now() WHERE id=f.company_id;

  PERFORM pg_temp.negative('company_lead_deleted_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'company_link_cross_org','link');
  UPDATE public.crm_empresas SET organization_id=ob WHERE id=f.company_id;

  PERFORM pg_temp.negative('company_link_cross_org_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'company_lead_cross_org','lead');
  UPDATE public.crm_empresas SET organization_id=ob WHERE id=f.company_id;

  PERFORM pg_temp.negative('company_lead_cross_org_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'company_link_row_cross_org','link');
  UPDATE public.crm_oportunidad_empresa SET organization_id=ob WHERE oportunidad_id=f.op_id;

  PERFORM pg_temp.negative('company_link_row_cross_org_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'company_lead_existing_client','lead');
  UPDATE public.crm_empresas SET cliente_id=house_client WHERE id=f.company_id;

  PERFORM pg_temp.negative('company_lead_existing_client_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'company_origin_and_link_existing_client','both');
  UPDATE public.crm_empresas SET cliente_id=house_client WHERE id=f.company_id;

  PERFORM pg_temp.negative('company_origin_and_link_existing_client_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'additional-client-accessory','both');
  company:=gen_random_uuid();
  INSERT INTO public.crm_empresas(id,organization_id,nombre,lead_origen_id,cliente_id) VALUES(company,oa,'V2 accessory existing client',main_f.lead_id,client_id);
  INSERT INTO public.crm_oportunidad_empresa(organization_id,oportunidad_id,empresa_id) VALUES(oa,f.op_id,company);
  SELECT to_jsonb(e) INTO accessory_before FROM public.crm_empresas e WHERE id=company;
  PERFORM pg_temp.require((accessory_before->>'cliente_id')::uuid=client_id AND (accessory_before->>'lead_origen_id')::uuid<>f.lead_id AND accessory_before->>'estado_crm'='Cliente','Accessory fixture has distinct converted origin and existing client');
  response:=pg_temp.accept_as(manager_a,f.quote_id);
  PERFORM pg_temp.assert_accepted(f.quote_id,f.op_id,f.lead_id,manager_a);
  PERFORM pg_temp.require((SELECT to_jsonb(e)=accessory_before FROM public.crm_empresas e WHERE id=company),'Accept leaves full ancillary company row unchanged');
  PERFORM pg_temp.require((SELECT estado_crm='Prospecto' AND cliente_id IS NULL FROM public.crm_empresas WHERE id=f.company_id),'Accept keeps actual source company Prospecto');

  PERFORM pg_temp.mark('accessory_mn_existing_client_acceptance');

  old_seal:=pg_temp.seal(f.quote_id);
  changed:=payload||'{"rfc":"XEXX010101000","email":"accessory-flow@example.invalid"}'::jsonb;
  response:=pg_temp.convert_as(manager_a,f.quote_id,changed);
  reused:=(response->>'cliente_id')::uuid;
  PERFORM pg_temp.require((response->>'creado')::boolean AND reused<>client_id,'Source conversion creates own client, independent of accessory client');
  PERFORM pg_temp.require((SELECT to_jsonb(e)=accessory_before FROM public.crm_empresas e WHERE id=company),'Original conversion leaves full accessory company row unchanged');
  PERFORM pg_temp.require((SELECT estado_crm='Cliente' AND cliente_id IS NULL FROM public.crm_empresas WHERE id=f.company_id),'Original conversion advances only actual source company state');
  PERFORM pg_temp.require(pg_temp.seal(f.quote_id)=old_seal,'Accessory flow conversion preserves seal');

  PERFORM pg_temp.mark('accessory_mn_existing_client_conversion');

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'actual-other-winner');
  saved:=gen_random_uuid();
  INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,tipo_embarque,estado,version,es_prospecto,prospecto_empresa,oportunidad_id,created_by,fecha_vigencia,conceptos_venta) VALUES(saved,oa,'V2-SECOND-WINNER','Marítimo','Importación','LCL','Borrador',8,true,'Other winner',f.op_id,seller_a,CURRENT_DATE+15,'[{"concepto":"Flete","cantidad":1,"precio_unitario":900,"moneda":"MXN"}]');
  UPDATE public.cotizaciones SET estado='Enviada' WHERE id=saved;
  response:=pg_temp.accept_as(manager_a,f.quote_id);

  PERFORM pg_temp.negative('second_prospect_winner_rollback', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',saved), 'P0001', 'LC_COTIZACION_GANADORA_EXISTE', NULL, false);

  SELECT * INTO retry_f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'retry-corruption');
  response:=pg_temp.accept_as(manager_a,retry_f.quote_id);old_seal:=pg_temp.seal(retry_f.quote_id);

  UPDATE public.cotizaciones SET version=8 WHERE id=retry_f.quote_id;

  PERFORM pg_temp.negative('retry_version_mismatch', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',retry_f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  UPDATE public.cotizaciones SET version=7 WHERE id=retry_f.quote_id;

  UPDATE public.cotizaciones SET version_aceptada=NULL WHERE id=retry_f.quote_id;

  PERFORM pg_temp.negative('retry_missing_version_seal', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',retry_f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  UPDATE public.cotizaciones SET version_aceptada=7 WHERE id=retry_f.quote_id;

  UPDATE public.cotizaciones SET aceptada_en=NULL WHERE id=retry_f.quote_id;

  PERFORM pg_temp.negative('retry_missing_timestamp_seal', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',retry_f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  UPDATE public.cotizaciones SET aceptada_en=(old_seal->>'at')::timestamptz WHERE id=retry_f.quote_id;

  UPDATE public.cotizaciones SET aceptada_por=NULL WHERE id=retry_f.quote_id;

  PERFORM pg_temp.negative('retry_missing_actor_seal', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',retry_f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  UPDATE public.cotizaciones SET aceptada_por=manager_a WHERE id=retry_f.quote_id;

  UPDATE public.cotizaciones SET fecha_vigencia=CURRENT_DATE-1 WHERE id=retry_f.quote_id;
  before_state:=pg_temp.org_state(orgs);retry:=pg_temp.accept_as(manager_a,retry_f.quote_id);
  PERFORM pg_temp.require((retry->>'sin_cambios')::boolean AND pg_temp.org_state(orgs)=before_state,'Coherent accepted retry remains valid after original expiry, without rewriting seal');

  PERFORM pg_temp.mark('accepted_retry_after_expiry');

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'no-won-stage');
  UPDATE public.crm_etapas_pipeline SET activa=false WHERE organization_id=oa AND tipo='ganada';

  PERFORM pg_temp.negative('late_trigger_no_won_stage_rollback', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_CRM_SIN_ETAPA_GANADA', NULL, false);

  UPDATE public.crm_etapas_pipeline SET activa=true WHERE organization_id=oa AND tipo='ganada';

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'no-op','none','Borrador');
  UPDATE public.cotizaciones SET oportunidad_id=NULL WHERE id=f.quote_id;

  PERFORM pg_temp.negative('prospect_without_crm_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COT_SIN_OPORTUNIDAD', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'no-amount');
  UPDATE public.cotizaciones SET conceptos_venta='[]'::jsonb,subtotal=0 WHERE id=f.quote_id;
  PERFORM pg_temp.require((SELECT subtotal=0 AND conceptos_venta='[]'::jsonb FROM public.cotizaciones WHERE id=f.quote_id),'Empty-amount fixture remains empty after canonical subtotal trigger');

  PERFORM pg_temp.negative('prospect_without_amount_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COT_IMPORTE_REQUERIDO', NULL, false);

  PERFORM pg_temp.negative('quote_not_found_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',gen_random_uuid()), 'P0002', 'Cotización no encontrada', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'quote-deleted');
  UPDATE public.cotizaciones SET deleted_at=now() WHERE id=f.quote_id;

  PERFORM pg_temp.negative('quote_soft_deleted_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0002', 'Cotización no encontrada', NULL, false);

  saved:=gen_random_uuid();
  INSERT INTO public.crm_etapas_pipeline(id,organization_id,nombre,tipo,orden,probabilidad_default,activa) VALUES(saved,oa,'V2 stage_inactive','abierta',905,50,true);
  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,saved,'stage_inactive');
  UPDATE public.crm_etapas_pipeline SET activa=false WHERE id=saved;

  PERFORM pg_temp.negative('stage_inactive_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  saved:=gen_random_uuid();
  INSERT INTO public.crm_etapas_pipeline(id,organization_id,nombre,tipo,orden,probabilidad_default,activa) VALUES(saved,oa,'V2 stage_deleted','abierta',905,50,true);
  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,saved,'stage_deleted');
  UPDATE public.crm_etapas_pipeline SET deleted_at=now() WHERE id=saved;

  PERFORM pg_temp.negative('stage_deleted_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  saved:=gen_random_uuid();
  INSERT INTO public.crm_etapas_pipeline(id,organization_id,nombre,tipo,orden,probabilidad_default,activa) VALUES(saved,oa,'V2 stage_cross_tenant','abierta',905,50,true);
  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,saved,'stage_cross_tenant');
  UPDATE public.crm_etapas_pipeline SET organization_id=ob WHERE id=saved;

  PERFORM pg_temp.negative('stage_cross_tenant_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'retry-winner-state');
  response:=pg_temp.accept_as(manager_a,f.quote_id);
  SELECT etapa_id INTO saved FROM public.crm_oportunidades WHERE id=f.op_id;
  UPDATE public.crm_oportunidades SET cotizacion_ganadora_id=NULL WHERE id=f.op_id;

  PERFORM pg_temp.negative('retry_missing_winner', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  UPDATE public.crm_oportunidades SET cotizacion_ganadora_id=house_quote WHERE id=f.op_id;

  PERFORM pg_temp.negative('retry_other_winner', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_GANADORA_EXISTE', NULL, false);

  UPDATE public.crm_oportunidades SET cotizacion_ganadora_id=f.quote_id,etapa_id=open_a WHERE id=f.op_id;

  PERFORM pg_temp.negative('retry_requires_won_stage', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  UPDATE public.crm_oportunidades SET etapa_id=saved WHERE id=f.op_id;
  changed:=payload||'{"rfc":"XEXX010101000","email":"v2-house@test.invalid"}'::jsonb;

  PERFORM pg_temp.negative('conversion_duplicate_email_rollback', orgs, manager_a, format('SELECT public.convertir_prospecto_a_cliente_rpc(%L,%L::jsonb)',f.quote_id,changed), '23505', 'LC_EMAIL_DUPLICADO', NULL, false);

  reused:=gen_random_uuid();
  INSERT INTO public.clientes(id,organization_id,nombre,rfc,email) VALUES(reused,ob,'V2 foreign RFC','DEF010101AB1','foreign-rfc@example.invalid');
  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'cross-tenant-rfc');
  response:=pg_temp.accept_as(manager_a,f.quote_id);
  changed:=payload||'{"rfc":" def010101ab1 ","email":"own-rfc@example.invalid"}'::jsonb;
  response:=pg_temp.convert_as(manager_a,f.quote_id,changed);
  PERFORM pg_temp.require((response->>'creado')::boolean AND (response->>'cliente_id')::uuid<>reused,'Real RFC reuse is tenant-scoped');
  PERFORM pg_temp.require((SELECT count(*)=2 FROM public.clientes WHERE organization_id=ANY(orgs) AND rfc='DEF010101AB1'),'Same real RFC has one independent client per tenant');

  PERFORM pg_temp.mark('rfc_reuse_is_tenant_scoped');

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'house-policy-rfc-reuse');
  response:=pg_temp.accept_as(manager_a,f.quote_id);
  PERFORM pg_temp.assert_accepted(f.quote_id,f.op_id,f.lead_id,manager_a);
  PERFORM pg_temp.require(response->>'origen_aceptacion'='aceptacion_prospecto_crm','First acceptance uses prospect origin before house RFC reuse');
  before_state:=pg_temp.org_state(orgs);retry:=pg_temp.accept_as(manager_a,f.quote_id);
  PERFORM pg_temp.require(retry->>'origen_aceptacion'='aceptacion_prospecto_crm' AND (retry->>'sin_cambios')::boolean AND pg_temp.org_state(orgs)=before_state,'Pre-conversion house-policy retry still uses prospect origin');
  old_seal:=pg_temp.seal(f.quote_id);
  changed:=payload||'{"rfc":" hou010101ab1 ","email":"house-policy-reuse@example.invalid"}'::jsonb;
  response:=pg_temp.convert_as(manager_a,f.quote_id,changed);
  PERFORM pg_temp.require((response->>'cliente_id')::uuid=house_client AND NOT (response->>'creado')::boolean,'Original converter reuses real-RFC house client');
  before_state:=pg_temp.org_state(orgs);retry:=pg_temp.accept_as(manager_a,f.quote_id);
  PERFORM pg_temp.require(retry->>'origen_aceptacion'='interna_cliente_de_casa' AND (retry->>'sin_cambios')::boolean AND pg_temp.org_state(orgs)=before_state,'Post-conversion house-policy retry is original client branch and completely read-only');
  PERFORM pg_temp.require(pg_temp.seal(f.quote_id)=old_seal,'House-policy RFC conversion and retry retain exact seal');
  PERFORM pg_temp.require((SELECT o.cotizacion_ganadora_id=f.quote_id AND o.valor_real=2300 FROM public.crm_oportunidades o WHERE id=f.op_id),'House-policy conversion preserves winner and amount');
  PERFORM pg_temp.require((SELECT count(*)=1 AND bool_and(detalles->>'origen_aceptacion'='aceptacion_prospecto_crm') FROM public.bitacora_actividad WHERE entidad_id=f.quote_id AND accion='cotizacion.aceptada_version_fijada'),'House-policy original audit is unique and retains prospect origin');
  PERFORM pg_temp.require((SELECT count(*)=1 FROM public.bitacora_actividad WHERE entidad_id=f.quote_id AND accion='convertir_prospecto_a_cliente'),'House-policy conversion audit is unique');
  PERFORM pg_temp.require((SELECT count(*)=1 FROM public.crm_notificaciones WHERE organization_id=oa AND user_id=seller_a AND tipo='oportunidad_ganada' AND link='/crm/oportunidades/'||f.op_id::text),'House-policy CRM notice remains unique');

  PERFORM pg_temp.mark('post_conversion_house_policy_retry_origin');

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'calificado-source');
  UPDATE public.crm_leads SET estado='Calificado' WHERE id=f.lead_id;
  response:=pg_temp.accept_as(manager_a,f.quote_id);
  old_seal:=pg_temp.seal(f.quote_id);
  PERFORM pg_temp.require(response->>'origen_aceptacion'='aceptacion_prospecto_crm' AND (response->>'version_aceptada')::int=7,'Qualified source uses prospect acceptance');
  PERFORM pg_temp.require((SELECT estado='Aceptada' AND version_aceptada=7 AND aceptada_por=manager_a AND aceptada_en=transaction_timestamp() FROM public.cotizaciones WHERE id=f.quote_id),'Qualified source has exact seal');
  PERFORM pg_temp.require((SELECT o.cotizacion_ganadora_id=f.quote_id AND e.tipo='ganada' AND o.valor_real=2300 FROM public.crm_oportunidades o JOIN public.crm_etapas_pipeline e ON e.id=o.etapa_id WHERE o.id=f.op_id),'Qualified source closes opportunity');
  PERFORM pg_temp.require((SELECT estado::text='Calificado' AND cliente_convertido_id IS NULL FROM public.crm_leads WHERE id=f.lead_id),'Original advancement trigger leaves Calificado unchanged on acceptance');
  response:=pg_temp.convert_as(manager_a,f.quote_id,payload);
  PERFORM pg_temp.require((SELECT estado::text='Convertido' AND cliente_convertido_id=client_id FROM public.crm_leads WHERE id=f.lead_id),'Original converter still completes qualified source');
  PERFORM pg_temp.require(pg_temp.seal(f.quote_id)=old_seal,'Qualified source conversion preserves seal');

  PERFORM pg_temp.mark('calificado_source_original_behavior');

  SELECT * INTO f FROM pg_temp.seed_prospect(oa,seller_a,open_a,'op-moved-other-tenant');
  SELECT * INTO g FROM pg_temp.seed_prospect(ob,manager_b,open_b,'foreign-op-source');
  UPDATE public.crm_oportunidades SET organization_id=ob,lead_id=g.lead_id,etapa_id=open_b WHERE id=f.op_id;

  PERFORM pg_temp.negative('opportunity_moved_cross_tenant_rejected', orgs, manager_a, format('SELECT public.aceptar_cotizacion_version(%L)',f.quote_id), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE', NULL, false);

  PERFORM pg_temp.expect_error('SELECT pg_temp.require(NULL,''null probe'')','P0001','ACCEPTANCE_V2_ASSERT','ACCEPTANCE_V2_ASSERT: null probe');
  PERFORM pg_temp.expect_error('SELECT pg_temp.require(false,''false probe'')','P0001','ACCEPTANCE_V2_ASSERT','ACCEPTANCE_V2_ASSERT: false probe');

  PERFORM pg_temp.mark('assertion_null_and_false_fail_closed');

  changed:=jsonb_build_object('organization_id',ob,'cliente_id',house_client,'numero','V2-FISCAL-TENANT','moneda','MXN');

  PERFORM pg_temp.negative('fiscal_capture_wrong_tenant', orgs, manager_a, format('SELECT public.crear_factura_manual_idempotente(%L,%L::jsonb,%L::jsonb)',gen_random_uuid(),changed,'[{"descripcion":"Flete","cantidad":1,"precio_unitario":1,"total":1}]'), '42501', 'La captura no pertenece a la organización activa.', NULL, false);

  PERFORM pg_temp.negative('fiscal_capture_no_concepts', orgs, manager_a, format('SELECT public.crear_factura_manual_idempotente(%L,%L::jsonb,%L::jsonb)',gen_random_uuid(),jsonb_build_object('organization_id',oa,'cliente_id',client_id,'numero','V2-NO-CONCEPTS','moneda','MXN'),'[]'), '22023', 'Debe haber al menos un concepto.', NULL, false);

  PERFORM pg_temp.require((SELECT count(*)=115 FROM pg_temp.acceptance_v2_seen),'All exact expected cases must have emitted once');
END $cases$;
ROLLBACK;
