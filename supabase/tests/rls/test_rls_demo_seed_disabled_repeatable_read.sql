-- Disabled release regression: real functions, zero stubs; all changes roll back.
-- Mandatory provisional safety regression. Owned disposable replay only.
-- No seed/core stub; no constraint, RLS, trigger, role or ACL relaxation.
\set ON_ERROR_STOP on
\set VERBOSITY verbose
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
CREATE TEMP TABLE qa_stop_checks(label text NOT NULL);
CREATE TEMP TABLE qa_stop_runs(label text, route text, actor uuid, caller_role text,
 sqlstate text, attempts bigint, snapshot_sha256 text);
CREATE TEMP TABLE qa_stop_ids(organization_id uuid PRIMARY KEY, actor uuid, client uuid,
 provider uuid, agent uuid, tariff uuid, fob uuid, pricing uuid, quote uuid, shipment uuid);

CREATE FUNCTION pg_temp.qa_stop_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'QA_RESEED_STOP_FAIL: %',label; END IF;
 INSERT INTO pg_temp.qa_stop_checks VALUES(label);
END;
$$;
SELECT pg_temp.qa_stop_assert(current_user='postgres','owned disposable PostgreSQL only');
SELECT pg_temp.qa_stop_assert(NOT EXISTS(SELECT 1 FROM public.organizations WHERE id IN
 ('de100000-0000-0000-0000-000000000001','de100000-0000-0000-0000-000000000002')),
 'synthetic organization IDs must be unused');

INSERT INTO public.organizations(id,nombre) VALUES
 ('de100000-0000-0000-0000-000000000001','Synthetic reseed stop demo'),
 ('de100000-0000-0000-0000-000000000002','Synthetic reseed stop foreign org');
INSERT INTO auth.users(id,email) VALUES
 ('de200000-0000-0000-0000-000000000001','qa-stop-superadmin@fixture.invalid'),
 ('de200000-0000-0000-0000-000000000002','qa-stop-foreign@fixture.invalid');
-- Explicit synthetic application identities; no PostgreSQL role is created or altered.
UPDATE public.user_roles SET role='super_admin' WHERE user_id='de200000-0000-0000-0000-000000000001';
UPDATE public.user_roles SET role='admin_org' WHERE user_id='de200000-0000-0000-0000-000000000002';
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
 ('de100000-0000-0000-0000-000000000001','de200000-0000-0000-0000-000000000001','admin_org'),
 ('de100000-0000-0000-0000-000000000002','de200000-0000-0000-0000-000000000002','admin_org');
SELECT set_config('request.jwt.claims','{"role":"service_role","sub":"de200000-0000-0000-0000-000000000001"}',true);

DO $fixture$
DECLARE
 d constant uuid:='de100000-0000-0000-0000-000000000001';o uuid;u uuid;
 p uuid;a uuid;t uuid;f uuid;q uuid;c uuid;stage uuid;op uuid;quote uuid;ship uuid;
 pa uuid:=gen_random_uuid();pb uuid:=gen_random_uuid();n uuid:=gen_random_uuid();ct uuid:=gen_random_uuid();route uuid;
