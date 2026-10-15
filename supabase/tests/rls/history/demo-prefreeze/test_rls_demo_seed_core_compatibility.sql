\set ON_ERROR_STOP on
\set VERBOSITY verbose
BEGIN;
CREATE TEMP TABLE compat_checks (label text NOT NULL);
CREATE TEMP TABLE compat_snapshots (label text PRIMARY KEY, value jsonb NOT NULL);
CREATE FUNCTION pg_temp.compat_assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'COMPAT_TEST_FAILED: %',label; END IF;
  INSERT INTO pg_temp.compat_checks VALUES(label);
END;
$$;
CREATE FUNCTION pg_temp.tenant_snapshot(org uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r record; rows jsonb; result jsonb := '{}'::jsonb;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='organization_id' AND NOT a.attisdropped
    WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM public.%I t WHERE organization_id=$1',r.relname)
      INTO rows USING org;
    result := result || jsonb_build_object(r.relname,rows);
  END LOOP;
  RETURN result;
END;
$$;
CREATE FUNCTION pg_temp.identity_snapshot() RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'clients',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.clientes t WHERE organization_id='de100000-0000-0000-0000-000000000001'),
    'contacts',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.contactos_cliente t WHERE organization_id='de100000-0000-0000-0000-000000000001'),
    'companies',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.crm_empresas t WHERE organization_id='de100000-0000-0000-0000-000000000001'),
    'crm_contacts',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.crm_contactos t WHERE organization_id='de100000-0000-0000-0000-000000000001'),
    'opportunities',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.crm_oportunidades t WHERE organization_id='de100000-0000-0000-0000-000000000001'),
    'activities',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.crm_actividades t WHERE organization_id='de100000-0000-0000-0000-000000000001'),
    'company_contacts',(SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.crm_empresa_contacto t WHERE organization_id='de100000-0000-0000-0000-000000000001'),
    'company_opportunities',(SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.crm_oportunidad_empresa t WHERE organization_id='de100000-0000-0000-0000-000000000001'),
    'company_activities',(SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.crm_actividad_empresa t WHERE organization_id='de100000-0000-0000-0000-000000000001'));
$$;
CREATE FUNCTION pg_temp.guard_snapshot() RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
   'functions',(SELECT jsonb_agg(jsonb_build_object('name',proname,'body',prosrc,'acl',proacl,'config',proconfig,'owner',proowner,'definer',prosecdef) ORDER BY proname)
     FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('seed_demo_organization_core','seed_demo_organization_guarded',
       '_versionar_conceptos_factura_proveedor','guard_aprobacion_proveedor_factura','tg_pagos_proveedor_requiere_aprobacion','aprobar_factura_proveedor',
       '_crm_empresa_desde_cliente','_crm_empresa_no_borrar_cliente','_crm_empresa_no_delete_fisico')),
   'triggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(oid)) ORDER BY tgname)
     FROM pg_trigger WHERE NOT tgisinternal AND (tgname LIKE '%crm_empresa%' OR tgname IN ('trg_cxp_versionar_conceptos','trg_guard_aprobacion_proveedor_factura','pagos_proveedor_requiere_aprobacion'))));
