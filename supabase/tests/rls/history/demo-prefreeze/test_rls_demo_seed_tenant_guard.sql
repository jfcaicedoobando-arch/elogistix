-- Forward tenant guard regression, prepared for isolated disposable PostgreSQL CI.
-- Requires the literal0014 replay AND the reviewed forward safety migration.
-- Source only: not executed or authorized for any deployed ERP database.
-- Real constraints, RLS and triggers stay enabled. All fixtures, added observers,
-- and the sole replacement (seed core stub) are restored by outer ROLLBACK.
BEGIN;

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
    INSERT INTO public.clientes(id,organization_id,nombre,email)
      VALUES(customer,o,'Synthetic customer','demo-customer-'||customer||'@example.invalid');
    INSERT INTO public.crm_etapas_pipeline(id,organization_id,nombre) VALUES(stage,o,'Synthetic open stage');
    INSERT INTO public.crm_oportunidades(id,organization_id,nombre,cliente_id,etapa_id)
      VALUES(opportunity,o,'Synthetic opportunity',customer,stage);
    INSERT INTO public.crm_solicitudes_pricing(id,organization_id,oportunidad_id,folio,solicitante_id,tarifa_tarifario_id)
      VALUES(q,o,opportunity,'synthetic',u,t);
    INSERT INTO pg_temp.demo_test_ids VALUES(o,u,p,a,t,f,s,q);
  END LOOP;
END;
$fixture$;

DO $test$
DECLARE
  d constant uuid := 'de100000-0000-0000-0000-000000000001';
  other_org uuid; demo_before jsonb; other_before jsonb; state_before jsonb;
  result boolean; failed boolean:=false; v_state text; v_message text; v_table text; v_column text;
BEGIN
  SELECT org INTO STRICT other_org FROM pg_temp.demo_test_ids WHERE org<>d;
  -- Confirm the unmodified FK reproduces SET NULL versus NOT NULL.
  BEGIN
    DELETE FROM public.proveedores WHERE id=(SELECT provider FROM pg_temp.demo_test_ids WHERE org=d);
  EXCEPTION WHEN not_null_violation THEN
    GET STACKED DIAGNOSTICS v_table=TABLE_NAME,v_column=COLUMN_NAME;
    failed:=v_table='costeo_agentes' AND v_column='proveedor_id';
  END;
  PERFORM pg_temp.demo_assert(failed,'original provider deletion fails with agent NOT NULL FK');

  INSERT INTO public.demo_seed_state(id,last_seeded_at) VALUES(true,clock_timestamp())
    ON CONFLICT(id) DO UPDATE SET last_seeded_at=excluded.last_seeded_at;
  demo_before:=pg_temp.demo_snapshot(d); other_before:=pg_temp.demo_snapshot(other_org);
  SELECT to_jsonb(x) INTO state_before FROM public.demo_seed_state x WHERE id=true;
  result:=pg_temp.demo_call(600000);
  PERFORM pg_temp.demo_assert(result IS false,'cooldown returns false');
  PERFORM pg_temp.demo_assert(pg_temp.demo_snapshot(d)=demo_before AND pg_temp.demo_snapshot(other_org)=other_before,
    'cooldown changes no demo or non-demo fixture rows');
  PERFORM pg_temp.demo_assert((SELECT to_jsonb(x)=state_before FROM public.demo_seed_state x WHERE id=true)
    AND NOT EXISTS(SELECT FROM pg_temp.demo_test_calls),'cooldown leaves state and core untouched');

  -- The exception handler forms a real PG subtransaction. The wrapper's update,
  -- deletes, cascades and the stub core's provider deletion must all roll back.
  PERFORM set_config('demo_test.force_failure','1',true);
  failed:=false;
  BEGIN
    PERFORM pg_temp.demo_call(0);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT;
    failed:=v_state='P0001' AND v_message='DEMO_TEST_CORE_FORCED_FAILURE';
    IF NOT failed THEN RAISE; END IF;
  END;
  PERFORM pg_temp.demo_assert(failed,'failure came from test core after cleanup');
  PERFORM pg_temp.demo_assert(pg_temp.demo_snapshot(d)=demo_before AND pg_temp.demo_snapshot(other_org)=other_before,
    'forced core failure fully restores both organizations');
  PERFORM pg_temp.demo_assert((SELECT to_jsonb(x)=state_before FROM public.demo_seed_state x WHERE id=true)
    AND NOT EXISTS(SELECT FROM pg_temp.demo_test_calls),'forced failure restores state and core marker');
  PERFORM set_config('demo_test.force_failure','0',true);

  -- Successful branch runs inside a subtransaction that is then rolled back,
  -- leaving the exact same fixture available for the cross-tenant cases below.
  BEGIN
    result:=pg_temp.demo_call(0);
    PERFORM pg_temp.demo_assert(result IS true,'uncooldown returns true');
    PERFORM pg_temp.demo_assert(NOT EXISTS(SELECT FROM public.costeo_agentes WHERE organization_id=d)
      AND NOT EXISTS(SELECT FROM public.costeo_tarifas WHERE organization_id=d)
      AND NOT EXISTS(SELECT FROM public.costeo_cargos_fob_agente WHERE organization_id=d),
      'all three demo targets removed');
    PERFORM pg_temp.demo_assert(NOT EXISTS(SELECT FROM public.costeo_tarifa_recargos WHERE organization_id=d),
      'demo tariff child cascade exercised');
    PERFORM pg_temp.demo_assert((SELECT tarifa_tarifario_id IS NULL FROM public.crm_solicitudes_pricing
      WHERE id=(SELECT pricing FROM pg_temp.demo_test_ids WHERE org=d)), 'demo pricing reference cleared');
    PERFORM pg_temp.demo_assert(pg_temp.demo_snapshot(other_org)=other_before,'non-demo independent rows unchanged');
    PERFORM pg_temp.demo_assert((SELECT count(*)=1 FROM pg_temp.demo_test_calls),'core called exactly once');
    PERFORM pg_temp.demo_assert((SELECT last_seeded_at>(state_before->>'last_seeded_at')::timestamptz
      FROM public.demo_seed_state WHERE id=true),'state advances after success');
    RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback successful branch';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END;
