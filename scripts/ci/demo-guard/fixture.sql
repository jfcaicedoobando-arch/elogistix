-- Forward tenant guard regression, prepared for isolated disposable PostgreSQL CI.
-- Requires the literal0014 replay AND the reviewed forward safety migration.
-- Source only: not executed or authorized for any deployed ERP database.
-- Real constraints, RLS and triggers stay enabled. All fixtures, added observers,
-- and the sole replacement (seed core stub) are restored by outer ROLLBACK.
BEGIN ISOLATION LEVEL READ COMMITTED;

CREATE FUNCTION pg_temp.demo_assert(p_ok boolean, p_label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'DEMO CLEANUP TEST FAIL: %', p_label;
  END IF;
END;
$$;

-- Exercise the real service_role EXECUTE ACL, not only a forged JWT as postgres.
CREATE FUNCTION pg_temp.demo_call(p_skip_ms bigint)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE previous_role text:=current_setting('role'); result boolean;
BEGIN
  PERFORM set_config('role','service_role',true);
  result:=public.seed_demo_organization_guarded(p_skip_ms);
  PERFORM set_config('role',previous_role,true);
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('role',previous_role,true);
  RAISE;
END;
$$;

SELECT pg_temp.demo_assert(
  has_function_privilege('service_role','public.seed_demo_organization_guarded(bigint)','EXECUTE')
  AND NOT has_function_privilege('anon','public.seed_demo_organization_guarded(bigint)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.seed_demo_organization_guarded(bigint)','EXECUTE'),
  'wrapper retains service-only EXECUTE ACL');

-- Snapshot complete rows, not just counts: detects FK SET NULL and trigger edits.
CREATE FUNCTION pg_temp.demo_snapshot(p_org uuid)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'providers', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id), '[]') FROM public.proveedores x WHERE organization_id=p_org),
    'agents', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id), '[]') FROM public.costeo_agentes x WHERE organization_id=p_org),
    'fob', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id), '[]') FROM public.costeo_cargos_fob_agente x WHERE organization_id=p_org),
    'rates', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id), '[]') FROM public.costeo_tarifas x WHERE organization_id=p_org),
    'surcharges', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id), '[]') FROM public.costeo_tarifa_recargos x WHERE organization_id=p_org),
    'pricing', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id), '[]') FROM public.crm_solicitudes_pricing x WHERE organization_id=p_org),
    'advances', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id), '[]') FROM public.anticipos_proveedor x WHERE organization_id=p_org),
    'applications', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id), '[]') FROM public.anticipos_aplicaciones x WHERE organization_id=p_org),
    'supplier_invoices', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id), '[]') FROM public.proveedor_facturas x WHERE organization_id=p_org),
    'supplier_payments', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id), '[]') FROM public.pagos_proveedor x WHERE organization_id=p_org),
    'agent_users', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id), '[]') FROM public.agente_users x WHERE organization_id=p_org));
$$;

CREATE TEMP TABLE demo_test_calls (called boolean NOT NULL);
CREATE TEMP TABLE demo_test_ids (
  org uuid PRIMARY KEY, actor uuid, provider uuid, agent uuid, rate uuid,
  fob uuid, surcharge uuid, pricing uuid
);

-- Fail closed on a populated demo, before replacing any function.
SELECT pg_temp.demo_assert(NOT EXISTS (
  SELECT FROM public.organizations WHERE id='de100000-0000-0000-0000-000000000001'),
  'requires empty disposable demo organization; never reuse deployed demo data');

-- Observe attempts, not just rolled-back end state: a misplaced gate that
-- reaches any business DML fails with a distinct error before row triggers.
CREATE FUNCTION pg_temp.demo_forbid_dml() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('demo_test.dml_forbidden',true)='1' THEN
    RAISE EXCEPTION 'DEMO_TEST_UNEXPECTED_DML' USING ERRCODE='P0001';
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER demo_test_observe_pricing BEFORE UPDATE ON public.crm_solicitudes_pricing
FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.demo_forbid_dml();
CREATE TRIGGER demo_test_observe_fob BEFORE DELETE ON public.costeo_cargos_fob_agente
FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.demo_forbid_dml();
CREATE TRIGGER demo_test_observe_rates BEFORE DELETE ON public.costeo_tarifas
FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.demo_forbid_dml();
CREATE TRIGGER demo_test_observe_agents BEFORE DELETE ON public.costeo_agentes
FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.demo_forbid_dml();