$$;
CREATE FUNCTION pg_temp.check_seed(label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d constant uuid := 'de100000-0000-0000-0000-000000000001';
BEGIN
  PERFORM pg_temp.compat_assert((SELECT count(*)=3 FROM public.clientes WHERE organization_id=d AND rfc IN ('IPA950101AB1','TMO880305C45','APB050620XX9')),label||': three seed keys');
  PERFORM pg_temp.compat_assert((SELECT count(*)=4 FROM public.clientes WHERE organization_id=d),label||': preserves unrelated client');
  PERFORM pg_temp.compat_assert((SELECT count(*)=3 FROM public.proveedor_facturas WHERE organization_id=d AND estado_aprobacion='aprobada'
    AND aprobada_por='de200000-0000-0000-0000-000000000001' AND aprobada_at IS NOT NULL),label||': approvals attributed to actor');
  PERFORM pg_temp.compat_assert((SELECT count(*)=1 AND sum(monto)=20000 FROM public.pagos_proveedor WHERE organization_id=d),label||': real payment');
  PERFORM pg_temp.compat_assert(NOT EXISTS (SELECT 1 FROM public.crm_empresas e LEFT JOIN public.clientes c ON c.id=e.cliente_id
    WHERE e.organization_id=d AND e.cliente_id IS NOT NULL AND (c.id IS NULL OR c.organization_id IS DISTINCT FROM d)),label||': no orphan or cross-tenant company');
  PERFORM pg_temp.compat_assert(NOT EXISTS (SELECT 1 FROM public.crm_empresas WHERE organization_id=d AND deleted_at IS NULL
    GROUP BY upper(btrim(nombre)) HAVING count(*)>1),label||': no duplicate companies');
  PERFORM pg_temp.compat_assert(pg_temp.tenant_snapshot('de100000-0000-0000-0000-000000000002')=(SELECT value FROM pg_temp.compat_snapshots s WHERE s.label='control'),label||': control tenant unchanged');
  PERFORM pg_temp.compat_assert(pg_temp.guard_snapshot()=(SELECT value FROM pg_temp.compat_snapshots s WHERE s.label='guards'),label||': guards and ACL unchanged');
END;
$$;
SELECT pg_temp.compat_assert(current_user='postgres' AND (inet_server_addr() IS NULL OR inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet)),'owned disposable database only');
SELECT pg_temp.compat_assert(NOT EXISTS (SELECT 1 FROM public.organizations WHERE id IN ('de100000-0000-0000-0000-000000000001','de100000-0000-0000-0000-000000000002')),'requires unused synthetic organizations');
INSERT INTO public.organizations(id,nombre) VALUES
 ('de100000-0000-0000-0000-000000000001','Synthetic demo compatibility'),
 ('de100000-0000-0000-0000-000000000002','Synthetic control tenant');
INSERT INTO auth.users(id,email) VALUES
 ('de200000-0000-0000-0000-000000000001','approver@fixture.invalid'),
 ('de200000-0000-0000-0000-000000000002','viewer@fixture.invalid'),
 ('de200000-0000-0000-0000-000000000003','other-tenant-approver@fixture.invalid');
-- Fixture identities only; auth insert creates the default viewer role.
UPDATE public.user_roles SET role='admin_org' WHERE user_id IN ('de200000-0000-0000-0000-000000000001','de200000-0000-0000-0000-000000000003');
UPDATE public.user_roles SET role='customer_service' WHERE user_id='de200000-0000-0000-0000-000000000002';
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
 ('de100000-0000-0000-0000-000000000001','de200000-0000-0000-0000-000000000001','admin_org'),
 ('de100000-0000-0000-0000-000000000001','de200000-0000-0000-0000-000000000002','customer_service'),
 ('de100000-0000-0000-0000-000000000002','de200000-0000-0000-0000-000000000003','admin_org');
INSERT INTO public.clientes(organization_id,nombre,rfc,email) VALUES
 ('de100000-0000-0000-0000-000000000002','Importadora del Pacífico S.A. de C.V.','IPA950101AB1','control-a@fixture.invalid'),
 ('de100000-0000-0000-0000-000000000002','Textiles Monterrey S.A.','TMO880305C45','control-b@fixture.invalid'),
 ('de100000-0000-0000-0000-000000000002','Auto Partes Bajío S. de R.L.','APB050620XX9','control-c@fixture.invalid'),
 ('de100000-0000-0000-0000-000000000001','Synthetic unrelated client','QAS260101AB1','extra@fixture.invalid');
INSERT INTO pg_temp.compat_snapshots VALUES('control',pg_temp.tenant_snapshot('de100000-0000-0000-0000-000000000002')),('guards',pg_temp.guard_snapshot());

-- Transactional CI fixture; committed reseeds are verified in separate disposable clones.
-- Initial full seed, with a real approval actor. No stub or session approval flag.
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"de200000-0000-0000-0000-000000000001"}',true);
SELECT public.seed_demo_organization_guarded(0);
RESET ROLE;
SELECT pg_temp.check_seed('initial seed');