$test$;

-- Require exact denial, unchanged full fixture rows/state, and no attempted
-- first DML/core. Unexpected fixture/FK errors must never be counted as success.
CREATE FUNCTION pg_temp.demo_expect_unsafe(p_other_org uuid,p_label text,
  p_expected text DEFAULT 'LC_SEED_DEMO_TENANT_UNSAFE: referencia entre empresas en %')
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  d constant uuid:='de100000-0000-0000-0000-000000000001';
  before_demo jsonb:=pg_temp.demo_snapshot(d);
  before_other jsonb:=pg_temp.demo_snapshot(p_other_org);
  before_state jsonb; before_calls bigint; v_state text; v_message text;
BEGIN
  SELECT to_jsonb(x) INTO before_state FROM public.demo_seed_state x WHERE id=true;
  SELECT count(*) INTO before_calls FROM pg_temp.demo_test_calls;
  PERFORM set_config('demo_test.dml_forbidden','1',true);
  BEGIN
    PERFORM pg_temp.demo_call(0);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT;
  END;
  PERFORM set_config('demo_test.dml_forbidden','0',true);
  PERFORM pg_temp.demo_assert(v_state='P0001' AND v_message LIKE p_expected,
    p_label||': expected exact tenant gate, got '||coalesce(v_state,'no error')||'/'||coalesce(v_message,''));
  PERFORM pg_temp.demo_assert(pg_temp.demo_snapshot(d)=before_demo
    AND pg_temp.demo_snapshot(p_other_org)=before_other,p_label||': both organizations preserved');
  PERFORM pg_temp.demo_assert((SELECT to_jsonb(x) FROM public.demo_seed_state x WHERE id=true)
    IS NOT DISTINCT FROM before_state,p_label||': seed state preserved');
  PERFORM pg_temp.demo_assert((SELECT count(*) FROM pg_temp.demo_test_calls)=before_calls,
    p_label||': core call marker preserved');
END;
$$;

DO $cross_tenant$
DECLARE
  d constant uuid:='de100000-0000-0000-0000-000000000001';
  other_org uuid; mode text; before_rows jsonb; before_state jsonb; result boolean;