BEGIN
 INSERT INTO public.puertos(id,code,name,country) VALUES
 (pa,'QAA'||substr(pa::text,1,8),'Synthetic origin','CN'),
 (pb,'QAB'||substr(pb::text,1,8),'Synthetic destination','MX');
 INSERT INTO public.navieras(id,code,name) VALUES(n,'QA'||substr(n::text,1,8),'Synthetic carrier');
 INSERT INTO public.tipos_contenedor(id,code,name) VALUES(ct,'QA'||substr(ct::text,1,8),'Synthetic container');
 FOREACH o IN ARRAY ARRAY[d,'de100000-0000-0000-0000-000000000002'::uuid] LOOP
  u:=CASE WHEN o=d THEN 'de200000-0000-0000-0000-000000000001'::uuid ELSE 'de200000-0000-0000-0000-000000000002'::uuid END;
  PERFORM set_config('request.jwt.claims',json_build_object('role','service_role','sub',u)::text,true);
  p:=gen_random_uuid();a:=gen_random_uuid();t:=gen_random_uuid();f:=gen_random_uuid();q:=gen_random_uuid();
  c:=gen_random_uuid();op:=gen_random_uuid();route:=gen_random_uuid();quote:=gen_random_uuid();ship:=gen_random_uuid();
  INSERT INTO public.proveedores(id,organization_id,nombre,categoria,tipo)
   VALUES(p,o,'Synthetic retained provider','Logistico','Agente de Carga');
  INSERT INTO public.costeo_agentes(id,organization_id,proveedor_id,nombre) VALUES(a,o,p,'Synthetic retained agent');
  INSERT INTO public.costeo_rutas(id,organization_id,puerto_origen_id,puerto_destino_id) VALUES(route,o,pa,pb);
  INSERT INTO public.costeo_tarifas(id,organization_id,agente_id,naviera_id,ruta_id,tipo_contenedor_id,
   flete_base,vigente_desde,vigente_hasta,estado_aprobacion)
   VALUES(t,o,a,n,route,ct,100,current_date,current_date+30,'borrador');
  INSERT INTO public.costeo_cargos_fob_agente(id,organization_id,agente_id,monto) VALUES(f,o,a,20);
  INSERT INTO public.clientes(id,organization_id,nombre,email,rfc)
   VALUES(c,o,'Synthetic manual customer','qa-stop-'||c||'@fixture.invalid','');
  SELECT id INTO STRICT stage FROM public.crm_etapas_pipeline WHERE organization_id=o LIMIT 1;
  INSERT INTO public.crm_oportunidades(id,organization_id,nombre,cliente_id,etapa_id)
   VALUES(op,o,'Synthetic retained opportunity',c,stage);
  INSERT INTO public.crm_solicitudes_pricing(id,organization_id,oportunidad_id,folio,solicitante_id,tarifa_tarifario_id)
   VALUES(q,o,op,'QA-STOP',u,t);
  INSERT INTO public.cotizaciones(id,organization_id,folio,cliente_id,cliente_nombre,modo,tipo,
   descripcion_mercancia,peso_kg,volumen_m3,piezas,origen,destino,subtotal,moneda,vigencia_dias,estado,operador,tipo_embarque)
   VALUES(quote,o,'QA-STOP-MANUAL',c,'Synthetic manual customer','Marítimo','Importación',
   'Keep manual quotation',1,1,1,'ITGOA','MXVER',1000,'MXN',30,'Enviada','QA manual','FCL');
  INSERT INTO public.embarques(id,organization_id,expediente,cliente_id,cliente_nombre,modo,tipo,
   descripcion_mercancia,peso_kg,volumen_m3,piezas,incoterm,estado,operador,puerto_origen,puerto_destino,
   naviera,tipo_contenedor,etd,eta,tipo_carga)
   VALUES(ship,o,CASE WHEN o=d THEN 'ELMAR900001' ELSE 'ELMAR900002' END,c,'Synthetic manual customer',
   'Marítimo','Importación','Keep manual shipment',1,1,1,'FOB','Confirmado','QA manual','ITGOA','MXVER',
   'MAEU','40HC',CURRENT_DATE+1,CURRENT_DATE+10,'Carga General');
  INSERT INTO pg_temp.qa_stop_ids VALUES(o,u,c,p,a,t,f,q,quote,ship);
 END LOOP;
END;
$fixture$;

-- Construct complete identity-map fixture IDs only; never infer a real adoption.
CREATE TEMP TABLE qa_stop_bindings(fixture_key text,cliente_id uuid,contacto_id uuid,empresa_id uuid);
DO $bindings$
DECLARE c uuid;e uuid;contact uuid;key text;i integer;
 d constant uuid:='de100000-0000-0000-0000-000000000001';
BEGIN
 PERFORM set_config('request.jwt.claims','{"role":"service_role","sub":"de200000-0000-0000-0000-000000000001"}',true);
 i:=0;
 FOREACH key IN ARRAY ARRAY['cliente.pacifico','cliente.monterrey','cliente.bajio'] LOOP
  i:=i+1;c:=gen_random_uuid();contact:=NULL;
  INSERT INTO public.clientes(id,organization_id,nombre,email,rfc)
   VALUES(c,d,'Synthetic mapped identity '||i,'qa-map-'||c||'@fixture.invalid','');
  SELECT id INTO STRICT e FROM public.crm_empresas WHERE cliente_id=c AND organization_id=d;
  IF i<3 THEN
   contact:=gen_random_uuid();
   INSERT INTO public.contactos_cliente(id,organization_id,cliente_id,nombre,email,telefono)
    VALUES(contact,d,c,'Synthetic edited contact '||i,'qa-contact-'||contact||'@fixture.invalid','manual');
  END IF;
  INSERT INTO pg_temp.qa_stop_bindings VALUES(key,c,contact,e);
 END LOOP;