-- Add durable relationships and an edited contact/client field before reseeding.
DO $$
DECLARE d constant uuid := 'de100000-0000-0000-0000-000000000001'; c uuid; e uuid; p uuid; a uuid; contact uuid; stage uuid;
BEGIN
 SELECT id INTO c FROM public.clientes WHERE organization_id=d AND rfc='IPA950101AB1';
 SELECT id INTO e FROM public.crm_empresas WHERE organization_id=d AND cliente_id=c;
 IF e IS NULL THEN
   INSERT INTO public.crm_empresas(organization_id,nombre,cliente_id,estado_crm) VALUES(d,'Synthetic existing company',c,'Cliente') RETURNING id INTO e;
 END IF;
 INSERT INTO public.crm_contactos(organization_id,nombre,email) VALUES(d,'Synthetic CRM contact','crm@fixture.invalid') RETURNING id INTO contact;
 INSERT INTO public.crm_empresa_contacto(organization_id,empresa_id,contacto_id) VALUES(d,e,contact);
 INSERT INTO public.crm_etapas_pipeline(organization_id,nombre) VALUES(d,'Synthetic active stage') RETURNING id INTO stage;
 INSERT INTO public.crm_oportunidades(organization_id,nombre,cliente_id,etapa_id) VALUES(d,'Synthetic durable opportunity',c,stage) RETURNING id INTO p;
 INSERT INTO public.crm_oportunidad_empresa(organization_id,oportunidad_id,empresa_id) VALUES(d,p,e);
 INSERT INTO public.crm_actividades(organization_id,tipo,asunto,entidad_tipo,entidad_id,oportunidad_id)
   VALUES(d,'llamada','Synthetic durable activity','oportunidad',p,p) RETURNING id INTO a;
 INSERT INTO public.crm_actividad_empresa(organization_id,actividad_id,empresa_id) VALUES(d,a,e);
 UPDATE public.clientes SET direccion='Synthetic existing data must survive' WHERE id=c;
 UPDATE public.contactos_cliente SET nombre='Synthetic existing contact edit' WHERE cliente_id=c;
END;
$$;
INSERT INTO pg_temp.compat_snapshots VALUES('identities',pg_temp.identity_snapshot());
SET CONSTRAINTS ALL IMMEDIATE;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"de200000-0000-0000-0000-000000000001"}',true);
SELECT public.seed_demo_organization_guarded(0);
RESET ROLE;
SELECT pg_temp.check_seed('first reseed');
SELECT pg_temp.compat_assert(pg_temp.identity_snapshot()=(SELECT value FROM pg_temp.compat_snapshots WHERE label='identities'),'first reseed: all identity rows and relations unchanged');

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"de200000-0000-0000-0000-000000000001"}',true);
SELECT public.seed_demo_organization_guarded(0);
RESET ROLE;
SELECT pg_temp.check_seed('second reseed');
SELECT pg_temp.compat_assert(pg_temp.identity_snapshot()=(SELECT value FROM pg_temp.compat_snapshots WHERE label='identities'),'second reseed: all identity rows and relations unchanged');
SELECT pg_temp.compat_assert((SELECT count(*)=9 FROM public.bitacora_actividad WHERE organization_id='de100000-0000-0000-0000-000000000001'
 AND accion='aprobar_factura_proveedor' AND usuario_id='de200000-0000-0000-0000-000000000001'),'nine attributable RPC approval events retained');

-- All negative probes roll back their own fixture mutation in a subtransaction.
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"de200000-0000-0000-0000-000000000001"}',true);
DO $$
DECLARE d constant uuid := 'de100000-0000-0000-0000-000000000001'; before jsonb := pg_temp.tenant_snapshot(d); err text;
BEGIN
 BEGIN
   INSERT INTO public.clientes(organization_id,nombre,rfc,email,deleted_at) VALUES(d,'Synthetic ambiguous seed key','IPA950101AB1','ambiguous@fixture.invalid',clock_timestamp());
   PERFORM public.seed_demo_organization_guarded(0);
   RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
 EXCEPTION WHEN check_violation THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   PERFORM pg_temp.compat_assert(err LIKE 'LC_SEED_DEMO_IDENTIDAD_AMBIGUA:%','rejects ambiguous seed RFC');
 END;
 PERFORM pg_temp.compat_assert(pg_temp.tenant_snapshot(d)=before,'ambiguous identity: no data loss');
 BEGIN
   UPDATE public.clientes SET deleted_at=clock_timestamp() WHERE organization_id=d AND rfc='IPA950101AB1';
   PERFORM public.seed_demo_organization_guarded(0);
   RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
 EXCEPTION WHEN check_violation THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   PERFORM pg_temp.compat_assert(err LIKE 'LC_SEED_DEMO_IDENTIDAD_AMBIGUA:%','rejects deleted seed client without restoration');
 END;
 PERFORM pg_temp.compat_assert(pg_temp.tenant_snapshot(d)=before,'deleted identity: no data loss');
 BEGIN
   INSERT INTO public.crm_empresas(organization_id,nombre,cliente_id) VALUES(d,'Synthetic existing orphan',gen_random_uuid());
   PERFORM public.seed_demo_organization_guarded(0);
   RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
 EXCEPTION WHEN check_violation THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   PERFORM pg_temp.compat_assert(err LIKE 'LC_SEED_DEMO_CRM_IDENTIDAD_INSEGURA:%','rejects existing orphan without cleanup');
 END;
 PERFORM pg_temp.compat_assert(pg_temp.tenant_snapshot(d)=before,'orphan fixture: no data loss');
 BEGIN
   INSERT INTO public.crm_empresas(organization_id,nombre,cliente_id)
     SELECT d,'Synthetic cross-tenant company',id FROM public.clientes WHERE organization_id='de100000-0000-0000-0000-000000000002' AND rfc='IPA950101AB1';
   PERFORM public.seed_demo_organization_guarded(0);
   RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
 EXCEPTION WHEN check_violation THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   PERFORM pg_temp.compat_assert(err LIKE 'LC_SEED_DEMO_CRM_IDENTIDAD_INSEGURA:%','rejects cross-tenant company link');
 END;
 PERFORM pg_temp.compat_assert(pg_temp.tenant_snapshot(d)=before,'cross-tenant fixture: no data loss');