BEGIN
  SELECT org INTO STRICT other_org FROM pg_temp.demo_test_ids WHERE org<>d;
  FOREACH mode IN ARRAY ARRAY['CASCADE','SET NULL','OUTBOUND'] LOOP
    BEGIN
      IF mode='CASCADE' THEN
        INSERT INTO public.agente_users(user_id,agente_id,organization_id)
          SELECT b.actor,a.agent,b.org FROM pg_temp.demo_test_ids a CROSS JOIN pg_temp.demo_test_ids b
          WHERE a.org=d AND b.org=other_org;
      ELSIF mode='SET NULL' THEN
        UPDATE public.costeo_tarifas SET reemplazada_por=(SELECT rate FROM pg_temp.demo_test_ids WHERE org=d)
          WHERE id=(SELECT rate FROM pg_temp.demo_test_ids WHERE org=other_org);
      ELSE
        -- Reverse direction: demo child references a foreign parent.
        UPDATE public.costeo_tarifas SET reemplazada_por=(SELECT rate FROM pg_temp.demo_test_ids WHERE org=other_org)
          WHERE id=(SELECT rate FROM pg_temp.demo_test_ids WHERE org=d);
      END IF;
      PERFORM pg_temp.demo_expect_unsafe(other_org,mode);
      -- Cooldown skips even an unsafe graph. It must not become an error and
      -- must still do nothing. The same graph was denied above when not skipped.
      before_rows:=pg_temp.demo_snapshot(other_org);
      INSERT INTO public.demo_seed_state(id,last_seeded_at) VALUES(true,clock_timestamp())
        ON CONFLICT(id) DO UPDATE SET last_seeded_at=excluded.last_seeded_at;
      SELECT to_jsonb(x) INTO before_state FROM public.demo_seed_state x WHERE id=true;
      PERFORM set_config('demo_test.dml_forbidden','1',true);
      result:=pg_temp.demo_call(600000);
      PERFORM set_config('demo_test.dml_forbidden','0',true);
      PERFORM pg_temp.demo_assert(result IS false AND pg_temp.demo_snapshot(other_org)=before_rows
        AND (SELECT to_jsonb(x)=before_state FROM public.demo_seed_state x WHERE id=true)
        AND NOT EXISTS(SELECT FROM pg_temp.demo_test_calls),mode||': cooldown skips gate and all business effects');
      RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='rollback cross-tenant branch';
    EXCEPTION WHEN SQLSTATE 'ZX002' THEN NULL;
    END;
  END LOOP;
END;
$cross_tenant$;

-- Outbound trigger-recalculation case: a demo application points to a foreign
-- advance. Its DELETE would call tg_anticipo_saldo -> _recalc_anticipo_saldo by
-- parent id without tenant filter. Keep the real FK and real recalculation trigger.
DO $outbound_recalc$
DECLARE
  d constant uuid:='de100000-0000-0000-0000-000000000001';
  other_org uuid; advance uuid:=gen_random_uuid(); invoice uuid:=gen_random_uuid();
  payment uuid:=gen_random_uuid(); application uuid:=gen_random_uuid(); category uuid:=gen_random_uuid();
  foreign_before jsonb; application_before jsonb;