END;
$bindings$;

CREATE FUNCTION pg_temp.qa_stop_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r record;digest text;result jsonb:='{}';
BEGIN
 FOR r IN SELECT n.nspname,c.relname,c.relkind FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','auth','demo_fixture_identity') AND c.relkind IN ('r','S')
  ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb)::text,''UTF8'')),''hex'') FROM %I.%I t',r.nspname,r.relname)
   INTO digest;
  result:=result||jsonb_build_object(r.nspname||'.'||r.relname,digest);
 END LOOP;
 RETURN result;
END;
$$;

-- Nontransactional sequence detects attempted DML even when a later RAISE
-- rolls its rows back. Observers never disable/replace a business trigger.
CREATE TEMP SEQUENCE qa_stop_dml_attempts;
CREATE FUNCTION pg_temp.qa_stop_count_dml() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('qa_stop.observe',true)='on' THEN
  PERFORM nextval('pg_temp.qa_stop_dml_attempts');
 END IF;
 RETURN NULL;
END;
$$;
DO $observers$
DECLARE r record;
BEGIN
 FOR r IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','auth','demo_fixture_identity') AND c.relkind='r'
  ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('CREATE TRIGGER qa_stop_observe_dml BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.qa_stop_count_dml()',r.nspname,r.relname);
 END LOOP;
END;
$observers$;