END;
$$;
DO $$
DECLARE d constant uuid := 'de100000-0000-0000-0000-000000000001'; before jsonb := pg_temp.tenant_snapshot(d); err text; actor text;
BEGIN
 FOREACH actor IN ARRAY ARRAY['','de200000-0000-0000-0000-000000000002','de200000-0000-0000-0000-000000000003'] LOOP
   BEGIN
     PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',actor)::text,true);
     PERFORM public.seed_demo_organization_guarded(0);
     RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
   EXCEPTION WHEN insufficient_privilege OR raise_exception OR check_violation THEN
     GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
     PERFORM pg_temp.compat_assert(CASE actor
       WHEN '' THEN err LIKE 'LC_SEED_DEMO_APROBADOR_REQUERIDO:%'
       WHEN 'de200000-0000-0000-0000-000000000002' THEN err LIKE 'LC_SOD_VIOLATION:%' OR err='Tu rol requiere vincular una cotización Aceptada para crear el embarque.'
       ELSE err='Factura no encontrada' OR err='Tu rol requiere vincular una cotización Aceptada para crear el embarque.' END,'rejects invalid approval actor '||coalesce(nullif(actor,''),'absent'));
   END;
   PERFORM pg_temp.compat_assert(pg_temp.tenant_snapshot(d)=before,'invalid actor: full rollback '||coalesce(nullif(actor,''),'absent'));
 END LOOP;
END;
$$;
DO $$
DECLARE d constant uuid := 'de100000-0000-0000-0000-000000000001'; before jsonb := pg_temp.tenant_snapshot(d); f uuid; expected timestamptz; err text; actor text;
BEGIN
 SELECT id,updated_at INTO f,expected FROM public.proveedor_facturas WHERE organization_id=d AND folio_proveedor='OFC-INV-7720';
 FOREACH actor IN ARRAY ARRAY['','de200000-0000-0000-0000-000000000002','de200000-0000-0000-0000-000000000003'] LOOP
  BEGIN
   UPDATE public.proveedor_facturas_conceptos SET descripcion=descripcion||' approval actor fixture' WHERE proveedor_factura_id=f;
   SELECT updated_at INTO expected FROM public.proveedor_facturas WHERE id=f;
   PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',actor)::text,true);
   PERFORM public.aprobar_factura_proveedor(f,true,NULL,expected);
   RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   PERFORM pg_temp.compat_assert(CASE actor WHEN '' THEN err='No autenticado'
     WHEN 'de200000-0000-0000-0000-000000000002' THEN err LIKE 'LC_SOD_VIOLATION:%'
     ELSE err='Factura no encontrada' END,'RPC retains actor role and tenant validation '||coalesce(nullif(actor,''),'absent'));
  END;
  PERFORM pg_temp.compat_assert(pg_temp.tenant_snapshot(d)=before,'invalid RPC actor: full rollback '||coalesce(nullif(actor,''),'absent'));
 END LOOP;
 SELECT updated_at INTO expected FROM public.proveedor_facturas WHERE id=f;
 BEGIN
   UPDATE public.proveedor_facturas_conceptos SET descripcion=descripcion||' fixture edit' WHERE proveedor_factura_id=f;
   PERFORM pg_temp.compat_assert((SELECT estado_aprobacion='pendiente' AND aprobada_por IS NULL AND aprobada_at IS NULL FROM public.proveedor_facturas WHERE id=f),'concept edit still revokes approval');
   INSERT INTO public.pagos_proveedor(organization_id,proveedor_factura_id,fecha_pago,monto,moneda,metodo_pago) VALUES(d,f,CURRENT_DATE,1,'MXN','Transferencia');
   RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
 EXCEPTION WHEN check_violation THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   PERFORM pg_temp.compat_assert(err LIKE 'La factura debe estar aprobada para registrar pagos%','pending payment still rejected');
 END;
 PERFORM pg_temp.compat_assert(pg_temp.tenant_snapshot(d)=before,'pending payment probe: no mutation');
 BEGIN
   UPDATE public.proveedor_facturas_conceptos SET descripcion=descripcion||' fixture edit' WHERE proveedor_factura_id=f;
   UPDATE public.proveedor_facturas SET estado_aprobacion='aprobada' WHERE id=f;
   RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
 EXCEPTION WHEN insufficient_privilege THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   PERFORM pg_temp.compat_assert(err LIKE 'LC_CXP_APROBACION_DIRECTA:%','direct approval still rejected');
 END;
 PERFORM pg_temp.compat_assert(pg_temp.tenant_snapshot(d)=before,'direct approval probe: no mutation');
 BEGIN
   UPDATE public.proveedor_facturas_conceptos SET descripcion=descripcion||' fixture edit' WHERE proveedor_factura_id=f;
   PERFORM public.aprobar_factura_proveedor(f,true,NULL,expected);
   RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   PERFORM pg_temp.compat_assert(err LIKE 'LC_CONFLICTO_CONCURRENCIA:%','approval stale version still rejected');
 END;
 PERFORM pg_temp.compat_assert(pg_temp.tenant_snapshot(d)=before,'stale version probe: no mutation');