CREATE OR REPLACE FUNCTION public.seed_demo_organization_core()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('demo_test.dml_forbidden',true)='1' THEN
    RAISE EXCEPTION 'DEMO_TEST_UNEXPECTED_CORE' USING ERRCODE='P0001';
  END IF;
  IF current_setting('demo_test.barrier',true)='1' THEN
    PERFORM pg_advisory_xact_lock(190132,210013);
  END IF;
  INSERT INTO pg_temp.demo_test_calls VALUES (true);
  -- Reproduce the original incident with the actual provider/agent FK:
  -- provider deletion must succeed only after the wrapper deletes demo agents.
  DELETE FROM public.proveedores
    WHERE id IN (SELECT provider FROM pg_temp.demo_test_ids
      WHERE org='de100000-0000-0000-0000-000000000001');
  IF current_setting('demo_test.force_failure', true) = '1' THEN
    RAISE EXCEPTION 'DEMO_TEST_CORE_FORCED_FAILURE' USING ERRCODE='P0001';
  END IF;
END;
$$;

DO $fixture$
DECLARE
  d constant uuid := 'de100000-0000-0000-0000-000000000001';
  o uuid; u uuid; p uuid; a uuid; t uuid; f uuid; s uuid; q uuid;
  port_a uuid := gen_random_uuid(); port_b uuid := gen_random_uuid();
  n uuid := gen_random_uuid(); c uuid := gen_random_uuid(); r uuid;
  customer uuid; stage uuid; opportunity uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  INSERT INTO public.puertos(id,code,name,country) VALUES
    (port_a,'DTA'||substr(port_a::text,1,8),'Synthetic origin','CN'),
    (port_b,'DTB'||substr(port_b::text,1,8),'Synthetic destination','MX');
  INSERT INTO public.navieras(id,code,name) VALUES(n,'DT'||substr(n::text,1,8),'Synthetic carrier');
  INSERT INTO public.tipos_contenedor(id,code,name) VALUES(c,'DT'||substr(c::text,1,8),'Synthetic container');
  FOREACH o IN ARRAY ARRAY[d, gen_random_uuid()] LOOP
    u:=gen_random_uuid(); p:=gen_random_uuid(); a:=gen_random_uuid();
    t:=gen_random_uuid(); f:=gen_random_uuid(); s:=gen_random_uuid();
    q:=gen_random_uuid(); r:=gen_random_uuid(); customer:=gen_random_uuid();
    stage:=gen_random_uuid(); opportunity:=gen_random_uuid();
    INSERT INTO auth.users(id,email) VALUES(u,'demo-'||u||'@example.invalid');
    INSERT INTO public.organizations(id,nombre) VALUES(o,'Synthetic demo cleanup test');
    INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(o,u,'admin_org');
    INSERT INTO public.proveedores(id,organization_id,nombre,categoria,tipo)
      VALUES(p,o,'Synthetic provider','Logistico','Agente de Carga'::public.tipo_proveedor);
    INSERT INTO public.costeo_agentes(id,organization_id,proveedor_id,nombre) VALUES(a,o,p,'Synthetic agent');
    INSERT INTO public.costeo_rutas(id,organization_id,puerto_origen_id,puerto_destino_id) VALUES(r,o,port_a,port_b);
    INSERT INTO public.costeo_tarifas(id,organization_id,agente_id,naviera_id,ruta_id,tipo_contenedor_id,
      flete_base,vigente_desde,vigente_hasta,estado_aprobacion)
      VALUES(t,o,a,n,r,c,100,current_date,current_date+30,'borrador');
    INSERT INTO public.costeo_cargos_fob_agente(id,organization_id,agente_id,monto) VALUES(f,o,a,20);
    INSERT INTO public.costeo_tarifa_recargos(id,organization_id,tarifa_id,concepto,lado,monto)
      VALUES(s,o,t,'Synthetic surcharge','origen',5);
    INSERT INTO public.clientes(id,organization_id,nombre) VALUES(customer,o,'Synthetic customer');
    INSERT INTO public.crm_etapas_pipeline(id,organization_id,nombre) VALUES(stage,o,'Synthetic open stage');
    INSERT INTO public.crm_oportunidades(id,organization_id,nombre,cliente_id,etapa_id)
      VALUES(opportunity,o,'Synthetic opportunity',customer,stage);
    INSERT INTO public.crm_solicitudes_pricing(id,organization_id,oportunidad_id,folio,solicitante_id,tarifa_tarifario_id)
      VALUES(q,o,opportunity,'synthetic',u,t);
    INSERT INTO pg_temp.demo_test_ids VALUES(o,u,p,a,t,f,s,q);
  END LOOP;
END;
$fixture$;