BEGIN
  SELECT org INTO STRICT other_org FROM pg_temp.demo_test_ids WHERE org<>d;
  INSERT INTO public.presupuesto_categorias(id,organization_id,nombre,tipo_contable)
    VALUES(category,d,'Synthetic outbound category','Administracion');
  INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,proveedor_nombre,
    categoria_presupuesto_id,folio_proveedor,fecha_emision,moneda,tipo_cambio_usd,subtotal,total,
    estado,estado_aprobacion)
    SELECT invoice,d,provider,'Synthetic provider',category,'DEMO-'||invoice,
      public.fecha_negocio_mx(),'MXN',1,100,100,'Vigente','aprobada'
    FROM pg_temp.demo_test_ids WHERE org=d;
  INSERT INTO public.pagos_proveedor(id,organization_id,proveedor_factura_id,fecha_pago,monto,
    moneda,tipo_cambio_usd,monto_en_moneda_factura)
    VALUES(payment,d,invoice,public.fecha_negocio_mx(),10,'MXN',1,10);
  INSERT INTO public.anticipos_proveedor(id,organization_id,proveedor_id,monto,moneda,saldo_disponible)
    SELECT advance,other_org,provider,100,'MXN',100 FROM pg_temp.demo_test_ids WHERE org=other_org;
  INSERT INTO public.anticipos_aplicaciones(id,organization_id,anticipo_id,proveedor_factura_id,
    pago_proveedor_id,monto_aplicado,moneda_aplicada)
    VALUES(application,d,advance,invoice,payment,10,'MXN');
  PERFORM pg_temp.demo_assert((SELECT saldo_disponible=90 AND estado='aplicado_parcial'
    FROM public.anticipos_proveedor WHERE id=advance),'real foreign-parent recalculation ran during fixture setup');
  SELECT to_jsonb(x) INTO foreign_before FROM public.anticipos_proveedor x WHERE id=advance;
  SELECT to_jsonb(x) INTO application_before FROM public.anticipos_aplicaciones x WHERE id=application;
  PERFORM pg_temp.demo_expect_unsafe(other_org,'outbound foreign advance rollup');
  PERFORM pg_temp.demo_assert((SELECT to_jsonb(x)=foreign_before FROM public.anticipos_proveedor x WHERE id=advance)
    AND (SELECT to_jsonb(x)=application_before FROM public.anticipos_aplicaciones x WHERE id=application),
    'foreign balance/updated_at and demo application unchanged');
  RAISE EXCEPTION USING ERRCODE='ZX003',MESSAGE='rollback outbound fixtures';
EXCEPTION WHEN SQLSTATE 'ZX003' THEN NULL;
END;
$outbound_recalc$;

-- Schema drift with a previously unknown unscoped FK child is unsupported.
-- Additive test DDL only: no existing table/constraint/trigger is weakened.
DO $schema_drift$
DECLARE other_org uuid;
BEGIN
  SELECT org INTO STRICT other_org FROM pg_temp.demo_test_ids
    WHERE org<>'de100000-0000-0000-0000-000000000001';
  CREATE TABLE public.demo_test_unknown_fk_child (
    id uuid PRIMARY KEY, agent_id uuid REFERENCES public.costeo_agentes(id));
  PERFORM pg_temp.demo_expect_unsafe(other_org,'unknown unscoped FK table',
    'LC_SEED_DEMO_TENANT_UNSAFE: forma de tabla no soportada public.demo_test_unknown_fk_child');
  RAISE EXCEPTION USING ERRCODE='ZX004',MESSAGE='rollback schema drift fixture';
EXCEPTION WHEN SQLSTATE 'ZX004' THEN NULL;
END;
$schema_drift$;
-- A newly connected scoped table must not be missed merely because it was
-- absent from the migration author's static inventory. NULL ownership is unsafe.
DO $new_scoped_edge$
DECLARE d constant uuid:='de100000-0000-0000-0000-000000000001'; other_org uuid;
BEGIN
  SELECT org INTO STRICT other_org FROM pg_temp.demo_test_ids WHERE org<>d;
  CREATE TABLE public.demo_test_scoped_fk_child (
    id uuid PRIMARY KEY, organization_id uuid, agent_id uuid,
    CONSTRAINT demo_test_scoped_parent FOREIGN KEY(agent_id) REFERENCES public.costeo_agentes(id) ON DELETE CASCADE);
  INSERT INTO public.demo_test_scoped_fk_child(id,organization_id,agent_id)
    SELECT gen_random_uuid(),NULL,agent FROM pg_temp.demo_test_ids WHERE org=d;
  PERFORM pg_temp.demo_expect_unsafe(other_org,'new nullable scoped edge',
    'LC_SEED_DEMO_TENANT_UNSAFE: referencia entre empresas en demo_test_scoped_parent');
  RAISE EXCEPTION USING ERRCODE='ZX005',MESSAGE='rollback new scoped edge';
EXCEPTION WHEN SQLSTATE 'ZX005' THEN NULL;
END;
$new_scoped_edge$;
ROLLBACK;
