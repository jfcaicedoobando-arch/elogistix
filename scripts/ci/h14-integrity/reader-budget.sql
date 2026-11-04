-- Full public-reader budget regression in this job's owned finance clone.
-- All business rows and Auth identities are fictional and are rolled back.
-- The 8 s limit applies to each SELECT sent by psql, not a setting changed
-- inside the statement being measured. No production timing/SLA is claimed.
BEGIN;
SET LOCAL statement_timeout = '180s';
SET LOCAL lock_timeout = '2s';
\ir fixture_helpers.sql

DO $guard$
BEGIN
  PERFORM pg_temp.h14_fin_assert(current_database() ~ '^h14_finance_[0-9a-f]{32}$'
    AND inet_server_addr() IS NULL
    AND current_setting('unix_socket_directories') IN ('/lab','/var/run/postgresql')
    AND current_user='postgres' AND session_user='postgres',
    'reader budget requires the owned strict local finance clone');
END $guard$;

DO $seed$
DECLARE
  empty_case jsonb; shared_case jsonb; foreign_case jsonb; noise_case jsonb;
  target uuid; invoice uuid; proforma uuid; org uuid; foreign_org uuid;
  foreign_shipment uuid; n integer; needed integer; extra_concepts integer;
BEGIN
  empty_case := pg_temp.h14_fin_fixture('B01','reader-budget');
  target := pg_temp.h14_fin_second_shipment(empty_case,'reader-budget-shared');
  shared_case := empty_case || jsonb_build_object('case_key','READER-BUDGET-X07',
    'matrix_id','X07','target_embarque_id',target,'embarque_a',target);
  invoice := pg_temp.h14_fin_invoice(shared_case,'invoice',target);
  INSERT INTO public.factura_embarques(factura_id,embarque_id,organization_id,activa)
    VALUES(invoice,target,(empty_case->>'org_a')::uuid,true) ON CONFLICT DO NOTHING;
  proforma := pg_temp.h14_fin_proforma(shared_case,'source-proforma',target,
    'facturada','aprobada','aceptada');
  UPDATE public.proformas SET factura_id=invoice WHERE id=proforma;
  PERFORM pg_temp.h14_fin_sale(shared_case,'source-sale',target,proforma,0);
  INSERT INTO public.conceptos_factura(id,organization_id,factura_id,embarque_id,
    proforma_id_origen,descripcion,cantidad,precio_unitario,total,moneda,tipo_iva,tasa_iva_aplicada)
    VALUES(pg_temp.h14_fin_uuid(shared_case->>'case_key','invoice-concept'),
      (empty_case->>'org_a')::uuid,invoice,target,proforma,
      'H14 reader budget redundant fictitious paths',1,0,0,'MXN','tasa_0',0);
  shared_case := shared_case || jsonb_build_object('invoice_ids',jsonb_build_array(invoice));

  org := (empty_case->>'org_a')::uuid;
  noise_case := empty_case || jsonb_build_object('case_key','READER-BUDGET-OWN-NOISE');
  needed := greatest(0,47-(SELECT count(*)::int FROM public.embarques WHERE organization_id=org));
  FOR n IN 1..needed LOOP
    PERFORM pg_temp.h14_fin_second_shipment(noise_case,'shipment-'||n);
  END LOOP;
  needed := greatest(0,32-(SELECT count(*)::int FROM public.proformas WHERE organization_id=org));
  FOR n IN 1..needed LOOP
    PERFORM pg_temp.h14_fin_proforma(noise_case,'proforma-'||n,
      (empty_case->>'embarque_control_a')::uuid,'cancelada','borrador','pendiente',0);
  END LOOP;
  needed := greatest(0,45-(SELECT count(*)::int FROM public.facturas WHERE organization_id=org));
  FOR n IN 1..needed LOOP
    PERFORM pg_temp.h14_fin_invoice(noise_case,'invoice-'||n,
      (empty_case->>'embarque_control_a')::uuid,'Borrador');
  END LOOP;

  foreign_case := pg_temp.h14_fin_seed('READER-BUDGET-FOREIGN');
  foreign_org := (foreign_case->>'org_a')::uuid;
  foreign_shipment := (foreign_case->>'embarque_a')::uuid;
  needed := greatest(0,399-(SELECT count(*)::int FROM public.embarques));
  FOR n IN 1..needed LOOP
    PERFORM pg_temp.h14_fin_second_shipment(foreign_case,'noise-shipment-'||n);
  END LOOP;
  FOR n IN 1..501 LOOP
    PERFORM pg_temp.h14_fin_proforma(foreign_case,'noise-proforma-'||n,
      foreign_shipment,'cancelada','borrador','pendiente',0);
  END LOOP;
  extra_concepts := greatest(0,392-(SELECT count(*)::int FROM public.conceptos_factura)-326);
  FOR n IN 1..326 LOOP
    invoice := pg_temp.h14_fin_invoice(foreign_case,'noise-invoice-'||n,
      foreign_shipment,'Borrador');
    IF n <= extra_concepts THEN
      INSERT INTO public.conceptos_factura(id,organization_id,factura_id,embarque_id,
        descripcion,cantidad,precio_unitario,total,moneda,tipo_iva,tasa_iva_aplicada)
        VALUES(pg_temp.h14_fin_uuid(foreign_case->>'case_key','extra-concept-'||n),
          foreign_org,invoice,foreign_shipment,'H14 fictitious historical concept',
          1,0,0,'MXN','tasa_0',0);
    END IF;
    IF n <= 29 THEN UPDATE public.facturas SET estado='Cancelada' WHERE id=invoice; END IF;
  END LOOP;
  -- Never update ancestry or attach an invoice to a cancelled proforma.
  -- These foreign documents have no lineage to either tested target.
  needed := greatest(0,1200-(SELECT count(*)::int FROM public.conceptos_venta));
  FOR n IN 1..needed LOOP
    PERFORM pg_temp.h14_fin_sale(foreign_case,'noise-sale-'||n,foreign_shipment,NULL,0);
  END LOOP;
  PERFORM pg_temp.h14_fin_assert(
    (SELECT count(*)=501 FROM public.proformas WHERE organization_id=foreign_org
      AND estado_proforma='cancelada')
    AND (SELECT count(*)=326 FROM public.facturas WHERE organization_id=foreign_org)
    AND (SELECT count(*)=32 FROM public.proformas WHERE organization_id=org)
    AND (SELECT count(*)=45 FROM public.facturas WHERE organization_id=org),
    'reader budget fixture cardinalities must be real, not assumed');
  PERFORM set_config('h14.reader_budget.empty_fixture',empty_case::text,true);
  PERFORM set_config('h14.reader_budget.shared_fixture',shared_case::text,true);
  PERFORM set_config('h14.reader_budget.foreign_org',foreign_org::text,true);