CREATE FUNCTION pg_temp.qa_stop_probe(p_sql text,p_function text,p_role text,p_actor uuid,p_label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
 before_rows jsonb:=pg_temp.qa_stop_snapshot();after_rows jsonb;
 previous_role text:=current_setting('role');previous_claims text:=current_setting('request.jwt.claims',true);
 before_flag text:=current_setting('app.seed_demo',true);before_seq bigint;after_seq bigint;
 code text;message text;context text;first_frame text;
BEGIN
 SELECT CASE WHEN is_called THEN last_value ELSE 0 END INTO before_seq FROM pg_temp.qa_stop_dml_attempts;
 PERFORM set_config('qa_stop.observe','on',true);
 BEGIN
  PERFORM set_config('role',p_role,true);
  PERFORM set_config('request.jwt.claims',json_build_object('role',p_role,'sub',p_actor)::text,true);
  EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE,message=MESSAGE_TEXT,context=PG_EXCEPTION_CONTEXT;
 END;
 PERFORM set_config('role',previous_role,true);
 PERFORM set_config('request.jwt.claims',coalesce(previous_claims,''),true);
 PERFORM set_config('qa_stop.observe','off',true);
 SELECT CASE WHEN is_called THEN last_value ELSE 0 END INTO after_seq FROM pg_temp.qa_stop_dml_attempts;
 after_rows:=pg_temp.qa_stop_snapshot();first_frame:=split_part(context,E'\n',1);
 PERFORM pg_temp.qa_stop_assert(code='55000' AND message='LC_SEED_DEMO_CONSERVACION_PENDIENTE: reseed bloqueado hasta verificar conservación y adopción',
  p_label||': expected explicit block, received '||coalesce(code,'NO_ERROR')||'/'||coalesce(message,''));
 PERFORM pg_temp.qa_stop_assert(position(p_function||'(' IN coalesce(first_frame,''))>0,
  p_label||': rejection must originate in the invoked route, got '||coalesce(first_frame,''));
 PERFORM pg_temp.qa_stop_assert(after_seq=before_seq,p_label||': attempted DML despite eventual rollback');
 PERFORM pg_temp.qa_stop_assert(after_rows=before_rows,p_label||': full public/auth/registry rows or sequences changed');
 PERFORM pg_temp.qa_stop_assert(current_setting('app.seed_demo',true) IS NOT DISTINCT FROM before_flag,
  p_label||': financial cleanup session flag changed');
 -- Required safety assertions: never NOTICE-only booleans.
 PERFORM pg_temp.qa_stop_assert(NOT EXISTS(SELECT 1 FROM pg_temp.qa_stop_ids x WHERE NOT EXISTS
  (SELECT 1 FROM public.cotizaciones q WHERE q.id=x.quote AND q.organization_id=x.organization_id)),p_label||': manual quotes preserved in both organizations');
 PERFORM pg_temp.qa_stop_assert(NOT EXISTS(SELECT 1 FROM pg_temp.qa_stop_ids x WHERE NOT EXISTS
  (SELECT 1 FROM public.embarques e WHERE e.id=x.shipment AND e.organization_id=x.organization_id)),p_label||': manual shipments preserved in both organizations');
 PERFORM pg_temp.qa_stop_assert(NOT EXISTS(SELECT 1 FROM pg_temp.qa_stop_ids x WHERE NOT EXISTS
  (SELECT 1 FROM public.crm_solicitudes_pricing p WHERE p.id=x.pricing AND p.tarifa_tarifario_id=x.tariff)),p_label||': pricing links preserved');
 INSERT INTO pg_temp.qa_stop_runs VALUES(p_label,p_function,p_actor,p_role,code,after_seq-before_seq,
  encode(sha256(convert_to(after_rows::text,'UTF8')),'hex'));
END;
$$;

DO $matrix$
DECLARE map_mode text:='no_map'; marker text;caller uuid;call record;label text;
BEGIN
  FOREACH marker IN ARRAY ARRAY['absent','old','recent'] LOOP
   IF marker='absent' THEN DELETE FROM public.demo_seed_state;
   ELSE
    INSERT INTO public.demo_seed_state(id,last_seeded_at)
     VALUES(true,CASE WHEN marker='old' THEN '2000-01-01'::timestamptz ELSE clock_timestamp() END)
     ON CONFLICT(id) DO UPDATE SET last_seeded_at=excluded.last_seeded_at;
   END IF;
   FOREACH caller IN ARRAY ARRAY['de200000-0000-0000-0000-000000000001'::uuid,'de200000-0000-0000-0000-000000000002'::uuid] LOOP
    FOR call IN SELECT * FROM (VALUES
     ('SELECT public.seed_demo_organization_core()','seed_demo_organization_core'),
     ('SELECT public.seed_demo_organization_guarded(0)','seed_demo_organization_guarded'),
     ('SELECT public.seed_demo_organization_guarded(600000)','seed_demo_organization_guarded'),
     ('SELECT public.seed_demo_organization_guarded()','seed_demo_organization_guarded'),
     ('SELECT public.seed_demo_organization_guarded(NULL)','seed_demo_organization_guarded'),
     ('SELECT public.seed_demo_organization()','seed_demo_organization'),
     ('SELECT public._seed_demo_limpiar_financiero()','_seed_demo_limpiar_financiero')
    ) calls(sql,fn) LOOP
     label:=map_mode||'/'||marker||'/'||caller||'/'||call.sql;
     PERFORM pg_temp.qa_stop_probe(call.sql,call.fn,'service_role',caller,label);
    END LOOP;
   END LOOP;
   PERFORM pg_temp.qa_stop_probe('SELECT public.seed_demo_organization()','seed_demo_organization','authenticated',
    'de200000-0000-0000-0000-000000000001',map_mode||'/'||marker||'/authenticated super_admin legacy route');
  END LOOP;
END;
$matrix$;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT pg_temp.qa_stop_assert((SELECT count(*)=45 AND sum(attempts)=0 AND count(DISTINCT route)=4 FROM pg_temp.qa_stop_runs),
 'all 45 authorized calls reject explicitly at their entrypoint with zero attempted DML');
SELECT jsonb_build_object('calls',(SELECT count(*) FROM pg_temp.qa_stop_runs),
 'assertions',(SELECT count(*) FROM pg_temp.qa_stop_checks),'routes',4,
 'attempted_DML',(SELECT sum(attempts) FROM pg_temp.qa_stop_runs),'both_organizations_intact',true,
 'manual_quote_preserved',true,'manual_shipment_preserved',true,'pricing_links_preserved',true,
 'last_seeded_at_preserved',true,'row_and_sequence_snapshots_intact',true,
 'no_identity_preparation_or_adoption',true,'marker_modes',jsonb_build_array('absent','old','recent'),
 'test_only_statement_observers',true,'core_or_helper_stubbed',false,'FK_or_RLS_relaxed',false);
ROLLBACK;