END;
$$;
DO $$
DECLARE d constant uuid := 'de100000-0000-0000-0000-000000000001'; before jsonb := pg_temp.tenant_snapshot(d); e uuid; err text;
BEGIN
 IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_crm_empresa_no_borrar_cliente' AND NOT tgisinternal) THEN
  SELECT id INTO e FROM public.crm_empresas WHERE organization_id=d AND cliente_id IS NOT NULL LIMIT 1;
  BEGIN
   UPDATE public.crm_empresas SET deleted_at=clock_timestamp() WHERE id=e;
   RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN check_violation THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   PERFORM pg_temp.compat_assert(err LIKE 'LC_CRM_EMPRESA_ES_CLIENTE:%','0017 soft-delete guard intact');
  END;
  BEGIN
   DELETE FROM public.crm_empresas WHERE id=e;
   RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING';
  EXCEPTION WHEN check_violation THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   PERFORM pg_temp.compat_assert(err LIKE 'LC_CRM_EMPRESA_ES_CLIENTE:%','0017 physical-delete guard intact');
  END;
  PERFORM pg_temp.compat_assert(pg_temp.tenant_snapshot(d)=before,'0017 probes preserve company and relations');
 END IF;
END;
$$;
SELECT pg_temp.check_seed('after negative probes');
SELECT json_build_object('database',current_database(),'checks',(SELECT count(*) FROM pg_temp.compat_checks),
 'real_core_calls',3,'reseeds_complete',2,'fixture_committed',false,'core_stubbed',false,'broadened_permissions',false,
 'manual_approval_flag',false,'control_tenant_unchanged',true,'identity_rows_and_relations_unchanged',true,
 'seed_clients',(SELECT count(*) FROM public.clientes WHERE organization_id='de100000-0000-0000-0000-000000000001' AND rfc IN ('IPA950101AB1','TMO880305C45','APB050620XX9')),
 'all_demo_clients',(SELECT count(*) FROM public.clientes WHERE organization_id='de100000-0000-0000-0000-000000000001'),
 'companies',(SELECT count(*) FROM public.crm_empresas WHERE organization_id='de100000-0000-0000-0000-000000000001'),
 'orphans',(SELECT count(*) FROM public.crm_empresas e WHERE e.organization_id='de100000-0000-0000-0000-000000000001' AND e.cliente_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clientes c WHERE c.id=e.cliente_id)),
 'approvals_logged',(SELECT count(*) FROM public.bitacora_actividad WHERE organization_id='de100000-0000-0000-0000-000000000001' AND accion='aprobar_factura_proveedor'));
ROLLBACK;