END $seed$;
ANALYZE public.embarques;
ANALYZE public.proformas;
ANALYZE public.facturas;
ANALYZE public.conceptos_factura;
ANALYZE public.conceptos_venta;

DO $snapshot$
DECLARE org uuid := (current_setting('h14.reader_budget.empty_fixture')::jsonb->>'org_a')::uuid;
BEGIN
  PERFORM set_config('h14.reader_budget.own_before',md5(pg_temp.h14_fin_snapshot(org)::text),true);
  PERFORM set_config('h14.reader_budget.foreign_before',
    md5(pg_temp.h14_fin_snapshot(current_setting('h14.reader_budget.foreign_org')::uuid)::text),true);
END $snapshot$;

CREATE FUNCTION pg_temp.h14_reader_budget_probe(p_case text,p_fixture jsonb,p_mode text,p_repeat integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $probe$
DECLARE
  actor uuid := (p_fixture->>'actor_a')::uuid;
  org uuid := (p_fixture->>'org_a')::uuid;
  target uuid := (p_fixture->>'target_embarque_id')::uuid;
  expected jsonb := '{"facturas":0,"cxp":0,"pagos_cxc":0,"pagos_cxp":0,"notas_credito_cxc":0,"notas_credito_cxp":0,"comisiones_definitivas":0,"proformas":0}';
  d jsonb; key text; sample jsonb; started timestamptz; elapsed_ms numeric;
BEGIN
  PERFORM pg_temp.h14_fin_assert(p_case IN ('empty','shared') AND p_repeat IN (1,2),
    'known reader budget case/repeat required');
  PERFORM pg_temp.h14_fin_assert_actor(actor,org);
  PERFORM pg_temp.h14_fin_assert(current_setting('jit')='off'
    AND current_setting('plan_cache_mode')=p_mode
    AND p_mode IN ('force_custom_plan','force_generic_plan')
    AND extract(epoch FROM current_setting('statement_timeout')::interval)=8,
    'reader must run under the actual 8s budget with JIT off and declared plan mode');
  IF p_case='shared' THEN expected := expected || '{"facturas":1}'::jsonb; END IF;
  started := clock_timestamp();
  d := public.diagnosticar_baja_embarque(target);
  elapsed_ms := extract(epoch FROM clock_timestamp()-started)*1000;
  PERFORM pg_temp.h14_fin_assert_actor(actor,org);
  PERFORM pg_temp.h14_fin_assert(elapsed_ms>=0 AND elapsed_ms<8000,'reader exceeded its 8s budget');
  PERFORM pg_temp.h14_fin_assert(jsonb_typeof(d)='object','reader must return an object');
  PERFORM pg_temp.h14_fin_assert(d ?& ARRAY['version','embarque_id','expediente','facturas','cxp',
    'pagos_cxc','pagos_cxp','notas_credito_cxc','notas_credito_cxp','comisiones_definitivas',
    'proformas','cerrado','bloqueado','ejemplos_cxc','ejemplos_cxp']
    AND (SELECT count(*)=15 FROM jsonb_object_keys(d)), 'exact reader contract keys');
  PERFORM pg_temp.h14_fin_assert(d->'version'='1'::jsonb AND (d->>'embarque_id')::uuid=target
    AND jsonb_typeof(d->'expediente')='string' AND length(d->>'expediente')>0,
    'reader version, target and expediente');
  FOR key IN SELECT jsonb_object_keys(expected) LOOP
    PERFORM pg_temp.h14_fin_assert(d->key IS NOT DISTINCT FROM expected->key,
      'independent reader count mismatch: '||key);
  END LOOP;
  PERFORM pg_temp.h14_fin_assert(d->'cerrado'='false'::jsonb
    AND d->'bloqueado'=to_jsonb(p_case='shared'),'reader blocking must match fixture facts');
  PERFORM pg_temp.h14_fin_assert(jsonb_typeof(d->'ejemplos_cxc')='array'
    AND jsonb_typeof(d->'ejemplos_cxp')='array','reader examples must be separate arrays');
  PERFORM pg_temp.h14_fin_assert(jsonb_array_length(d->'ejemplos_cxc')=(expected->>'facturas')::int
    AND jsonb_array_length(d->'ejemplos_cxp')=0,'examples must match independent complete counts');
  FOR sample IN SELECT value FROM jsonb_array_elements(d->'ejemplos_cxc') LOOP
    PERFORM pg_temp.h14_fin_assert(jsonb_typeof(sample)='object'
      AND sample ?& ARRAY['id','folio','estado']
      AND (SELECT count(*)=3 FROM jsonb_object_keys(sample))
      AND sample->>'id'=p_fixture->'invoice_ids'->>0
      AND sample->>'estado'='Borrador' AND jsonb_typeof(sample->'folio')='string',
      'shared-path example must be the one independently created invoice');
  END LOOP;
  RETURN jsonb_build_object('case',p_case,'repeat',p_repeat,'mode',p_mode,'budget_ms',8000,
    'jit',current_setting('jit'),'elapsed_ms',elapsed_ms,'payload',d,
    'caller',jsonb_build_object('current_user',current_user,'auth_uid',auth.uid(),
      'org',public.current_user_org_id(),'scope',public.org_scope(),'super_admin',
      public.has_role(auth.uid(),'super_admin'::public.app_role)));
END $probe$;

SELECT pg_temp.h14_fin_actor(
  (current_setting('h14.reader_budget.empty_fixture')::jsonb->>'actor_a')::uuid);
SET LOCAL statement_timeout = '8s';
SET LOCAL jit = off;
SET LOCAL plan_cache_mode = force_custom_plan;
SELECT set_config('h14.reader_budget.empty_custom_1',pg_temp.h14_reader_budget_probe('empty',
  current_setting('h14.reader_budget.empty_fixture')::jsonb,'force_custom_plan',1)::text,true);
SELECT set_config('h14.reader_budget.empty_custom_2',pg_temp.h14_reader_budget_probe('empty',
  current_setting('h14.reader_budget.empty_fixture')::jsonb,'force_custom_plan',2)::text,true);
SELECT set_config('h14.reader_budget.shared_custom_1',pg_temp.h14_reader_budget_probe('shared',
  current_setting('h14.reader_budget.shared_fixture')::jsonb,'force_custom_plan',1)::text,true);
SELECT set_config('h14.reader_budget.shared_custom_2',pg_temp.h14_reader_budget_probe('shared',
  current_setting('h14.reader_budget.shared_fixture')::jsonb,'force_custom_plan',2)::text,true);
SET LOCAL plan_cache_mode = force_generic_plan;
SELECT set_config('h14.reader_budget.empty_generic_1',pg_temp.h14_reader_budget_probe('empty',
  current_setting('h14.reader_budget.empty_fixture')::jsonb,'force_generic_plan',1)::text,true);
SELECT set_config('h14.reader_budget.empty_generic_2',pg_temp.h14_reader_budget_probe('empty',
  current_setting('h14.reader_budget.empty_fixture')::jsonb,'force_generic_plan',2)::text,true);
SELECT set_config('h14.reader_budget.shared_generic_1',pg_temp.h14_reader_budget_probe('shared',
  current_setting('h14.reader_budget.shared_fixture')::jsonb,'force_generic_plan',1)::text,true);
SELECT set_config('h14.reader_budget.shared_generic_2',pg_temp.h14_reader_budget_probe('shared',
  current_setting('h14.reader_budget.shared_fixture')::jsonb,'force_generic_plan',2)::text,true);
SELECT pg_temp.h14_fin_owner();
SET LOCAL statement_timeout = '60s';

DO $unchanged$
DECLARE org uuid := (current_setting('h14.reader_budget.empty_fixture')::jsonb->>'org_a')::uuid;
BEGIN
  PERFORM pg_temp.h14_fin_assert(
    current_setting('h14.reader_budget.own_before')=md5(pg_temp.h14_fin_snapshot(org)::text)
    AND current_setting('h14.reader_budget.foreign_before')=
      md5(pg_temp.h14_fin_snapshot(current_setting('h14.reader_budget.foreign_org')::uuid)::text),
    'public reader must not change the fictitious financial history');
END $unchanged$;

CREATE FUNCTION pg_temp.h14_reader_budget_result(p_case text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $result$
DECLARE
  mode text; rep integer; observation jsonb; first_payload jsonb; readings jsonb:='[]';
BEGIN
  PERFORM pg_temp.h14_fin_assert(p_case IN ('empty','shared'),'known budget result required');
  FOREACH mode IN ARRAY ARRAY['custom','generic'] LOOP
    FOR rep IN 1..2 LOOP
      observation := current_setting('h14.reader_budget.'||p_case||'_'||mode||'_'||rep,true)::jsonb;
      PERFORM pg_temp.h14_fin_assert(observation IS NOT NULL AND observation->>'case'=p_case
        AND (observation->>'repeat')::int=rep AND observation->>'mode'='force_'||mode||'_plan'
        AND observation->'budget_ms'='8000'::jsonb AND observation->>'jit'='off',
        'all declared reader observations must exist and match their actual context');
      IF first_payload IS NULL THEN first_payload:=observation->'payload'; END IF;
      PERFORM pg_temp.h14_fin_assert(observation->'payload' IS NOT DISTINCT FROM first_payload,
        'reader payload must agree across first/second and custom/generic reads');
      readings:=readings||jsonb_build_array(observation);
    END LOOP;
  END LOOP;
  PERFORM pg_temp.h14_fin_assert(jsonb_array_length(readings)=4,'four successful reads required per case');
  RETURN jsonb_build_object('case_id','P04.reader_budget_'||p_case,'matrix_id','P04','tier','S',
    'expected_by_code',jsonb_build_object('public_reader',true,'statement_budget_ms',8000,
      'reads',4,'foreign_terminal_proformas',501,'foreign_invoices',326,
      'facturas',CASE p_case WHEN 'shared' THEN 1 ELSE 0 END,
      'other_financial_counts',0,'data_unchanged',true),
    'observed',jsonb_build_object('readings',readings,'financial_history_unchanged',true,
      'scope','Owned PostgreSQL clone with SQL Auth fixture; no signed HTTP/JWT or production latency claim'),
    'status','READER_BUDGET_CONFIRMED','reproduction_complete',true);
END $result$;
SELECT 'H14_RESULT '||pg_temp.h14_reader_budget_result('empty')::text;
SELECT 'H14_RESULT '||pg_temp.h14_reader_budget_result('shared')::text;
ROLLBACK;
